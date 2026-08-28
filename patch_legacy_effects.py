import re
with open('engine.js', 'r') as f:
    content = f.read()

# 1. Restore M11 effects to fsCompSource but guard with u_pipelineVersion == 1
c1 = r'float hash\(vec2 p\) \{\s*return fract\(sin\(dot\(p, vec2\(12\.9898, 78\.233\)\)\) \* 43758\.5453\);\s*\}'
c2 = r"""float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        uniform int u_pipelineVersion;"""
content = re.sub(c1, c2, content, count=1) # Inject uniform into fsCompSource

# Inject logic into fsCompSource
c3 = r'outColor = vec4\(base\.rgb, 1\.0\);'
c4 = r"""
            if (u_pipelineVersion == 1) {
                // M11 Legacy Effects in Comp Pass
                if (u_sharpness != 0.0) {
                    vec3 n = texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y * u_spatialScale)).rgb;
                    vec3 s = texture(u_image, v_texCoord + vec2(0.0, -u_texelSize.y * u_spatialScale)).rgb;
                    vec3 e = texture(u_image, v_texCoord + vec2(u_texelSize.x * u_spatialScale, 0.0)).rgb;
                    vec3 w = texture(u_image, v_texCoord + vec2(-u_texelSize.x * u_spatialScale, 0.0)).rgb;
                    vec3 sharpBlur = (n + s + e + w) * 0.25;
                    base.rgb += u_sharpness * (base.rgb - sharpBlur);
                }
                if (u_grain > 0.0) {
                    float luma = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
                    float weight = 1.0 - abs(luma - 0.5) * 2.0;
                    float noiseVal = (hash(v_texCoord * 133.7) - 0.5) * 2.0;
                    base.rgb += u_grain * noiseVal * weight * 0.15;
                }
            }
            outColor = vec4(base.rgb, 1.0);"""
content = re.sub(c3, c4, content)

# 2. Add uniform location to fsCompSource
c5 = r'this\.compLocs\[\'u_spatialScale\'\] = gl\.getUniformLocation\(this\.compositeProgram, \'u_spatialScale\'\);'
c6 = r"this.compLocs['u_spatialScale'] = gl.getUniformLocation(this.compositeProgram, 'u_spatialScale');\n        this.compLocs['u_pipelineVersion'] = gl.getUniformLocation(this.compositeProgram, 'u_pipelineVersion');"
content = re.sub(c5, c6, content)

# 3. Pass uniform to fsCompSource
c7 = r'gl\.uniform1f\(this\.compLocs\[\'u_spatialScale\'\], spatialScale\);'
c8 = r"gl.uniform1f(this.compLocs['u_spatialScale'], spatialScale);\n            gl.uniform1i(this.compLocs['u_pipelineVersion'], this.pipelineVersion || 2);"
content = re.sub(c7, c8, content)

# 4. Modify fsOutputSource to SKIP effects if u_pipelineVersion == 1
c9 = r'if \(u_sharpness != 0\.0\) \{'
c10 = r'if (u_sharpness != 0.0 && u_pipelineVersion != 1) {'
content = re.sub(c9, c10, content)

c11 = r'if \(u_grain > 0\.0\) \{'
c12 = r'if (u_grain > 0.0 && u_pipelineVersion != 1) {'
content = re.sub(c11, c12, content)

# Also ensure u_sharpness and u_grain are bound in fsCompSource
c13 = r'this\.compLocs\[\'u_glow\'\] = gl\.getUniformLocation\(this\.compositeProgram, \'u_glow\'\);'
c14 = r"this.compLocs['u_glow'] = gl.getUniformLocation(this.compositeProgram, 'u_glow');\n        this.compLocs['u_sharpness'] = gl.getUniformLocation(this.compositeProgram, 'u_sharpness');\n        this.compLocs['u_grain'] = gl.getUniformLocation(this.compositeProgram, 'u_grain');"
content = re.sub(c13, c14, content)

c15 = r'gl\.uniform1f\(this\.compLocs\[\'u_glow\'\], safeVal\(\'u_glow\'\)\);'
c16 = r"gl.uniform1f(this.compLocs['u_glow'], safeVal('u_glow'));\n            gl.uniform1f(this.compLocs['u_sharpness'], safeVal('u_sharpness'));\n            gl.uniform1f(this.compLocs['u_grain'], safeVal('u_grain'));"
content = re.sub(c15, c16, content)

with open('engine.js', 'w') as f:
    f.write(content)
