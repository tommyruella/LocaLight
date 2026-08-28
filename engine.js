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
        this.haloExtTexture = null;
        this.haloExtFbo = null;
        this.haloBlurTexture = null;
        this.haloBlurFbo = null;
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
            u_grain: 0.0,
            u_noise: 0.0,
            u_halation: 0.0,
            u_glow: 0.0,
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
        
        const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const maxRb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        const maxVp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
        this.limits = {
            maxTex: maxTex,
            maxRb: maxRb,
            maxVp: Math.min(maxVp[0], maxVp[1])
        };
        this.limits.tLimit = Math.min(this.limits.maxTex, this.limits.maxRb, this.limits.maxVp);
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
    ${GLSL_COLOR_SPACE}
    in vec2 v_texCoord;
    uniform sampler2D u_image;
    out vec4 outColor;
    
    uniform float u_exposure;
    uniform vec3 u_wb_scale;
    uniform int u_is_srgb_input;
    uniform int u_pipelineVersion;
    
    uniform float u_spline_x[5];
    uniform float u_spline_y[5];
    uniform float u_spline_m[5];
    
    uniform vec3 u_lift;
    uniform vec3 u_gamma;
    uniform vec3 u_gain;
    uniform float u_saturation;
    uniform float u_vibrance;
    
    uniform float u_hsl_shifts[24];

    vec3 rgb2hsl(vec3 c) {
        float cMin = min(min(c.r, c.g), c.b);
        float cMax = max(max(c.r, c.g), c.b);
        float l = (cMax + cMin) / 2.0;
        float s = 0.0;
        float h = 0.0;
        if (cMax != cMin) {
            float delta = cMax - cMin;
            s = l > 0.5 ? delta / (2.0 - cMax - cMin) : delta / (cMax + cMin);
            if (cMax == c.r) {
                h = (c.g - c.b) / delta + (c.g < c.b ? 6.0 : 0.0);
            } else if (cMax == c.g) {
                h = (c.b - c.r) / delta + 2.0;
            } else {
                h = (c.r - c.g) / delta + 4.0;
            }
            h /= 6.0;
        }
        return vec3(h, s, l);
    }

    float hue2rgb(float p, float q, float t) {
        if (t < 0.0) t += 1.0;
        if (t > 1.0) t -= 1.0;
        if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
        if (t < 1.0/2.0) return q;
        if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
        return p;
    }

    vec3 hsl2rgb(vec3 c) {
        float h = c.x;
        float s = c.y;
        float l = c.z;
        if (s == 0.0) {
            return vec3(l, l, l);
        } else {
            float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
            float p = 2.0 * l - q;
            return vec3(
                hue2rgb(p, q, h + 1.0/3.0),
                hue2rgb(p, q, h),
                hue2rgb(p, q, h - 1.0/3.0)
            );
        }
    }

    
    float getHue(vec3 c) {
        float cMax = max(c.r, max(c.g, c.b));
        float cMin = min(c.r, min(c.g, c.b));
        float delta = cMax - cMin;
        if (delta == 0.0) return 0.0;
        float h = 0.0;
        if (cMax == c.r) {
            h = (c.g - c.b) / delta + (c.g < c.b ? 6.0 : 0.0);
        } else if (cMax == c.g) {
            h = (c.b - c.r) / delta + 2.0;
        } else {
            h = (c.r - c.g) / delta + 4.0;
        }
        return h / 6.0;
    }

    mat3 axisRotation(vec3 axis, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;
        return mat3(
            oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
            oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
            oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
        );
    }

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
            color.rgb = linearizeSRGB(color.rgb);
        }

                const mat3 M_SRGB_TO_LMS = mat3(
            0.422725, 0.055700, 0.021383,
            0.491345, 0.961534, 0.087642,
            0.027358, 0.023184, 0.980508
        );
        // Correct Inverse of M_SRGB_TO_LMS
        const mat3 M_LMS_TO_SRGB = mat3(
            2.538045, -0.146004, -0.042299,
            -1.293277, 1.116648, -0.071607,
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
        
        // --- 8-Band Color Mix (Scene Linear) ---
        float h = getHue(color.rgb);
        
        float centers[8];
        centers[0] = 0.0;         // Red
        centers[1] = 30.0/360.0;  // Orange
        centers[2] = 60.0/360.0;  // Yellow
        centers[3] = 120.0/360.0; // Green
        centers[4] = 180.0/360.0; // Aqua
        centers[5] = 240.0/360.0; // Blue
        centers[6] = 270.0/360.0; // Purple
        centers[7] = 300.0/360.0; // Magenta
        
        int idx1 = 7;
        int idx2 = 0;
        for (int i = 0; i < 7; i++) {
            if (h >= centers[i] && h < centers[i+1]) {
                idx1 = i;
                idx2 = i+1;
                break;
            }
        }
        
        float d1, range_h;
        if (idx1 == 7) {
            range_h = 1.0 - centers[7];
            if (h >= centers[7]) {
                d1 = h - centers[7];
            } else {
                d1 = h + (1.0 - centers[7]);
            }
        } else {
            range_h = centers[idx2] - centers[idx1];
            d1 = h - centers[idx1];
        }
        
        float t = d1 / range_h;
        t = smoothstep(0.0, 1.0, t);
        
        float w1 = 1.0 - t;
        float w2 = t;
        
        float shift_h = w1 * u_hsl_shifts[idx1*3] + w2 * u_hsl_shifts[idx2*3];
        float shift_s = w1 * u_hsl_shifts[idx1*3+1] + w2 * u_hsl_shifts[idx2*3+1];
        float shift_l = w1 * u_hsl_shifts[idx1*3+2] + w2 * u_hsl_shifts[idx2*3+2];
        
        // Apply shifts in RGB
        if (u_pipelineVersion == 1) {
            // Legacy M11 HSL Mix (Clips HDR)
            vec3 hsl = rgb2hsl(color.rgb);
            hsl.x = fract(hsl.x + shift_h * 0.125 + 1.0);
            hsl.y = clamp(hsl.y + shift_s, 0.0, 1.0);
            hsl.z = clamp(hsl.z + shift_l, 0.0, 1.0);
            color.rgb = hsl2rgb(hsl);
        } else {
            // M12 Linear Mix (HDR safe)
            if (shift_h != 0.0) {
                mat3 rot = axisRotation(normalize(vec3(1.0, 1.0, 1.0)), shift_h * 3.14159);
                color.rgb = rot * color.rgb;
            }
            if (shift_s != 0.0) {
                float curLuma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
                color.rgb = mix(vec3(curLuma), color.rgb, max(1.0 + shift_s, 0.0));
            }
            if (shift_l != 0.0) {
                color.rgb *= exp2(shift_l);
            }
        }
        // 2. Saturation
        if (shift_s != 0.0) {
            float curLuma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            color.rgb = mix(vec3(curLuma), color.rgb, max(1.0 + shift_s, 0.0));
        }
        // 3. Lightness
        if (shift_l != 0.0) {
            color.rgb *= exp2(shift_l);
        }

        
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

        
        const fsHaloExtSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_image;
        uniform int u_pipelineVersion;
        out vec4 outColor;
        
        void main() {
            vec4 color = texture(u_image, v_texCoord);
            float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            float threshold = 0.8;
            float mask = max(luma - threshold, 0.0);
            outColor = vec4(color.rgb * mask, 1.0);
        }`;

        const fsBlurSource = `#version 300 es
        precision mediump float;
        in vec2 v_texCoord;
        uniform sampler2D u_image;
        uniform int u_pipelineVersion;
        uniform vec2 u_texelSize;
        uniform float u_spatialScale;
        out vec4 outColor;
        
        void main() {
            vec4 color = vec4(0.0);
            vec2 off = u_texelSize * u_spatialScale * 1.5;
            
            color += texture(u_image, v_texCoord + vec2(-off.x, -off.y)) * 0.0625;
            color += texture(u_image, v_texCoord + vec2(0.0, -off.y)) * 0.125;
            color += texture(u_image, v_texCoord + vec2(off.x, -off.y)) * 0.0625;
            
            color += texture(u_image, v_texCoord + vec2(-off.x, 0.0)) * 0.125;
            color += texture(u_image, v_texCoord) * 0.25;
            color += texture(u_image, v_texCoord + vec2(off.x, 0.0)) * 0.125;
            
            color += texture(u_image, v_texCoord + vec2(-off.x, off.y)) * 0.0625;
            color += texture(u_image, v_texCoord + vec2(0.0, off.y)) * 0.125;
            color += texture(u_image, v_texCoord + vec2(off.x, off.y)) * 0.0625;
            
            outColor = color;
        }`;

        const fsCompositeSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_baseImage;
        uniform sampler2D u_blurImage;
        uniform sampler2D u_haloBlurImage;
        uniform vec2 u_texelSize;
        uniform float u_spatialScale;
        
        uniform float u_sharpness;
        uniform float u_clarity;
        uniform float u_halation;
        uniform float u_grain;
        uniform float u_noise;
        uniform float u_glow;
        
        out vec4 outColor;
        
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        void main() {
            vec4 base = texture(u_baseImage, v_texCoord);
            vec4 blur = texture(u_blurImage, v_texCoord);
            
                        
            if (u_clarity != 0.0) {
                base.rgb += u_clarity * (base.rgb - blur.rgb);
            }
            
            if (u_halation > 0.0) {
                vec3 halo = texture(u_haloBlurImage, v_texCoord).rgb;
                base.rgb += u_halation * halo * 2.0;
            }
            
            if (u_glow > 0.0) {
                base.rgb += u_glow * blur.rgb;
            }
            
                        
            if (u_noise > 0.0) {
                float noiseVal = (hash(v_texCoord * 42.0) - 0.5) * 2.0;
                base.rgb += u_noise * noiseVal * 0.1;
            }
            
            outColor = base;
        }`;

        const fsBlendSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        out vec4 outColor;
        
        uniform sampler2D u_base;
        uniform sampler2D u_layer;
        uniform float u_opacity;
        uniform int u_blendMode;
        uniform int u_pipelineVersion;
        
        void main() {
            vec3 base = texture(u_base, v_texCoord).rgb;
            vec3 layer = texture(u_layer, v_texCoord).rgb;
            vec3 blended = base;
            
            if (u_blendMode == 0) {
                blended = layer;
            } else if (u_blendMode == 1) { // Multiply
                blended = base * layer;
            } else if (u_blendMode == 2) {
                if (u_pipelineVersion == 1) {
                    blended = 1.0 - (1.0 - base) * (1.0 - layer);
                } else {
                    blended = base + layer; // M12 Additive
                }
            } else if (u_blendMode == 3) {
                if (u_pipelineVersion == 1) {
                    // M11 Overlay
                    blended = vec3(
                        base.r < 0.5 ? (2.0 * base.r * layer.r) : (1.0 - 2.0 * (1.0 - base.r) * (1.0 - layer.r)),
                        base.g < 0.5 ? (2.0 * base.g * layer.g) : (1.0 - 2.0 * (1.0 - base.g) * (1.0 - layer.g)),
                        base.b < 0.5 ? (2.0 * base.b * layer.b) : (1.0 - 2.0 * (1.0 - base.b) * (1.0 - layer.b))
                    );
                } else {
                    blended = base * (base + layer) / (base + 0.18); // M12 Linear HDR
                }
            }
            
            outColor = vec4(mix(base, blended, u_opacity), 1.0);
        }`;

        const fsOutputSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        
        uniform sampler2D u_image;
        uniform float u_sharpness;
        uniform float u_grain;
        uniform vec2 u_texelSize;
        uniform float u_spatialScale;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        uniform int u_pipelineVersion;
        
        // 3D LUT
        uniform highp sampler3D u_lut;
        uniform float u_lut_intensity;
        uniform float u_lut_size;
        
        out vec4 outColor;
        
        ${GLSL_COLOR_SPACE}

        vec3 PBRNeutralToneMapping(vec3 color) {
            const float startCompression = 0.8 - 0.04;
            const float desaturation = 0.15;
            vec3 c = max(color, vec3(0.0));
            float x = min(c.r, min(c.g, c.b));
            float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
            c -= offset;
            float peak = max(c.r, max(c.g, c.b));
            if (peak < startCompression) return c;
            const float d = 1.0 - startCompression;
            float newPeak = 1.0 - d * d / (peak + d - startCompression);
            c *= newPeak / peak;
            float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
            return mix(c, newPeak * vec3(1, 1, 1), g);
        }

        void main() {
            vec3 color = texture(u_image, v_texCoord).rgb;
            
            // Khronos PBR Neutral Tone Mapper (M12)
            vec3 c = color;
            if (u_pipelineVersion == 1) {
                c = clamp(c, 0.0, 1.0);
            } else {
                c = PBRNeutralToneMapping(c);
            }
            
            // Display Effects (Sharpness after Tone Mapping)
            if (u_sharpness != 0.0) {
                vec3 n, s, e, w;
                if (u_pipelineVersion == 1) {
                    n = clamp(texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y * u_spatialScale)).rgb, 0.0, 1.0);
                    s = clamp(texture(u_image, v_texCoord + vec2(0.0, -u_texelSize.y * u_spatialScale)).rgb, 0.0, 1.0);
                    e = clamp(texture(u_image, v_texCoord + vec2(u_texelSize.x * u_spatialScale, 0.0)).rgb, 0.0, 1.0);
                    w = clamp(texture(u_image, v_texCoord + vec2(-u_texelSize.x * u_spatialScale, 0.0)).rgb, 0.0, 1.0);
                } else {
                    n = PBRNeutralToneMapping(texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y * u_spatialScale)).rgb);
                    s = PBRNeutralToneMapping(texture(u_image, v_texCoord + vec2(0.0, -u_texelSize.y * u_spatialScale)).rgb);
                    e = PBRNeutralToneMapping(texture(u_image, v_texCoord + vec2(u_texelSize.x * u_spatialScale, 0.0)).rgb);
                    w = PBRNeutralToneMapping(texture(u_image, v_texCoord + vec2(-u_texelSize.x * u_spatialScale, 0.0)).rgb);
                }
                vec3 sharpBlur = (n + s + e + w) * 0.25;
                c += u_sharpness * (c - sharpBlur);
            }

            
            // Output Encoding (Linear -> sRGB)
            vec3 encoded = encodeSRGB(c);
            
            // Post-sRGB Effects (Grain)
            if (u_grain > 0.0) {
                float luma = dot(encoded, vec3(0.2126, 0.7152, 0.0722));
                float weight = 1.0 - abs(luma - 0.5) * 2.0; 
                float noiseVal = (hash(v_texCoord * 133.7) - 0.5) * 2.0;
                encoded += u_grain * noiseVal * weight * 0.15;
            }

            if (u_grain > 0.0) {
                float luma = dot(encoded, vec3(0.2126, 0.7152, 0.0722));
                float weight = 1.0 - abs(luma - 0.5) * 2.0; 
                float noiseVal = (hash(v_texCoord * 133.7) - 0.5) * 2.0;
                encoded += u_grain * noiseVal * weight * 0.15;
            }

            
            // --- 3D LUT in Display-Referred Space ---
            // Scale coords to sample voxel centers and avoid edge bleeding
            vec3 lutCoord = (encoded * (u_lut_size - 1.0) + 0.5) / u_lut_size;
            vec3 lutColor = texture(u_lut, lutCoord).rgb;
            
            encoded = mix(encoded, lutColor, u_lut_intensity);
            
            outColor = vec4(encoded, 1.0);
        }`;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const baseShader = this.compileShader(gl.FRAGMENT_SHADER, fsBaseSource);
        const haloExtShader = this.compileShader(gl.FRAGMENT_SHADER, fsHaloExtSource);
        const blurShader = this.compileShader(gl.FRAGMENT_SHADER, fsBlurSource);
        const compositeShader = this.compileShader(gl.FRAGMENT_SHADER, fsCompositeSource);
        const blendShader = this.compileShader(gl.FRAGMENT_SHADER, fsBlendSource);
        const outputShader = this.compileShader(gl.FRAGMENT_SHADER, fsOutputSource);

        this.baseProgram = this.createProgram(vertexShader, baseShader);
        this.haloExtProgram = this.createProgram(vertexShader, haloExtShader);
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
        this.blendLocs['u_pipelineVersion'] = gl.getUniformLocation(this.blendProgram, 'u_pipelineVersion');

        // Uniforms for Output Pass
        this.outputLocs = {};
        gl.useProgram(this.outputProgram);
        this.outputLocs['u_image'] = gl.getUniformLocation(this.outputProgram, 'u_image');
        this.outputLocs['u_pipelineVersion'] = gl.getUniformLocation(this.outputProgram, 'u_pipelineVersion');
        this.outputLocs['u_lut'] = gl.getUniformLocation(this.outputProgram, 'u_lut');
        this.outputLocs['u_lut_intensity'] = gl.getUniformLocation(this.outputProgram, 'u_lut_intensity');
        this.outputLocs['u_lut_size'] = gl.getUniformLocation(this.outputProgram, 'u_lut_size');
        this.outputLocs['u_sharpness'] = gl.getUniformLocation(this.outputProgram, 'u_sharpness');
        this.outputLocs['u_grain'] = gl.getUniformLocation(this.outputProgram, 'u_grain');
        this.outputLocs['u_texelSize'] = gl.getUniformLocation(this.outputProgram, 'u_texelSize');
        this.outputLocs['u_spatialScale'] = gl.getUniformLocation(this.outputProgram, 'u_spatialScale');
        this.outputLocs['u_lut'] = gl.getUniformLocation(this.outputProgram, 'u_lut');
        this.outputLocs['u_lut_intensity'] = gl.getUniformLocation(this.outputProgram, 'u_lut_intensity');
        this.outputLocs['u_lut_size'] = gl.getUniformLocation(this.outputProgram, 'u_lut_size');
        this.outputLocs['u_sharpness'] = gl.getUniformLocation(this.outputProgram, 'u_sharpness');
        this.outputLocs['u_grain'] = gl.getUniformLocation(this.outputProgram, 'u_grain');
        this.outputLocs['u_texelSize'] = gl.getUniformLocation(this.outputProgram, 'u_texelSize');
        this.outputLocs['u_spatialScale'] = gl.getUniformLocation(this.outputProgram, 'u_spatialScale');

        // Uniforms for Base Pass
        this.baseLocs = {};
        gl.useProgram(this.baseProgram);
        this.baseLocs['u_image'] = gl.getUniformLocation(this.baseProgram, 'u_image');
        this.baseLocs['u_is_srgb_input'] = gl.getUniformLocation(this.baseProgram, 'u_is_srgb_input');
        this.baseLocs['u_pipelineVersion'] = gl.getUniformLocation(this.baseProgram, 'u_pipelineVersion');
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
        this.baseLocs['u_hsl_shifts'] = gl.getUniformLocation(this.baseProgram, 'u_hsl_shifts');


        // Uniforms for Blur Pass
        this.blurLocs = {};
        gl.useProgram(this.blurProgram);
        this.blurLocs['u_image'] = gl.getUniformLocation(this.blurProgram, 'u_image');
        this.blurLocs['u_texelSize'] = gl.getUniformLocation(this.blurProgram, 'u_texelSize');
        this.blurLocs['u_spatialScale'] = gl.getUniformLocation(this.blurProgram, 'u_spatialScale');
        
        this.haloExtLocs = {};
        gl.useProgram(this.haloExtProgram);
        this.haloExtLocs['u_image'] = gl.getUniformLocation(this.haloExtProgram, 'u_image');


        // Uniforms for Composite Pass
        this.compLocs = {};
        gl.useProgram(this.compositeProgram);
        this.compLocs['u_baseImage'] = gl.getUniformLocation(this.compositeProgram, 'u_baseImage');
        this.compLocs['u_blurImage'] = gl.getUniformLocation(this.compositeProgram, 'u_blurImage');
        this.compLocs['u_haloBlurImage'] = gl.getUniformLocation(this.compositeProgram, 'u_haloBlurImage');
        this.compLocs['u_texelSize'] = gl.getUniformLocation(this.compositeProgram, 'u_texelSize');
        this.compLocs['u_spatialScale'] = gl.getUniformLocation(this.compositeProgram, 'u_spatialScale');
        this.compLocs['u_sharpness'] = gl.getUniformLocation(this.compositeProgram, 'u_sharpness');
        this.compLocs['u_clarity'] = gl.getUniformLocation(this.compositeProgram, 'u_clarity');
        this.compLocs['u_halation'] = gl.getUniformLocation(this.compositeProgram, 'u_halation');
        this.compLocs['u_grain'] = gl.getUniformLocation(this.compositeProgram, 'u_grain');
        this.compLocs['u_noise'] = gl.getUniformLocation(this.compositeProgram, 'u_noise');
        this.compLocs['u_glow'] = gl.getUniformLocation(this.compositeProgram, 'u_glow');
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
        const dummyData = new Float32Array([1.0, 1.0, 1.0, 1.0]);
        // dummyLut as RGBA16F to match lutTexture format
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, 1, 1, 1, 0, gl.RGBA, gl.FLOAT, dummyData);
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

    ensureFBOs(w, h) {
        const gl = this.gl;
        if (this.fboW === w && this.fboH === h) return;
        
        this.fboW = w;
        this.fboH = h;
        
        const baseW = w;
        const baseH = h;
        const blurW = Math.max(1, Math.floor(baseW / 4));
        const blurH = Math.max(1, Math.floor(baseH / 4));

        if (this.baseTexture) gl.deleteTexture(this.baseTexture);
        if (this.baseFbo) gl.deleteFramebuffer(this.baseFbo);
        const base = this.createFboAndTexture(baseW, baseH, true);
        this.pipelineFloatPrecision = base.isFloat ? 16 : 8;
        this.baseTexture = base.tex;
        this.baseFbo = base.fbo;

        if (this.blurTexture) gl.deleteTexture(this.blurTexture);
        if (this.blurFbo) gl.deleteFramebuffer(this.blurFbo);
        const blur = this.createFboAndTexture(blurW, blurH, true);
        this.blurTexture = blur.tex;
        this.blurFbo = blur.fbo;
        
        if (this.haloExtTexture) gl.deleteTexture(this.haloExtTexture);
        if (this.haloExtFbo) gl.deleteFramebuffer(this.haloExtFbo);
        const hext = this.createFboAndTexture(blurW, blurH, true);
        this.haloExtTexture = hext.tex;
        this.haloExtFbo = hext.fbo;
        
        if (this.haloBlurTexture) gl.deleteTexture(this.haloBlurTexture);
        if (this.haloBlurFbo) gl.deleteFramebuffer(this.haloBlurFbo);
        const hblur = this.createFboAndTexture(blurW, blurH, true);
        this.haloBlurTexture = hblur.tex;
        this.haloBlurFbo = hblur.fbo;

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
    }


    export() {
        const gl = this.gl;
        if (!this.originalTexture || !this.ingestW || !this.ingestH) return null;
        
        // Deep clone state to ensure it wasn't mutated
                const deepCloneState = (obj) => {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Float32Array) return new Float32Array(obj);
            if (Array.isArray(obj)) return obj.map(deepCloneState);
            const clone = {};
            for (let k in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, k)) {
                    clone[k] = deepCloneState(obj[k]);
                }
            }
            return clone;
        };
        const S_before = deepCloneState(this.state);
        
        // Snapshot GL state
        const GL_before = {
            viewport: gl.getParameter(gl.VIEWPORT),
            scissorBox: gl.getParameter(gl.SCISSOR_BOX),
            scissorTest: gl.getParameter(gl.SCISSOR_TEST),
            drawFbo: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
            readFbo: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
            rbo: gl.getParameter(gl.RENDERBUFFER_BINDING),
            prog: gl.getParameter(gl.CURRENT_PROGRAM),
            activeTex: gl.getParameter(gl.ACTIVE_TEXTURE),
            tex2D: gl.getParameter(gl.TEXTURE_BINDING_2D),
            packAlign: gl.getParameter(gl.PACK_ALIGNMENT)
        };
        
        // We render to ingest resolution
        const W_exp = this.ingestW;
        const H_exp = this.ingestH;
        
        // Offscreen export FBO
        let exportTex = null;
        let exportFbo = null;
        let pixels = null;
        
        try {
            const expObj = this.createFboAndTexture(W_exp, H_exp, false);
            exportTex = expObj.tex;
            exportFbo = expObj.fbo;
            
            this.render(null, W_exp, H_exp, exportFbo);
            
            pixels = new Uint8Array(W_exp * H_exp * 4);
            gl.bindFramebuffer(gl.FRAMEBUFFER, exportFbo);
            gl.readPixels(0, 0, W_exp, H_exp, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            
            // FBO incomplete exception will jump to catch.
        } finally {
            if (exportFbo) gl.deleteFramebuffer(exportFbo);
            if (exportTex) gl.deleteTexture(exportTex);
            
            // Restore GL State
            if (!GL_before.readFbo || gl.isFramebuffer(GL_before.readFbo)) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, GL_before.readFbo);
            if (!GL_before.drawFbo || gl.isFramebuffer(GL_before.drawFbo)) gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, GL_before.drawFbo);
            if (!GL_before.rbo || gl.isRenderbuffer(GL_before.rbo)) gl.bindRenderbuffer(gl.RENDERBUFFER, GL_before.rbo);
            gl.useProgram(GL_before.prog);
            gl.activeTexture(GL_before.activeTex);
            if (!GL_before.tex2D || gl.isTexture(GL_before.tex2D)) gl.bindTexture(gl.TEXTURE_2D, GL_before.tex2D);
            gl.pixelStorei(gl.PACK_ALIGNMENT, GL_before.packAlign);
            
            if (GL_before.scissorTest) gl.enable(gl.SCISSOR_TEST);
            else gl.disable(gl.SCISSOR_TEST);
            
            if (GL_before.scissorBox) {
                gl.scissor(GL_before.scissorBox[0], GL_before.scissorBox[1], GL_before.scissorBox[2], GL_before.scissorBox[3]);
            }
            if (GL_before.viewport) {
                gl.viewport(GL_before.viewport[0], GL_before.viewport[1], GL_before.viewport[2], GL_before.viewport[3]);
            }
            
            // Force re-render to preview
            this.ensureFBOs(this.canvas.width, this.canvas.height);
            this.render(null, this.canvas.width, this.canvas.height, null);
            
            // Re-assign identical snapshot (if modified, the caller/test will catch it)
            // this.state = S_before; removed to prove non-mutation
        }
        
        return { width: W_exp, height: H_exp, pixels: pixels };
    }

    loadImage(imageElement) {
        const gl = this.gl;
        
        const srcW = imageElement.width || imageElement.videoWidth || 1;
        const srcH = imageElement.height || imageElement.videoHeight || 1;
        
        const ingest = LocalLightEngine.calculateIngestionSize(srcW, srcH, this.limits.tLimit);
        this.ingestW = ingest.w;
        this.ingestH = ingest.h;
        
        // App.js should manage canvas size. If it didn't, set a safe default.
        if (this.canvas.width === 0 || this.canvas.width === 300) {
            this.canvas.width = this.ingestW;
            this.canvas.height = this.ingestH;
        }
        
        if (this.originalTexture) gl.deleteTexture(this.originalTexture);
        this.originalTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        if (srcW !== ingest.w || srcH !== ingest.h) {
            const tmp = document.createElement('canvas');
            tmp.width = ingest.w;
            tmp.height = ingest.h;
            const ctx = tmp.getContext('2d');
            ctx.drawImage(imageElement, 0, 0, ingest.w, ingest.h);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tmp);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageElement);
        }

        this.ensureFBOs(this.canvas.width, this.canvas.height);
        this.render();
    }


    static calculateIngestionSize(w, h, limit) {
        const scale = Math.min(1.0, limit / Math.max(w, h));
        return {
            w: Math.max(1, Math.floor(w * scale)),
            h: Math.max(1, Math.floor(h * scale))
        };
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

    renderSingleLayerState(state, targetFbo, inputTexture, targetW, targetH, spatialScale) {
        const gl = this.gl;
        
        // PASS 1: Base (Exposure)
        gl.useProgram(this.baseProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.baseFbo); this.checkFBO();
        gl.viewport(0, 0, targetW, targetH);
        this.bindQuad(this.baseProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture || this.originalTexture);
        gl.uniform1i(this.baseLocs['u_image'], 0);
        
        const isSrgbInput = (inputTexture === this.originalTexture) || !inputTexture;
        gl.uniform1i(this.baseLocs['u_is_srgb_input'], isSrgbInput ? 1 : 0);
        gl.uniform1i(this.baseLocs['u_pipelineVersion'], this.pipelineVersion || 2);
        
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
        
        const hslShifts = this.bypassed ? new Float32Array(24) : (state['u_hsl_shifts'] || new Float32Array(24));
        gl.uniform1fv(this.baseLocs['u_hsl_shifts'], hslShifts);
        
        const liftVal = this.bypassed ? [0,0,0] : (state['u_lift'] !== undefined ? state['u_lift'] : (this.state['u_lift'] || [0,0,0]));
        const gammaVal = this.bypassed ? [1,1,1] : (state['u_gamma'] !== undefined ? state['u_gamma'] : (this.state['u_gamma'] || [1,1,1]));
        const gainVal = this.bypassed ? [1,1,1] : (state['u_gain'] !== undefined ? state['u_gain'] : (this.state['u_gain'] || [1,1,1]));
        
        gl.uniform3fv(this.baseLocs['u_lift'], liftVal);
        gl.uniform3fv(this.baseLocs['u_gamma'], gammaVal);
        gl.uniform3fv(this.baseLocs['u_gain'], gainVal);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 2: Blur (9-tap Gaussian)
        gl.useProgram(this.blurProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbo); this.checkFBO();
        gl.viewport(0, 0, this.blurW, this.blurH);
        this.bindQuad(this.blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.blurLocs['u_image'], 0);
        gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / this.blurW, 1.0 / this.blurH);
        gl.uniform1f(this.blurLocs['u_spatialScale'], spatialScale);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 2b: Halation Extractor
        gl.useProgram(this.haloExtProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.haloExtFbo); this.checkFBO();
        gl.viewport(0, 0, this.blurW, this.blurH);
        this.bindQuad(this.haloExtProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.haloExtLocs['u_image'], 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // PASS 2c: Halation Blur
        gl.useProgram(this.blurProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.haloBlurFbo); this.checkFBO();
        gl.viewport(0, 0, this.blurW, this.blurH);
        this.bindQuad(this.blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.haloExtTexture);
        gl.uniform1i(this.blurLocs['u_image'], 0);
        gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / this.blurW, 1.0 / this.blurH);
        gl.uniform1f(this.blurLocs['u_spatialScale'], spatialScale * 2.0); // Halation is usually a broader blur
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 3: Composite (M10 Effects)

        gl.useProgram(this.compositeProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
        gl.viewport(0, 0, targetW, targetH);
        this.bindQuad(this.compositeProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.compLocs['u_baseImage'], 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
        gl.uniform1i(this.compLocs['u_blurImage'], 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.haloBlurTexture);
        gl.uniform1i(this.compLocs['u_haloBlurImage'], 2);
        
        gl.uniform2f(this.compLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);
        gl.uniform1f(this.compLocs['u_spatialScale'], spatialScale);
        
        const safeVal = (name) => this.bypassed ? 0.0 : (state[name] !== undefined ? state[name] : (this.state[name] || 0.0));
        
        gl.uniform1f(this.compLocs['u_sharpness'], safeVal('u_sharpness'));
        gl.uniform1f(this.compLocs['u_clarity'], safeVal('u_clarity'));
        gl.uniform1f(this.compLocs['u_halation'], safeVal('u_halation'));
        gl.uniform1f(this.compLocs['u_grain'], safeVal('u_grain'));
        gl.uniform1f(this.compLocs['u_noise'], safeVal('u_noise'));
        gl.uniform1f(this.compLocs['u_glow'], safeVal('u_glow'));
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }


    checkFBO() {
        const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
        if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
            throw new Error("Framebuffer incomplete. Status: " + status);
        }
    }

    render(layersArray = null, targetW = this.canvas.width, targetH = this.canvas.height, targetFBO = null) {
        if (!this.originalTexture) return;
        
        const gl = this.gl;
        
        this.ensureFBOs(targetW, targetH);
        const spatialScale = Math.max(targetW, targetH) / 1024.0;


        if (this.bypassed || !layersArray || layersArray.length === 0) {
            // Render directly into compAFbo, then output
            this.renderSingleLayerState(this.state, this.compAFbo, this.originalTexture, targetW, targetH, spatialScale);
            
            // Output to Canvas
            gl.useProgram(this.outputProgram);
            gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO); this.checkFBO();
            gl.viewport(0, 0, targetW, targetH);
            this.bindQuad(this.outputProgram);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.compATexture);
            gl.uniform1i(this.outputLocs['u_image'], 0);
            
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this.lutTexture || this.dummyLut);
            gl.uniform1i(this.outputLocs['u_lut'], 1);
            const pipelineVersion = this.pipelineVersion || 2;
            gl.uniform1i(this.outputLocs['u_pipelineVersion'], pipelineVersion);
            gl.uniform1f(this.outputLocs['u_lut_intensity'], 0.0);
            gl.uniform1f(this.outputLocs['u_lut_size'], this.lutSize || 1.0);
            let globalSharpness = 0.0;
            let globalGrain = 0.0;
            if (layersArray && layersArray.length > 0) {
                const active = layersArray.find(l => l.active) || layersArray[0];
                if (active.engineState) {
                    globalSharpness = active.engineState['u_sharpness'] || 0.0;
                    globalGrain = active.engineState['u_grain'] || 0.0;
                }
            } else if (!this.bypassed) {
                globalSharpness = this.state['u_sharpness'] || 0.0;
                globalGrain = this.state['u_grain'] || 0.0;
            }
            gl.uniform1f(this.outputLocs['u_sharpness'], globalSharpness);
            gl.uniform1f(this.outputLocs['u_grain'], globalGrain);
            gl.uniform2f(this.outputLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);
            gl.uniform1f(this.outputLocs['u_spatialScale'], spatialScale);
            
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
                this.renderSingleLayerState(es, currentCompFbo, this.originalTexture, targetW, targetH, spatialScale);
                firstVisible = false;
            } else {
                // For subsequent layers, render into this.layerFbo using currentCompTex as input
                this.renderSingleLayerState(layer.engineState || this.state, this.layerFbo, currentCompTex, targetW, targetH, spatialScale);
                
                // Blend currentCompTex and this.layerTexture into nextCompFbo
                gl.useProgram(this.blendProgram);
                gl.bindFramebuffer(gl.FRAMEBUFFER, nextCompFbo);
                gl.viewport(0, 0, targetW, targetH);
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
                gl.uniform1i(this.blendLocs['u_pipelineVersion'], this.pipelineVersion || 2);
                
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
            gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO); this.checkFBO();
            gl.viewport(0, 0, targetW, targetH);
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        } else {
            // Draw currentCompTex to Canvas using outputProgram (sRGB encode)
            gl.useProgram(this.outputProgram);
            gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO); this.checkFBO();
            gl.viewport(0, 0, targetW, targetH);
            this.bindQuad(this.outputProgram);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, currentCompTex);
            gl.uniform1i(this.outputLocs['u_image'], 0);
            
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this.lutTexture || this.dummyLut);
            gl.uniform1i(this.outputLocs['u_lut'], 1);
            const pipelineVersion = this.pipelineVersion || 2;
            gl.uniform1i(this.outputLocs['u_pipelineVersion'], pipelineVersion);
                        let globalIntensity = 0.0;
            if (layersArray && layersArray.length > 0) {
                const active = layersArray.find(l => l.active) || layersArray[0];
                if (active.engineState && active.engineState['u_lut_intensity'] !== undefined) {
                    globalIntensity = active.engineState['u_lut_intensity'];
                }
            }
            gl.uniform1f(this.outputLocs['u_lut_intensity'], globalIntensity);
            gl.uniform1f(this.outputLocs['u_lut_size'], this.lutSize || 1.0);
            let globalSharpness = 0.0;
            let globalGrain = 0.0;
            if (layersArray && layersArray.length > 0) {
                const active = layersArray.find(l => l.active) || layersArray[0];
                if (active.engineState) {
                    globalSharpness = active.engineState['u_sharpness'] || 0.0;
                    globalGrain = active.engineState['u_grain'] || 0.0;
                }
            } else if (!this.bypassed) {
                globalSharpness = this.state['u_sharpness'] || 0.0;
                globalGrain = this.state['u_grain'] || 0.0;
            }
            gl.uniform1f(this.outputLocs['u_sharpness'], globalSharpness);
            gl.uniform1f(this.outputLocs['u_grain'], globalGrain);
            gl.uniform2f(this.outputLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);
            gl.uniform1f(this.outputLocs['u_spatialScale'], spatialScale);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }
}
