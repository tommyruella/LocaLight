export class LocalLightEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
        if (!this.gl) {
            alert('WebGL 2 is not supported on this device.');
            return;
        }

        this.originalTexture = null;
        this.baseTexture = null;
        this.baseFbo = null;
        this.blurTexture = null;
        this.blurFbo = null;
        this.lutTexture = null;
        
        this.uniformLocations = {};

        this.state = {
            u_exposure: 0.0,
            u_brightness: 0.0,
            u_contrast: 0.0,
            u_cinematic_contrast: 0.0,
            u_highlights: 0.0,
            u_shadows: 0.0,
            u_whites: 0.0,
            u_blacks: 0.0,
            u_saturation: 0.0,
            u_cinematic_saturation: 0.0,
            u_vibrance: 0.0,
            u_sharpness: 0.0,
            u_clarity: 0.0,
            u_lut_intensity: 0.0,
            u_lift: [0.0, 0.0, 0.0],
            u_gamma: [1.0, 1.0, 1.0],
            u_gain: [1.0, 1.0, 1.0],
            u_temperature: 0.0,
            u_tint: 0.0,
            u_shadow_toe: 0.0,
            u_highlight_shoulder: 0.0,
            u_hsl_shifts: new Float32Array(24)
        };

        this.initCapabilities();
        this.initShaders();
        this.initBuffers();
    }

    initCapabilities() {
        const gl = this.gl;
        this.caps = {
            colorBufferFloat: gl.getExtension('EXT_color_buffer_float'),
            textureHalfFloatLinear: gl.getExtension('OES_texture_half_float_linear') || gl.getExtension('OES_texture_float_linear'),
        };
        console.log("[LocalLightEngine] Capabilities:", this.caps);
    }

    initShaders() {
        const gl = this.gl;

const GLSL_COLOR_SPACE = `
// INPUT SPACE: sRGB (0.0 - 1.0)
// OUTPUT SPACE: Linear sRGB (0.0 - +inf)
vec3 linearizeSRGB(vec3 srgb) {
    vec3 bLess = step(vec3(0.04045), srgb);
    vec3 linOut = mix( srgb/vec3(12.92), pow((srgb+vec3(0.055))/vec3(1.055), vec3(2.4)), bLess );
    return linOut;
}

// INPUT SPACE: Linear sRGB (0.0 - +inf)
// OUTPUT SPACE: sRGB (0.0 - 1.0)
vec3 encodeSRGB(vec3 linear) {
    vec3 c = max(vec3(0.0), linear); // Prevent NaN from negative values
    // Optional clamp for output, but OETF technically supports HDR if unclamped. We'll clamp later at display stage if needed.
    vec3 bLess = step(vec3(0.0031308), c);
    vec3 srgbOut = mix( c*vec3(12.92), vec3(1.055)*pow(c, vec3(1.0/2.4)) - vec3(0.055), bLess );
    return srgbOut;
}
`;


        const vsSource = `#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }`;

        const fsBaseSource = `#version 300 es
    precision highp float;
    in vec2 v_texCoord;
    uniform sampler2D u_image;
    out vec4 outColor;
    
    uniform float u_exposure;
    uniform vec3 u_wb_scale;
    uniform int u_is_srgb_input;
    
    uniform float u_spline_x[5];
    uniform float u_spline_y[5];
    uniform float u_spline_m[5];
    
    uniform vec3 u_lift;
    uniform vec3 u_gamma;
    uniform vec3 u_gain;
    uniform float u_saturation;
    uniform float u_vibrance;

    float evalSpline(float x_val) {
        if (x_val <= u_spline_x[0]) {
            return u_spline_y[0] + u_spline_m[0] * (x_val - u_spline_x[0]);
        }
        if (x_val >= u_spline_x[4]) {
            return u_spline_y[4] + u_spline_m[4] * (x_val - u_spline_x[4]);
        }
        
        for (int i = 0; i < 4; i++) {
            if (x_val >= u_spline_x[i] && x_val <= u_spline_x[i+1]) {
                float h = u_spline_x[i+1] - u_spline_x[i];
                float t = (x_val - u_spline_x[i]) / h;
                float t2 = t * t;
                float t3 = t2 * t;
                
                float h00 = 2.0*t3 - 3.0*t2 + 1.0;
                float h10 = t3 - 2.0*t2 + t;
                float h01 = -2.0*t3 + 3.0*t2;
                float h11 = t3 - t2;
                
                return h00 * u_spline_y[i] + h10 * h * u_spline_m[i] + h01 * u_spline_y[i+1] + h11 * h * u_spline_m[i+1];
            }
        }
        return x_val;
    }

    void main() {
        vec4 color = texture(u_image, vec2(v_texCoord.x, 1.0 - v_texCoord.y));
        
        if (u_is_srgb_input == 1) {
            vec3 srgb = color.rgb;
            bvec3 cutoff = lessThanEqual(srgb, vec3(0.04045));
            vec3 higher = pow((srgb + vec3(0.055)) / vec3(1.055), vec3(2.4));
            vec3 lower = srgb / vec3(12.92);
            color.rgb = mix(higher, lower, cutoff);
        }

                const mat3 M_SRGB_TO_LMS = mat3(
            0.422725, 0.055700, 0.021383,
            0.491345, 0.961534, 0.087642,
            0.027358, 0.023184, 0.980508
        );
        // Correct Inverse of M_SRGB_TO_LMS
        const mat3 M_LMS_TO_SRGB = mat3(
            2.538047, -0.146005, -0.042299,
            -1.293278, 1.116649, -0.071607,
            -0.040237, -0.022329, 1.022753
        );
        vec3 lms = M_SRGB_TO_LMS * color.rgb;
        lms *= u_wb_scale;
        color.rgb = M_LMS_TO_SRGB * lms;

        
        // Luminance extraction
        float l_in = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
        float safe_l_in = max(l_in, 1e-6);
        
        // Exposure in EV space
        float ev = log2(safe_l_in / 0.18) + u_exposure;
        
        // Tone Curve
        float ev_out = evalSpline(ev);
        float l_out = 0.18 * exp2(ev_out);
        
        // Reapply Luma (color preserving)
        float scale = l_out / safe_l_in;
        color.rgb *= scale;
        
        // --- Saturation & Vibrance ---
        float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
        color.rgb = mix(vec3(luma), color.rgb, 1.0 + u_saturation);
        
        float maxC = max(color.r, max(color.g, color.b));
        float currentSat = maxC > 1e-5 ? (maxC - luma) / maxC : 0.0;
        float vibAmount = u_vibrance * (1.0 - clamp(currentSat, 0.0, 1.0));
        color.rgb = mix(vec3(luma), color.rgb, 1.0 + vibAmount);
        
        // --- ASC CDL (Lift/Gamma/Gain) ---
        color.rgb = color.rgb * u_gain;
        color.rgb = color.rgb + u_lift * max(1.0 - color.rgb, vec3(0.0));
        color.rgb = sign(color.rgb) * pow(abs(color.rgb), vec3(1.0) / max(u_gamma, vec3(1e-5)));

        outColor = color;
    }
`;

        const fsBlurSource = `#version 300 es
        precision mediump float;
        in vec2 v_texCoord;
        uniform sampler2D u_image;
        uniform vec2 u_texelSize;
        out vec4 outColor;
        void main() {
            outColor = texture(u_image, v_texCoord);
        }`;

        const fsCompositeSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_baseImage;
        out vec4 outColor;
        void main() {
            vec3 color = texture(u_baseImage, v_texCoord).rgb;
            outColor = vec4(color, 1.0);
        }`;

        const fsBlendSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        out vec4 outColor;
        
        uniform sampler2D u_base;
        uniform sampler2D u_layer;
        uniform float u_opacity;
        uniform int u_blendMode;
        
        void main() {
            vec3 base = texture(u_base, v_texCoord).rgb;
            vec3 layer = texture(u_layer, v_texCoord).rgb;
            vec3 blended = base;
            
            if (u_blendMode == 0) {
                blended = layer;
            } else if (u_blendMode == 1) { // Multiply
                blended = base * layer;
            } else if (u_blendMode == 2) { // Screen
                blended = 1.0 - (1.0 - base) * (1.0 - layer);
            } else if (u_blendMode == 3) { // Overlay
                blended = vec3(
                    base.r < 0.5 ? (2.0 * base.r * layer.r) : (1.0 - 2.0 * (1.0 - base.r) * (1.0 - layer.r)),
                    base.g < 0.5 ? (2.0 * base.g * layer.g) : (1.0 - 2.0 * (1.0 - base.g) * (1.0 - layer.g)),
                    base.b < 0.5 ? (2.0 * base.b * layer.b) : (1.0 - 2.0 * (1.0 - base.b) * (1.0 - layer.b))
                );
            }
            
            outColor = vec4(mix(base, blended, u_opacity), 1.0);
        }`;

        const fsOutputSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        
        uniform sampler2D u_image;
        
        // 3D LUT
        uniform highp sampler3D u_lut;
        uniform float u_lut_intensity;
        uniform float u_lut_size;
        
        out vec4 outColor;
        
        ${GLSL_COLOR_SPACE}

        void main() {
            vec3 color = texture(u_image, v_texCoord).rgb;
            
            // Provisional Display Transform
            vec3 c = max(vec3(0.0), color);
            c = clamp(c, 0.0, 1.0);
            
            // Output Encoding (Linear -> sRGB)
            vec3 encoded = encodeSRGB(c);
            
            // --- 3D LUT in Display-Referred Space ---
            // Scale coords to sample voxel centers and avoid edge bleeding
            vec3 lutCoord = (encoded * (u_lut_size - 1.0) + 0.5) / u_lut_size;
            vec3 lutColor = texture(u_lut, lutCoord).rgb;
            
            encoded = mix(encoded, lutColor, u_lut_intensity);
            
            outColor = vec4(encoded, 1.0);
        }`;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const baseShader = this.compileShader(gl.FRAGMENT_SHADER, fsBaseSource);
        const blurShader = this.compileShader(gl.FRAGMENT_SHADER, fsBlurSource);
        const compositeShader = this.compileShader(gl.FRAGMENT_SHADER, fsCompositeSource);
        const blendShader = this.compileShader(gl.FRAGMENT_SHADER, fsBlendSource);
        const outputShader = this.compileShader(gl.FRAGMENT_SHADER, fsOutputSource);

        this.baseProgram = this.createProgram(vertexShader, baseShader);
        this.blurProgram = this.createProgram(vertexShader, blurShader);
        this.compositeProgram = this.createProgram(vertexShader, compositeShader);
        this.blendProgram = this.createProgram(vertexShader, blendShader);
        this.outputProgram = this.createProgram(vertexShader, outputShader);

        // Uniforms for Blend Pass
        this.blendLocs = {};
        gl.useProgram(this.blendProgram);
        this.blendLocs['u_base'] = gl.getUniformLocation(this.blendProgram, 'u_base');
        this.blendLocs['u_layer'] = gl.getUniformLocation(this.blendProgram, 'u_layer');
        this.blendLocs['u_opacity'] = gl.getUniformLocation(this.blendProgram, 'u_opacity');
        this.blendLocs['u_blendMode'] = gl.getUniformLocation(this.blendProgram, 'u_blendMode');

        // Uniforms for Output Pass
        this.outputLocs = {};
        gl.useProgram(this.outputProgram);
        this.outputLocs['u_image'] = gl.getUniformLocation(this.outputProgram, 'u_image');
        this.outputLocs['u_lut'] = gl.getUniformLocation(this.outputProgram, 'u_lut');
        this.outputLocs['u_lut_intensity'] = gl.getUniformLocation(this.outputProgram, 'u_lut_intensity');
        this.outputLocs['u_lut_size'] = gl.getUniformLocation(this.outputProgram, 'u_lut_size');
        this.outputLocs['u_lut'] = gl.getUniformLocation(this.outputProgram, 'u_lut');
        this.outputLocs['u_lut_intensity'] = gl.getUniformLocation(this.outputProgram, 'u_lut_intensity');
        this.outputLocs['u_lut_size'] = gl.getUniformLocation(this.outputProgram, 'u_lut_size');

        // Uniforms for Base Pass
        this.baseLocs = {};
        gl.useProgram(this.baseProgram);
        this.baseLocs['u_image'] = gl.getUniformLocation(this.baseProgram, 'u_image');
        this.baseLocs['u_is_srgb_input'] = gl.getUniformLocation(this.baseProgram, 'u_is_srgb_input');
        this.baseLocs['u_exposure'] = gl.getUniformLocation(this.baseProgram, 'u_exposure');
        this.baseLocs['u_wb_scale'] = gl.getUniformLocation(this.baseProgram, 'u_wb_scale');

        this.baseLocs['u_spline_x'] = gl.getUniformLocation(this.baseProgram, 'u_spline_x');
        this.baseLocs['u_spline_y'] = gl.getUniformLocation(this.baseProgram, 'u_spline_y');
        this.baseLocs['u_spline_m'] = gl.getUniformLocation(this.baseProgram, 'u_spline_m');
        this.baseLocs['u_lift'] = gl.getUniformLocation(this.baseProgram, 'u_lift');
        this.baseLocs['u_gamma'] = gl.getUniformLocation(this.baseProgram, 'u_gamma');
        this.baseLocs['u_gain'] = gl.getUniformLocation(this.baseProgram, 'u_gain');
        this.baseLocs['u_saturation'] = gl.getUniformLocation(this.baseProgram, 'u_saturation');
        this.baseLocs['u_vibrance'] = gl.getUniformLocation(this.baseProgram, 'u_vibrance');


        // Uniforms for Blur Pass
        this.blurLocs = {};
        gl.useProgram(this.blurProgram);
        this.blurLocs['u_image'] = gl.getUniformLocation(this.blurProgram, 'u_image');
        this.blurLocs['u_texelSize'] = gl.getUniformLocation(this.blurProgram, 'u_texelSize');

        // Uniforms for Composite Pass
        this.compLocs = {};
        gl.useProgram(this.compositeProgram);
        this.compLocs['u_baseImage'] = gl.getUniformLocation(this.compositeProgram, 'u_baseImage');
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            console.error('Shader compile failed:', info);
            alert("Shader error: " + info);
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vs, fs) {
        const gl = this.gl;
        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        return p;
    }

    initBuffers() {
        const gl = this.gl;
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        this.buffers = { position: positionBuffer, texCoord: texCoordBuffer };
        
        this.dummyLut = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, this.dummyLut);
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    bindQuad(program) {
        const gl = this.gl;
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        if (positionLocation !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        }

        const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        if (texCoordLocation !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoord);
            gl.enableVertexAttribArray(texCoordLocation);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
        }
    }

    createFboAndTexture(w, h, useFloat = false) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        
        let internalFormat = gl.RGBA8;
        let format = gl.RGBA;
        let type = gl.UNSIGNED_BYTE;
        let filter = gl.LINEAR;
        
        if (useFloat && this.caps.colorBufferFloat) {
            internalFormat = gl.RGBA16F;
            type = gl.HALF_FLOAT;
            if (!this.caps.textureHalfFloatLinear) {
                filter = gl.NEAREST;
            }
        }
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.warn("[LocalLightEngine] FBO not complete for format", internalFormat, status);
            if (useFloat) {
                gl.deleteFramebuffer(fbo);
                gl.deleteTexture(tex);
                return this.createFboAndTexture(w, h, false);
            }
        }
        
        return { tex, fbo, isFloat: (internalFormat === gl.RGBA16F) };
    }

    loadImage(imageElement) {
        const gl = this.gl;
        
        this.canvas.width = imageElement.width;
        this.canvas.height = imageElement.height;
        
        const baseW = this.canvas.width;
        const baseH = this.canvas.height;
        const blurW = Math.max(1, Math.floor(baseW / 4));
        const blurH = Math.max(1, Math.floor(baseH / 4));

        if (this.originalTexture) gl.deleteTexture(this.originalTexture);
        this.originalTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageElement);

        if (this.baseTexture) gl.deleteTexture(this.baseTexture);
        if (this.baseFbo) gl.deleteFramebuffer(this.baseFbo);
        const base = this.createFboAndTexture(baseW, baseH, true);
        this.baseTexture = base.tex;
        this.baseFbo = base.fbo;

        if (this.blurTexture) gl.deleteTexture(this.blurTexture);
        if (this.blurFbo) gl.deleteFramebuffer(this.blurFbo);
        const blur = this.createFboAndTexture(blurW, blurH, true);
        this.blurTexture = blur.tex;
        this.blurFbo = blur.fbo;

        if (this.layerTexture) gl.deleteTexture(this.layerTexture);
        if (this.layerFbo) gl.deleteFramebuffer(this.layerFbo);
        const layerFboObj = this.createFboAndTexture(baseW, baseH, true);
        this.layerTexture = layerFboObj.tex;
        this.layerFbo = layerFboObj.fbo;

        if (this.compATexture) gl.deleteTexture(this.compATexture);
        if (this.compAFbo) gl.deleteFramebuffer(this.compAFbo);
        const compA = this.createFboAndTexture(baseW, baseH, true);
        this.compATexture = compA.tex;
        this.compAFbo = compA.fbo;

        if (this.compBTexture) gl.deleteTexture(this.compBTexture);
        if (this.compBFbo) gl.deleteFramebuffer(this.compBFbo);
        const compB = this.createFboAndTexture(baseW, baseH, true);
        this.compBTexture = compB.tex;
        this.compBFbo = compB.fbo;
        
        this.blurW = blurW;
        this.blurH = blurH;

        this.render();
    }

    loadLUT(lutData) {
        const gl = this.gl;
        if (this.lutTexture) {
            gl.deleteTexture(this.lutTexture);
        }
        this.lutTexture = gl.createTexture();
        this.lutSize = lutData.size;
        
        gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
        
        // Pad RGB to RGBA to avoid WebGL2 3-channel alignment/support issues on some drivers
        const rgbaData = new Float32Array(this.lutSize * this.lutSize * this.lutSize * 4);
        for(let i=0, j=0; i < lutData.data.length; i+=3, j+=4) {
            rgbaData[j]   = lutData.data[i];
            rgbaData[j+1] = lutData.data[i+1];
            rgbaData[j+2] = lutData.data[i+2];
            rgbaData[j+3] = 1.0;
        }
        
        const internalFormat = gl.RGBA16F; 
        const format = gl.RGBA;
        const type = gl.FLOAT;
        
        gl.texImage3D(gl.TEXTURE_3D, 0, internalFormat, this.lutSize, this.lutSize, this.lutSize, 0, format, type, rgbaData);
        
        const filter = this.caps.textureHalfFloatLinear ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        
        gl.bindTexture(gl.TEXTURE_3D, null);
        
        // No explicit render() needed here because app.js triggers updateStateFromSliders immediately.
    }

    resetState() {
        this.state.u_exposure = 0.0;
        this.state.u_temperature = 0.0;
        this.state.u_tint = 0.0;
        this.render();
    }

    setUniform(name, value) {
        if (this.state[name] !== undefined) {
            this.state[name] = value;
            this.render();
        }
    }

    setBypass(isBypassed) {
        this.bypassed = isBypassed;
    }


    
    buildSpline(contrast, shadows, highlights, blacks, whites) {
        const x = [-8.0, -4.0, 0.0, 4.0, 8.0];
        let y = [...x];
        
        // Semantic offset magnitudes
        const MAX_OFFSET = 2.0; // 2 EV max pull
        
        const c = Math.pow(2.0, contrast);
        for (let i = 0; i < 5; i++) {
            if (i !== 2) y[i] = x[i] * c;
        }
        
        y[0] += blacks * MAX_OFFSET;
        y[1] += shadows * MAX_OFFSET;
        y[3] += highlights * MAX_OFFSET;
        y[4] += whites * MAX_OFFSET;
        
        // Clamp sequential to ensure strict monotonicity
        const gap = 0.05;
        y[2] = 0.0;
        y[1] = Math.min(y[1], y[2] - gap);
        y[0] = Math.min(y[0], y[1] - gap);
        y[3] = Math.max(y[3], y[2] + gap);
        y[4] = Math.max(y[4], y[3] + gap);
        
        let delta = new Array(4);
        for (let i = 0; i < 4; i++) {
            delta[i] = (y[i+1] - y[i]) / (x[i+1] - x[i]);
        }
        
        let m = new Array(5).fill(0);
        
        m[0] = delta[0];
        m[4] = delta[3];
        for (let i = 1; i < 4; i++) {
            if (delta[i-1] * delta[i] <= 0) {
                m[i] = 0;
            } else {
                m[i] = (delta[i-1] + delta[i]) / 2.0;
            }
        }
        
        // Fritsch-Carlson ellipse constraint
        for (let i = 0; i < 4; i++) {
            if (delta[i] === 0) {
                m[i] = 0;
                m[i+1] = 0;
            } else {
                const alpha = m[i] / delta[i];
                const beta = m[i+1] / delta[i];
                const dist = alpha*alpha + beta*beta;
                if (dist > 9.0) {
                    const tau = 3.0 / Math.sqrt(dist);
                    m[i] = tau * alpha * delta[i];
                    m[i+1] = tau * beta * delta[i];
                }
            }
        }
        
        return { x, y, m };
    }


    calculateWBScale(tempUI, tintUI) {
        if (tempUI === 0.0 && tintUI === 0.0) {
            return [1.0, 1.0, 1.0];
        }

        const get_uv = (T) => {
            let xp, yp, xd, yd, x, y;
            // Planckian
            xp = -0.2661239 * (1e9 / (T*T*T)) - 0.2343589 * (1e6 / (T*T)) + 0.8776956 * (1e3 / T) + 0.179910;
            if (T <= 2222) {
                yp = -1.1063814 * (xp*xp*xp) - 1.34811020 * (xp*xp) + 2.18555832 * xp - 0.20219683;
            } else {
                yp = -0.9549476 * (xp*xp*xp) - 1.37418593 * (xp*xp) + 2.09137015 * xp - 0.16748867;
            }
            // Daylight
            if (T <= 7000) {
                xd = -4.6070 * (1e9 / (T*T*T)) + 2.9678 * (1e6 / (T*T)) + 0.09911 * (1e3 / T) + 0.244063;
            } else {
                xd = -2.0064 * (1e9 / (T*T*T)) + 1.9018 * (1e6 / (T*T)) + 0.24748 * (1e3 / T) + 0.237040;
            }
            yd = -3.000 * (xd*xd) + 2.870 * xd - 0.275;
            
            if (T < 4000) {
                x = xp; y = yp;
            } else if (T > 5000) {
                x = xd; y = yd;
            } else {
                let t = (T - 4000.0) / 1000.0;
                let alpha = t * t * (3.0 - 2.0 * t);
                x = xp + (xd - xp) * alpha;
                y = yp + (yd - yp) * alpha;
            }
            let u = (4.0 * x) / (-2.0 * x + 12.0 * y + 3.0);
            let v = (6.0 * y) / (-2.0 * x + 12.0 * y + 3.0);
            return [u, v];
        };

        const mired_neutral = 1000000.0 / 6504.0;
        const mired_warm = 1000000.0 / 15000.0;
        const mired_cool = 1000000.0 / 2000.0;
        
        let mired;
        if (tempUI < 0) {
            mired = mired_neutral + (-tempUI) * (mired_cool - mired_neutral);
        } else {
            mired = mired_neutral + tempUI * (mired_warm - mired_neutral);
        }
        const T = 1000000.0 / mired;
        
        let uv0 = get_uv(T);
        let uv1 = get_uv(T + 0.1);
        let du = uv1[0] - uv0[0];
        let dv = uv1[1] - uv0[1];
        let len = Math.sqrt(du*du + dv*dv);
        
        let u = uv0[0] + tintUI * 0.015 * (-dv / len);
        let v = uv0[1] + tintUI * 0.015 * (du / len);
        
        let x = (3.0 * u) / (2.0 * u - 8.0 * v + 4.0);
        let y = (2.0 * v) / (2.0 * u - 8.0 * v + 4.0);
        
        const Y = 1.0;
        const X = (x * Y) / y;
        const Z = ((1.0 - x - y) * Y) / y;
        
        const M_BFD = [
            [ 0.8951,  0.2664, -0.1614],
            [-0.7502,  1.7135,  0.0367],
            [ 0.0389, -0.0685,  1.0296]
        ];
        
        const lms_source = [
            M_BFD[0][0]*X + M_BFD[0][1]*Y + M_BFD[0][2]*Z,
            M_BFD[1][0]*X + M_BFD[1][1]*Y + M_BFD[1][2]*Z,
            M_BFD[2][0]*X + M_BFD[2][1]*Y + M_BFD[2][2]*Z
        ];
        
        const x_D65 = 0.31271;
        const y_D65 = 0.32902;
        const X_D65 = (x_D65 * Y) / y_D65;
        const Z_D65 = ((1.0 - x_D65 - y_D65) * Y) / y_D65;
        const lms_D65 = [
            M_BFD[0][0]*X_D65 + M_BFD[0][1]*Y + M_BFD[0][2]*Z_D65,
            M_BFD[1][0]*X_D65 + M_BFD[1][1]*Y + M_BFD[1][2]*Z_D65,
            M_BFD[2][0]*X_D65 + M_BFD[2][1]*Y + M_BFD[2][2]*Z_D65
        ];
        
        return [
            lms_D65[0] / lms_source[0],
            lms_D65[1] / lms_source[1],
            lms_D65[2] / lms_source[2]
        ];
    }

    renderSingleLayerState(state, targetFbo, inputTexture) {
        const gl = this.gl;
        
        // PASS 1: Base (Exposure)
        gl.useProgram(this.baseProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.baseFbo);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.bindQuad(this.baseProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture || this.originalTexture);
        gl.uniform1i(this.baseLocs['u_image'], 0);
        
        const isSrgbInput = (inputTexture === this.originalTexture) || !inputTexture;
        gl.uniform1i(this.baseLocs['u_is_srgb_input'], isSrgbInput ? 1 : 0);
        
        const expVal = this.bypassed ? 0.0 : (state['u_exposure'] !== undefined ? state['u_exposure'] : (this.state['u_exposure'] || 0.0));
        gl.uniform1f(this.baseLocs['u_exposure'], expVal);
        
        const tempVal = this.bypassed ? 0.0 : (state['u_temperature'] !== undefined ? state['u_temperature'] : (this.state['u_temperature'] || 0.0));
        const tintVal = this.bypassed ? 0.0 : (state['u_tint'] !== undefined ? state['u_tint'] : (this.state['u_tint'] || 0.0));
        const wbScale = this.calculateWBScale(tempVal, tintVal);
        gl.uniform3f(this.baseLocs['u_wb_scale'], wbScale[0], wbScale[1], wbScale[2]);
        
        const c = this.bypassed ? 0.0 : (state['u_contrast'] !== undefined ? state['u_contrast'] : (this.state['u_contrast'] || 0.0));
        const s = this.bypassed ? 0.0 : (state['u_shadows'] !== undefined ? state['u_shadows'] : (this.state['u_shadows'] || 0.0));
        const hl = this.bypassed ? 0.0 : (state['u_highlights'] !== undefined ? state['u_highlights'] : (this.state['u_highlights'] || 0.0));
        const b = this.bypassed ? 0.0 : (state['u_blacks'] !== undefined ? state['u_blacks'] : (this.state['u_blacks'] || 0.0));
        const w = this.bypassed ? 0.0 : (state['u_whites'] !== undefined ? state['u_whites'] : (this.state['u_whites'] || 0.0));
        
        const spline = this.buildSpline(c, s, hl, b, w);
        gl.uniform1fv(this.baseLocs['u_spline_x'], spline.x);
        gl.uniform1fv(this.baseLocs['u_spline_y'], spline.y);
        gl.uniform1fv(this.baseLocs['u_spline_m'], spline.m);
        
        const satVal = this.bypassed ? 0.0 : (state['u_saturation'] !== undefined ? state['u_saturation'] : (this.state['u_saturation'] || 0.0));
        const vibVal = this.bypassed ? 0.0 : (state['u_vibrance'] !== undefined ? state['u_vibrance'] : (this.state['u_vibrance'] || 0.0));
        gl.uniform1f(this.baseLocs['u_saturation'], satVal);
        gl.uniform1f(this.baseLocs['u_vibrance'], vibVal);
        
        const liftVal = this.bypassed ? [0,0,0] : (state['u_lift'] !== undefined ? state['u_lift'] : (this.state['u_lift'] || [0,0,0]));
        const gammaVal = this.bypassed ? [1,1,1] : (state['u_gamma'] !== undefined ? state['u_gamma'] : (this.state['u_gamma'] || [1,1,1]));
        const gainVal = this.bypassed ? [1,1,1] : (state['u_gain'] !== undefined ? state['u_gain'] : (this.state['u_gain'] || [1,1,1]));
        
        gl.uniform3fv(this.baseLocs['u_lift'], liftVal);
        gl.uniform3fv(this.baseLocs['u_gamma'], gammaVal);
        gl.uniform3fv(this.baseLocs['u_gain'], gainVal);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 2: Blur (Pass-through for M3)
        gl.useProgram(this.blurProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbo);
        gl.viewport(0, 0, this.blurW, this.blurH);
        this.bindQuad(this.blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.blurLocs['u_image'], 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 3: Composite (Pass-through for M3)
        gl.useProgram(this.compositeProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.bindQuad(this.compositeProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.compLocs['u_baseImage'], 0);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    render(layersArray) {
        if (!this.originalTexture) return;
        
        const gl = this.gl;

        if (this.bypassed || !layersArray || layersArray.length === 0) {
            // Render directly into compAFbo, then output
            this.renderSingleLayerState(this.state, this.compAFbo, this.originalTexture);
            
            // Output to Canvas
            gl.useProgram(this.outputProgram);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.bindQuad(this.outputProgram);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.compATexture);
            gl.uniform1i(this.outputLocs['u_image'], 0);
            
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this.lutTexture || this.dummyLut);
            gl.uniform1i(this.outputLocs['u_lut'], 1);
            gl.uniform1f(this.outputLocs['u_lut_intensity'], 0.0);
            gl.uniform1f(this.outputLocs['u_lut_size'], this.lutSize || 1.0);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return;
        }
        
        let currentCompFbo = this.compAFbo;
        let currentCompTex = this.compATexture;
        let nextCompFbo = this.compBFbo;
        let nextCompTex = this.compBTexture;
        
        let firstVisible = true;
        
        for (let i = 0; i < layersArray.length; i++) {
            const layer = layersArray[i];
            if (!layer.visible) continue;
            const es = layer.engineState || this.state;
            
            if (firstVisible) {
                // Render this layer using originalTexture directly into currentCompFbo
                this.renderSingleLayerState(es, currentCompFbo, this.originalTexture);
                firstVisible = false;
            } else {
                // For subsequent layers, render into this.layerFbo using currentCompTex as input
                this.renderSingleLayerState(layer.engineState || this.state, this.layerFbo, currentCompTex);
                
                // Blend currentCompTex and this.layerTexture into nextCompFbo
                gl.useProgram(this.blendProgram);
                gl.bindFramebuffer(gl.FRAMEBUFFER, nextCompFbo);
                gl.viewport(0, 0, this.canvas.width, this.canvas.height);
                this.bindQuad(this.blendProgram);
                
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, currentCompTex);
                gl.uniform1i(this.blendLocs['u_base'], 0);
                
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, this.layerTexture);
                gl.uniform1i(this.blendLocs['u_layer'], 1);
                
                gl.uniform1f(this.blendLocs['u_opacity'], layer.opacity !== undefined ? layer.opacity : 1.0);
                let mode = 0;
                if (layer.blendMode === 'multiply') mode = 1;
                else if (layer.blendMode === 'screen') mode = 2;
                else if (layer.blendMode === 'overlay') mode = 3;
                gl.uniform1i(this.blendLocs['u_blendMode'], mode);
                
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                
                // Swap
                let tempFbo = currentCompFbo;
                currentCompFbo = nextCompFbo;
                nextCompFbo = tempFbo;
                
                let tempTex = currentCompTex;
                currentCompTex = nextCompTex;
                nextCompTex = tempTex;
            }
        }
        
        if (firstVisible) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        } else {
            // Draw currentCompTex to Canvas using outputProgram (sRGB encode)
            gl.useProgram(this.outputProgram);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.bindQuad(this.outputProgram);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, currentCompTex);
            gl.uniform1i(this.outputLocs['u_image'], 0);
            
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this.lutTexture || this.dummyLut);
            gl.uniform1i(this.outputLocs['u_lut'], 1);
                        let globalIntensity = 0.0;
            if (layersArray && layersArray.length > 0) {
                const active = layersArray.find(l => l.active) || layersArray[0];
                if (active.engineState && active.engineState['u_lut_intensity'] !== undefined) {
                    globalIntensity = active.engineState['u_lut_intensity'];
                }
            }
            gl.uniform1f(this.outputLocs['u_lut_intensity'], globalIntensity);
            gl.uniform1f(this.outputLocs['u_lut_size'], this.lutSize || 1.0);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }
}
