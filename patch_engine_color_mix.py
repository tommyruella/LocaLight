import re

with open('engine.js', 'r') as f:
    content = f.read()

# Add getHue and axisRotation
glsl_helpers = """
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
"""

content = re.sub(r'float evalSpline\(', glsl_helpers + '\n    float evalSpline(', content)

# Remove rgb2hsl and hsl2rgb
content = re.sub(r'\s*vec3 rgb2hsl.*?vec3 hsl2rgb\(vec3 c\) \{[\s\S]*?\}\n', '', content)

# Replace the HSL block inside main
match_hsl_block = r'// --- 8-Band Color Mix \(HSL\) ---[\s\S]*?color\.rgb = hsl2rgb\(hsl\);'
replace_hsl_block = """// --- 8-Band Color Mix (Scene Linear) ---
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
        // 1. Hue Rotation
        if (shift_h != 0.0) {
            mat3 rot = axisRotation(normalize(vec3(1.0, 1.0, 1.0)), shift_h * 3.14159);
            color.rgb = rot * color.rgb;
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
"""
content = re.sub(match_hsl_block, replace_hsl_block, content)

with open('engine.js', 'w') as f:
    f.write(content)
