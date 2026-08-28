with open('engine.js', 'r') as f:
    text = f.read()

# 1. Add u_hsl_shifts to fsBaseSource uniforms
uniform_block = """    uniform vec3 u_lift;
    uniform vec3 u_gamma;
    uniform vec3 u_gain;
    uniform float u_saturation;
    uniform float u_vibrance;"""
    
new_uniform_block = """    uniform vec3 u_lift;
    uniform vec3 u_gamma;
    uniform vec3 u_gain;
    uniform float u_saturation;
    uniform float u_vibrance;
    
    uniform float u_hsl_shifts[24];"""

text = text.replace(uniform_block, new_uniform_block)

# 2. Add rgb2hsl and hsl2rgb helpers
helpers = """    float evalSpline(float x_val) {"""
new_helpers = """    vec3 rgb2hsl(vec3 c) {
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

    float evalSpline(float x_val) {"""

text = text.replace(helpers, new_helpers)

# 3. Add logic in main()
main_logic = """        // --- Spline Curve ---
        color.r = evalSpline(color.r);
        color.g = evalSpline(color.g);
        color.b = evalSpline(color.b);
        
        // --- Saturation & Vibrance ---"""

new_main_logic = """        // --- Spline Curve ---
        color.r = evalSpline(color.r);
        color.g = evalSpline(color.g);
        color.b = evalSpline(color.b);
        
        // --- 8-Band Color Mix (HSL) ---
        vec3 hsl = rgb2hsl(color.rgb);
        float h = hsl.x; // [0, 1]
        
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
        
        float d1, range;
        if (idx1 == 7) {
            range = 1.0 - centers[7];
            if (h >= centers[7]) {
                d1 = h - centers[7];
            } else {
                d1 = h + (1.0 - centers[7]);
            }
        } else {
            range = centers[idx2] - centers[idx1];
            d1 = h - centers[idx1];
        }
        
        float t = d1 / range;
        t = smoothstep(0.0, 1.0, t);
        
        float w1 = 1.0 - t;
        float w2 = t;
        
        float shift_h = w1 * u_hsl_shifts[idx1*3] + w2 * u_hsl_shifts[idx2*3];
        float shift_s = w1 * u_hsl_shifts[idx1*3+1] + w2 * u_hsl_shifts[idx2*3+1];
        float shift_l = w1 * u_hsl_shifts[idx1*3+2] + w2 * u_hsl_shifts[idx2*3+2];
        
        hsl.x = fract(hsl.x + shift_h * 0.125 + 1.0); // +1.0 ensures positive before fract
        hsl.y = clamp(hsl.y + shift_s, 0.0, 1.0);
        hsl.z = clamp(hsl.z + shift_l, 0.0, 1.0);
        
        color.rgb = hsl2rgb(hsl);
        
        // --- Saturation & Vibrance ---"""

text = text.replace(main_logic, new_main_logic)

# 4. Add uniform location in initShaders
init_shaders = """        this.baseLocs['u_saturation'] = gl.getUniformLocation(this.baseProgram, 'u_saturation');
        this.baseLocs['u_vibrance'] = gl.getUniformLocation(this.baseProgram, 'u_vibrance');"""

new_init_shaders = """        this.baseLocs['u_saturation'] = gl.getUniformLocation(this.baseProgram, 'u_saturation');
        this.baseLocs['u_vibrance'] = gl.getUniformLocation(this.baseProgram, 'u_vibrance');
        this.baseLocs['u_hsl_shifts'] = gl.getUniformLocation(this.baseProgram, 'u_hsl_shifts');"""

text = text.replace(init_shaders, new_init_shaders)

# 5. Bind uniform in renderSingleLayerState
bind_uniforms = """        gl.uniform1f(this.baseLocs['u_vibrance'], vibVal);"""

new_bind_uniforms = """        gl.uniform1f(this.baseLocs['u_vibrance'], vibVal);
        
        const hslShifts = this.bypassed ? new Float32Array(24) : (state['u_hsl_shifts'] || new Float32Array(24));
        gl.uniform1fv(this.baseLocs['u_hsl_shifts'], hslShifts);"""

text = text.replace(bind_uniforms, new_bind_uniforms)

with open('engine.js', 'w') as f:
    f.write(text)
