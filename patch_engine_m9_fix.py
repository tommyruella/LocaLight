with open('engine.js', 'r') as f:
    text = f.read()

main_logic = """        // Reapply Luma (color preserving)
        float scale = l_out / safe_l_in;
        color.rgb *= scale;
        
        // --- Saturation & Vibrance ---"""

new_main_logic = """        // Reapply Luma (color preserving)
        float scale = l_out / safe_l_in;
        color.rgb *= scale;
        
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
        
        hsl.x = fract(hsl.x + shift_h * 0.125 + 1.0);
        hsl.y = clamp(hsl.y + shift_s, 0.0, 1.0);
        hsl.z = clamp(hsl.z + shift_l, 0.0, 1.0);
        
        color.rgb = hsl2rgb(hsl);
        
        // --- Saturation & Vibrance ---"""

if main_logic in text:
    text = text.replace(main_logic, new_main_logic)
    print("PATCH APPLIED SUCCESSFULLY!")
else:
    print("WARNING: Could not find main_logic block.")

with open('engine.js', 'w') as f:
    f.write(text)
