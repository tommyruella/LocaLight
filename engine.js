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

        this.initShaders();
        this.initBuffers();
    }

    initShaders() {
        const gl = this.gl;

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
        
        uniform float u_exposure;
        uniform float u_brightness;
        uniform float u_contrast;
        uniform float u_cinematic_contrast;
        uniform float u_highlights;
        uniform float u_shadows;
        uniform float u_whites;
        uniform float u_blacks;
        uniform float u_saturation;
        uniform float u_cinematic_saturation;
        uniform float u_vibrance;
        uniform vec3 u_lift;
        uniform vec3 u_gamma;
        uniform vec3 u_gain;
        uniform float u_temperature;
        uniform float u_tint;
        uniform float u_shadow_toe;
        uniform float u_highlight_shoulder;
        uniform vec3 u_hsl_shifts[8];
        
        out vec4 outColor;
        
        float getLuminance(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
        }

        vec3 rgb2hsv(vec3 c) {
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        // DaVinci Intermediate Color Science (Blackmagic Design DWG/DI)
        const float DI_A = 0.0075;
        const float DI_B = 7.0;
        const float DI_C = 0.07329248;
        const float DI_M = 10.44426855;
        const float DI_LIN_CUT = 0.00262409;
        const float DI_LOG_CUT = 0.02740668;
        const float DV_MID_GRAY = 0.336043; // Exact 18% Mid-Gray in DaVinci Intermediate

        float linearToDI(float x) {
            if (x <= DI_LIN_CUT) return x * DI_M;
            return (log2(x + DI_A) + DI_B) * DI_C;
        }

        vec3 linearToDI(vec3 c) {
            return vec3(linearToDI(c.r), linearToDI(c.g), linearToDI(c.b));
        }

        float DIToLinear(float v) {
            if (v <= DI_LOG_CUT) return v / DI_M;
            return pow(2.0, (v / DI_C) - DI_B) - DI_A;
        }

        vec3 DIToLinear(vec3 v) {
            return vec3(DIToLinear(v.r), DIToLinear(v.g), DIToLinear(v.b));
        }

        vec3 adjustLight(vec3 color) {
            // 1. Exposure (tamed to +/- 1.5 EV for precise control)
            color *= pow(2.0, u_exposure * 1.5); 
            
            // 2. Brightness (Photographic midtone lift, preserving 0.0 black & 1.0 white bounds)
            if (u_brightness != 0.0) {
                if (u_brightness > 0.0) {
                    color += (1.0 - color) * color * (u_brightness * 0.7);
                } else {
                    color += color * (u_brightness * 0.45);
                }
            }
            
            // 3. Standard Linear Contrast (tamed multiplier)
            color = (color - 0.5) * (1.0 + u_contrast * 0.45) + 0.5;
            color = clamp(color, 0.0, 1.0);
            
            // Store luminance before Film Curve to lock overall image brightness 100%
            float preLum = getLuminance(color);
            
            // --- DaVinci Intermediate Film Curve (DWG/DI Log S-Curve) ---
            vec3 diColor = linearToDI(color);
            
            // 1. Film Contrast (S-Curve centered at 0.5 log space for symmetric balance)
            if (u_cinematic_contrast != 0.0) {
                float factor = 1.0 + u_cinematic_contrast * 0.76;
                diColor = (diColor - 0.5) * factor + 0.5;
            }
            
            // 2. Shadow Toe (Shapes shadow toe: lift to fade blacks, lower to crush)
            if (u_shadow_toe != 0.0) {
                vec3 toeWeight = clamp((vec3(DV_MID_GRAY) - diColor) / vec3(DV_MID_GRAY), 0.0, 1.0);
                toeWeight = toeWeight * toeWeight;
                if (u_shadow_toe > 0.0) {
                    diColor += toeWeight * (u_shadow_toe * 0.08);
                } else {
                    diColor += diColor * toeWeight * (u_shadow_toe * 0.25);
                }
            }
            
            // 3. Highlight Shoulder (Shapes highlight shoulder: raise for soft filmic roll-off, lower to harden)
            if (u_highlight_shoulder != 0.0) {
                vec3 shoulderWeight = clamp((diColor - vec3(DV_MID_GRAY)) / (vec3(1.0) - vec3(DV_MID_GRAY)), 0.0, 1.0);
                shoulderWeight = shoulderWeight * shoulderWeight;
                if (u_highlight_shoulder > 0.0) {
                    vec3 rollOff = vec3(DV_MID_GRAY) + (diColor - vec3(DV_MID_GRAY)) * (1.0 / (1.0 + (diColor - vec3(DV_MID_GRAY)) * u_highlight_shoulder * 1.2));
                    diColor = mix(diColor, rollOff, shoulderWeight);
                } else {
                    diColor += diColor * shoulderWeight * (u_highlight_shoulder * 0.2);
                }
            }
            
            color = clamp(DIToLinear(diColor), 0.0, 1.0);
            
            // LUMINANCE LOCK: Force total average image brightness to remain 100% constant
            if (u_cinematic_contrast != 0.0) {
                float postLum = getLuminance(color);
                if (postLum > 0.001 && preLum > 0.001) {
                    float lumRatio = preLum / postLum;
                    color = clamp(color * mix(1.0, lumRatio, 0.75), 0.0, 1.0);
                }
            }
            
            float lum = getLuminance(color);
            float shadowMask = 1.0 - smoothstep(0.0, 0.5, lum);
            float highlightMask = smoothstep(0.4, 0.95, lum);
            
            // Shadows
            if (u_shadows > 0.0) {
                color += (1.0 - color) * shadowMask * (u_shadows * 0.35);
            } else {
                color += color * shadowMask * (u_shadows * 0.4);
            }
            
            // Highlights
            if (u_highlights > 0.0) {
                color += (1.0 - color) * highlightMask * (u_highlights * 0.35);
            } else {
                color += color * highlightMask * (u_highlights * 0.4);
            }
            
            lum = getLuminance(clamp(color, 0.0, 1.0));
            float blackMask = 1.0 - smoothstep(0.0, 0.3, lum);
            float whiteMask = smoothstep(0.7, 1.0, lum);
            
            // Blacks
            if (u_blacks > 0.0) {
                color += (1.0 - color) * blackMask * (u_blacks * 0.2);
            } else {
                color += color * blackMask * (u_blacks * 0.4);
            }
            
            // Whites
            if (u_whites > 0.0) {
                color += (1.0 - color) * whiteMask * (u_whites * 0.35);
            } else {
                color += color * whiteMask * (u_whites * 0.35);
            }
            
            // ASC CDL (Color Wheels)
            color = clamp(color * u_gain + u_lift, 0.0, 1.0);
            vec3 safeGamma = max(u_gamma, vec3(0.01));
            color = pow(color, 1.0 / safeGamma);
            
            return clamp(color, 0.0, 1.0);
        }

        vec3 adjustColor(vec3 color) {
            vec3 hsv = rgb2hsv(color);
            float satMult = 1.0 + u_saturation;
            
            // Boosted Vibrance: targets muted colors with higher power
            float vibMult = 1.0 + (u_vibrance * 1.8 * pow(1.0 - hsv.y, 1.2));
            hsv.y = clamp(hsv.y * satMult * vibMult, 0.0, 1.0);
            
            // Cinematic Saturation (Perceptual roll-off curve)
            if (u_cinematic_saturation != 0.0) {
                float noiseMask = smoothstep(0.0, 0.1, hsv.y);
                if (u_cinematic_saturation > 0.0) {
                    float exponent = mix(1.0, 0.4, u_cinematic_saturation);
                    float newS = pow(hsv.y, exponent);
                    hsv.y = mix(hsv.y, newS, noiseMask);
                } else {
                    float exponent = mix(1.0, 2.5, -u_cinematic_saturation);
                    hsv.y = pow(hsv.y, exponent);
                }
            }
            
            // HSL Color Shift per-channel (8 isolated bands)
            vec3 totalShift = vec3(0.0);
            float channelHues[8];
            channelHues[0] = 0.0;
            channelHues[1] = 0.0833;
            channelHues[2] = 0.1667;
            channelHues[3] = 0.3333;
            channelHues[4] = 0.5;
            channelHues[5] = 0.6667;
            channelHues[6] = 0.75;
            channelHues[7] = 0.8333;
            
            for(int i = 0; i < 8; i++) {
                float targetH = channelHues[i];
                float dist = abs(hsv.x - targetH);
                if (dist > 0.5) dist = 1.0 - dist;
                // Tight, separated band falloff (~28°) so adjacent colors don't bleed into each other
                float weight = smoothstep(0.078, 0.0, dist);
                totalShift += u_hsl_shifts[i] * weight;
            }
            
            // Ultra-soft low-saturation mask protecting grays and edge transitions
            float satMask = smoothstep(0.01, 0.40, hsv.y);
            
            // Soft Hue shift
            hsv.x = fract(hsv.x + totalShift.x * 0.12 * satMask);
            
            // Proportional Saturation shift (Lightroom/Resolve style roll-off)
            if (totalShift.y >= 0.0) {
                hsv.y = clamp(hsv.y + (1.0 - hsv.y) * totalShift.y * 0.5 * satMask, 0.0, 1.0);
            } else {
                hsv.y = clamp(hsv.y * (1.0 + totalShift.y * satMask), 0.0, 1.0);
            }
            
            // Soft Luminance shift
            hsv.z = clamp(hsv.z + totalShift.z * 0.20 * satMask, 0.0, 1.0);
            
            return hsv2rgb(hsv);
        }

        vec3 adjustWB(vec3 color) {
            float rMult = 1.0 + (u_temperature * 0.3) + (u_tint * 0.2);
            float gMult = 1.0 - (u_tint * 0.2);
            float bMult = 1.0 - (u_temperature * 0.3) + (u_tint * 0.2);
            
            float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
            vec3 newColor = color * vec3(rMult, gMult, bMult);
            float newLum = dot(newColor, vec3(0.2126, 0.7152, 0.0722));
            
            return clamp(newColor * (lum / max(newLum, 0.0001)), 0.0, 1.0);
        }

        void main() {
            // Flip Y axis here to avoid inconsistent iOS WebGL UNPACK_FLIP_Y bugs
            vec2 uv = vec2(v_texCoord.x, 1.0 - v_texCoord.y);
            vec4 texColor = texture(u_image, uv);
            vec3 color = texColor.rgb;
            color = adjustWB(color);
            color = adjustLight(color);
            color = adjustColor(color);
            outColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
        }`;

        const fsBlurSource = `#version 300 es
        precision mediump float;
        in vec2 v_texCoord;
        uniform sampler2D u_image;
        uniform vec2 u_texelSize;
        out vec4 outColor;
        void main() {
            vec3 color = vec3(0.0);
            float weight = 0.0;
            // 7x7 Box Blur
            for(int x = -3; x <= 3; x++) {
                for(int y = -3; y <= 3; y++) {
                    color += texture(u_image, v_texCoord + vec2(float(x), float(y)) * u_texelSize).rgb;
                    weight += 1.0;
                }
            }
            outColor = vec4(color / weight, 1.0);
        }`;

        const fsCompositeSource = `#version 300 es
        precision highp float;
        precision highp sampler2D;
        precision highp sampler3D;
        
        in vec2 v_texCoord;
        uniform sampler2D u_baseImage;
        uniform sampler2D u_blurImage;
        uniform sampler3D u_lut3d;
        
        uniform vec2 u_texelSize;
        uniform float u_sharpness;
        uniform float u_clarity;
        uniform float u_lut_intensity;
        
        out vec4 outColor;
        
        void main() {
            vec3 color = texture(u_baseImage, v_texCoord).rgb;
            vec3 blurred = texture(u_blurImage, v_texCoord).rgb;
            
            // Clarity (Unsharp mask from Quarter-Res Blur)
            if (u_clarity > 0.0) {
                color += (color - blurred) * u_clarity;
            } else if (u_clarity < 0.0) {
                color = mix(color, blurred, -u_clarity);
            }
            
            // Sharpness (High-pass Laplacian from Full-Res Base)
            if (u_sharpness > 0.0) {
                vec3 left = texture(u_baseImage, v_texCoord + vec2(-u_texelSize.x, 0.0)).rgb;
                vec3 right = texture(u_baseImage, v_texCoord + vec2(u_texelSize.x, 0.0)).rgb;
                vec3 up = texture(u_baseImage, v_texCoord + vec2(0.0, -u_texelSize.y)).rgb;
                vec3 down = texture(u_baseImage, v_texCoord + vec2(0.0, u_texelSize.y)).rgb;
                vec3 lap = color * 4.0 - left - right - up - down;
                
                // Amplified sharpness
                color += lap * (u_sharpness * 3.0);
            }
            
            color = clamp(color, 0.0, 1.0);
            
            // LUT 3D (Branchless to avoid mobile GPU optimizer bugs)
            vec3 lutColor = texture(u_lut3d, color).rgb;
            color = mix(color, lutColor, u_lut_intensity);
            
            outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
        }`;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const baseShader = this.compileShader(gl.FRAGMENT_SHADER, fsBaseSource);
        const blurShader = this.compileShader(gl.FRAGMENT_SHADER, fsBlurSource);
        const compositeShader = this.compileShader(gl.FRAGMENT_SHADER, fsCompositeSource);

        this.baseProgram = this.createProgram(vertexShader, baseShader);
        this.blurProgram = this.createProgram(vertexShader, blurShader);
        this.compositeProgram = this.createProgram(vertexShader, compositeShader);

        // Uniforms for Base Pass
        this.baseLocs = {};
        gl.useProgram(this.baseProgram);
        this.baseLocs['u_image'] = gl.getUniformLocation(this.baseProgram, 'u_image');
        ['u_exposure', 'u_brightness', 'u_contrast', 'u_cinematic_contrast', 'u_highlights', 'u_shadows', 'u_whites', 'u_blacks', 'u_saturation', 'u_cinematic_saturation', 'u_vibrance', 'u_temperature', 'u_tint', 'u_shadow_toe', 'u_highlight_shoulder'].forEach(name => {
            this.baseLocs[name] = gl.getUniformLocation(this.baseProgram, name);
        });
        this.baseLocs['u_lift'] = gl.getUniformLocation(this.baseProgram, 'u_lift');
        this.baseLocs['u_gamma'] = gl.getUniformLocation(this.baseProgram, 'u_gamma');
        this.baseLocs['u_gain'] = gl.getUniformLocation(this.baseProgram, 'u_gain');
        this.baseLocs['u_hsl_shifts'] = gl.getUniformLocation(this.baseProgram, 'u_hsl_shifts');

        // Uniforms for Blur Pass
        this.blurLocs = {};
        gl.useProgram(this.blurProgram);
        this.blurLocs['u_image'] = gl.getUniformLocation(this.blurProgram, 'u_image');
        this.blurLocs['u_texelSize'] = gl.getUniformLocation(this.blurProgram, 'u_texelSize');

        // Uniforms for Composite Pass
        this.compLocs = {};
        gl.useProgram(this.compositeProgram);
        this.compLocs['u_baseImage'] = gl.getUniformLocation(this.compositeProgram, 'u_baseImage');
        this.compLocs['u_blurImage'] = gl.getUniformLocation(this.compositeProgram, 'u_blurImage');
        this.compLocs['u_lut3d'] = gl.getUniformLocation(this.compositeProgram, 'u_lut3d');
        this.compLocs['u_texelSize'] = gl.getUniformLocation(this.compositeProgram, 'u_texelSize');
        this.compLocs['u_sharpness'] = gl.getUniformLocation(this.compositeProgram, 'u_sharpness');
        this.compLocs['u_clarity'] = gl.getUniformLocation(this.compositeProgram, 'u_clarity');
        this.compLocs['u_lut_intensity'] = gl.getUniformLocation(this.compositeProgram, 'u_lut_intensity');
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
        
        // Dummy 3D texture
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

    createFboAndTexture(w, h) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fbo };
    }

    loadImage(imageElement) {
        const gl = this.gl;
        
        this.canvas.width = imageElement.width;
        this.canvas.height = imageElement.height;
        
        const baseW = this.canvas.width;
        const baseH = this.canvas.height;
        const blurW = Math.max(1, Math.floor(baseW / 4));
        const blurH = Math.max(1, Math.floor(baseH / 4));

        // Original Texture Upload
        if (this.originalTexture) gl.deleteTexture(this.originalTexture);
        this.originalTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageElement);

        // FBOs
        if (this.baseTexture) gl.deleteTexture(this.baseTexture);
        if (this.baseFbo) gl.deleteFramebuffer(this.baseFbo);
        const base = this.createFboAndTexture(baseW, baseH);
        this.baseTexture = base.tex;
        this.baseFbo = base.fbo;

        if (this.blurTexture) gl.deleteTexture(this.blurTexture);
        if (this.blurFbo) gl.deleteFramebuffer(this.blurFbo);
        const blur = this.createFboAndTexture(blurW, blurH);
        this.blurTexture = blur.tex;
        this.blurFbo = blur.fbo;
        
        this.blurW = blurW;
        this.blurH = blurH;

        this.render();
    }

    loadLUT(lutData) {
        const gl = this.gl;
        if (this.lutTexture) gl.deleteTexture(this.lutTexture);
        
        this.lutTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        const size = lutData.size;
        const floatData = lutData.data;
        const rgbaData = new Uint8Array(size * size * size * 4);
        
        let j = 0;
        for (let i = 0; i < floatData.length; i += 3) {
            rgbaData[j++] = Math.max(0, Math.min(255, floatData[i] * 255.0));
            rgbaData[j++] = Math.max(0, Math.min(255, floatData[i+1] * 255.0));
            rgbaData[j++] = Math.max(0, Math.min(255, floatData[i+2] * 255.0));
            rgbaData[j++] = 255;
        }

        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgbaData);
        
        this.setUniform('u_lut_intensity', 1.0);
    }

    resetState() {
        for (let key in this.baseLocs) {
            if (key === 'u_image') continue;
            
            if (key === 'u_hsl_shifts') {
                this.state[key] = new Float32Array(24);
            } else if (Array.isArray(this.state[key])) {
                if (key === 'u_gamma' || key === 'u_gain') {
                    this.state[key] = [1.0, 1.0, 1.0];
                } else {
                    this.state[key] = [0.0, 0.0, 0.0];
                }
            } else {
                this.state[key] = 0.0;
            }
        }
        if (this.lutTexture) {
            this.gl.deleteTexture(this.lutTexture);
            this.lutTexture = null;
        }
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
        this.render();
    }

    render() {
        if (!this.originalTexture) return;
        const gl = this.gl;

        // PASS 1: Base (Light & Color)
        gl.useProgram(this.baseProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.baseFbo);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.bindQuad(this.baseProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(this.baseLocs['u_image'], 0);
        ['u_exposure', 'u_brightness', 'u_contrast', 'u_cinematic_contrast', 'u_highlights', 'u_shadows', 'u_whites', 'u_blacks', 'u_saturation', 'u_cinematic_saturation', 'u_vibrance', 'u_temperature', 'u_tint', 'u_shadow_toe', 'u_highlight_shoulder'].forEach(name => {
            const val = this.bypassed ? 0.0 : this.state[name];
            gl.uniform1f(this.baseLocs[name], val);
        });
        
        gl.uniform3f(this.baseLocs['u_lift'], 
            this.bypassed ? 0.0 : this.state['u_lift'][0], 
            this.bypassed ? 0.0 : this.state['u_lift'][1], 
            this.bypassed ? 0.0 : this.state['u_lift'][2]);
            
        gl.uniform3f(this.baseLocs['u_gamma'], 
            this.bypassed ? 1.0 : this.state['u_gamma'][0], 
            this.bypassed ? 1.0 : this.state['u_gamma'][1], 
            this.bypassed ? 1.0 : this.state['u_gamma'][2]);
            
        gl.uniform3f(this.baseLocs['u_gain'], 
            this.bypassed ? 1.0 : this.state['u_gain'][0], 
            this.bypassed ? 1.0 : this.state['u_gain'][1], 
            this.bypassed ? 1.0 : this.state['u_gain'][2]);
            
        if (this.baseLocs['u_hsl_shifts']) {
            if (this.bypassed) {
                gl.uniform3fv(this.baseLocs['u_hsl_shifts'], new Float32Array(24));
            } else {
                gl.uniform3fv(this.baseLocs['u_hsl_shifts'], this.state['u_hsl_shifts'] || new Float32Array(24));
            }
        }
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 2: Blur (Quarter Res)
        gl.useProgram(this.blurProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbo);
        gl.viewport(0, 0, this.blurW, this.blurH);
        this.bindQuad(this.blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.blurLocs['u_image'], 0);
        gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / this.blurW, 1.0 / this.blurH);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 3: Composite (Details & LUT)
        gl.useProgram(this.compositeProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.bindQuad(this.compositeProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.compLocs['u_baseImage'], 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
        gl.uniform1i(this.compLocs['u_blurImage'], 1);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_3D, this.lutTexture || this.originalTexture);
        gl.uniform1i(this.compLocs['u_lut3d'], 2);

        gl.uniform2f(this.compLocs['u_texelSize'], 1.0 / this.canvas.width, 1.0 / this.canvas.height);
        gl.uniform1f(this.compLocs['u_sharpness'], this.bypassed ? 0.0 : this.state['u_sharpness']);
        gl.uniform1f(this.compLocs['u_clarity'], this.bypassed ? 0.0 : this.state['u_clarity']);
        
        // Only apply LUT intensity if a LUT is actually loaded, and not bypassed
        const lutInt = (this.lutTexture && !this.bypassed) ? this.state['u_lut_intensity'] : 0.0;
        gl.uniform1f(this.compLocs['u_lut_intensity'], lutInt);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}
