import re
with open('engine.js', 'r') as f:
    content = f.read()

# Remove the previously injected block at the end
c1 = r'if \(u_pipelineVersion == 1\) \{[\s\S]*?outColor = vec4\(base\.rgb, 1\.0\);'
content = re.sub(c1, 'outColor = vec4(base.rgb, 1.0);', content)

# Inject correctly before u_clarity
c2 = r'if \(u_clarity != 0\.0\) \{'
c3 = r"""if (u_pipelineVersion == 1) {
                if (u_sharpness != 0.0) {
                    vec3 n = texture(u_baseImage, v_texCoord + vec2(0.0, u_texelSize.y * u_spatialScale)).rgb;
                    vec3 s = texture(u_baseImage, v_texCoord + vec2(0.0, -u_texelSize.y * u_spatialScale)).rgb;
                    vec3 e = texture(u_baseImage, v_texCoord + vec2(u_texelSize.x * u_spatialScale, 0.0)).rgb;
                    vec3 w = texture(u_baseImage, v_texCoord + vec2(-u_texelSize.x * u_spatialScale, 0.0)).rgb;
                    vec3 sharpBlur = (n + s + e + w) * 0.25;
                    base.rgb += u_sharpness * (base.rgb - sharpBlur);
                }
            }
            if (u_clarity != 0.0) {"""
content = re.sub(c2, c3, content)

# Inject grain at the end (after glow)
c4 = r'if \(u_glow > 0\.0\) \{[\s\S]*?\}'
c5 = r"""if (u_glow > 0.0) {
                base.rgb += u_glow * blur.rgb;
            }
            if (u_pipelineVersion == 1) {
                if (u_grain > 0.0) {
                    float luma = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
                    float weight = 1.0 - abs(luma - 0.5) * 2.0;
                    float noiseVal = (hash(v_texCoord * 133.7) - 0.5) * 2.0;
                    base.rgb += u_grain * noiseVal * weight * 0.15;
                }
            }"""
content = re.sub(c4, c5, content)

with open('engine.js', 'w') as f:
    f.write(content)
