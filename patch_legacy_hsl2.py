import re
with open('engine.js', 'r') as f:
    content = f.read()

# Add uniform to fsBaseSource
c1 = r'uniform int u_is_srgb_input;'
c2 = r'uniform int u_is_srgb_input;\n    uniform int u_pipelineVersion;'
content = re.sub(c1, c2, content)

# Modify color mix block to branch on version
c4 = r'// 1\. Hue Rotation\n\s*if \(shift_h != 0\.0\) \{[\s\S]*?\}'
c5 = r"""if (u_pipelineVersion == 1) {
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
        }"""
content = re.sub(c4, c5, content)

# Pass u_pipelineVersion to baseProgram
c6 = r'this\.baseLocs\[\'u_is_srgb_input\'\] = gl\.getUniformLocation\(this\.baseProgram, \'u_is_srgb_input\'\);'
c7 = r"this.baseLocs['u_is_srgb_input'] = gl.getUniformLocation(this.baseProgram, 'u_is_srgb_input');\n        this.baseLocs['u_pipelineVersion'] = gl.getUniformLocation(this.baseProgram, 'u_pipelineVersion');"
content = re.sub(c6, c7, content)

c8 = r'gl\.uniform1i\(this\.baseLocs\[\'u_is_srgb_input\'\], isSrgbInput \? 1 : 0\);'
c9 = r"gl.uniform1i(this.baseLocs['u_is_srgb_input'], isSrgbInput ? 1 : 0);\n        gl.uniform1i(this.baseLocs['u_pipelineVersion'], this.pipelineVersion || 2);"
content = re.sub(c8, c9, content)

with open('engine.js', 'w') as f:
    f.write(content)
