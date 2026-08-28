import re

with open('engine.js', 'r') as f:
    content = f.read()

# Remove from fsCompSource (they might already be removed by patch_effects2.py? Let's check)
c1 = r'if \(u_sharpness != 0\.0\) \{[\s\S]*?base\.rgb \+= u_sharpness \* \(base\.rgb - sharpBlur\);\n\s*\}\n'
content = re.sub(c1, '', content)

c2 = r'if \(u_grain > 0\.0\) \{[\s\S]*?base\.rgb \+= u_grain \* noiseVal \* weight \* 0\.15;\n\s*\}\n'
content = re.sub(c2, '', content)

# Inject into fsOutputSource
c3 = r'vec3 c = color;\n\s*if \(u_pipelineVersion == 1\) \{[\s\S]*?\} else \{\n\s*c = PBRNeutralToneMapping\(c\);\n\s*\}'
c4 = r"""vec3 c = color;
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
"""
content = re.sub(c3, c4, content)

c7 = r'vec3 encoded = encodeSRGB\(c\);'
c8 = r"""vec3 encoded = encodeSRGB(c);
            
            // Post-sRGB Effects (Grain)
            if (u_grain > 0.0) {
                float luma = dot(encoded, vec3(0.2126, 0.7152, 0.0722));
                float weight = 1.0 - abs(luma - 0.5) * 2.0; 
                float noiseVal = (hash(v_texCoord * 133.7) - 0.5) * 2.0;
                encoded += u_grain * noiseVal * weight * 0.15;
            }
"""
content = re.sub(c7, c8, content)

with open('engine.js', 'w') as f:
    f.write(content)
