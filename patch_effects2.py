import re

with open('engine.js', 'r') as f:
    content = f.read()

# Remove from fsCompSource
c1 = r'if \(u_sharpness != 0\.0\) \{[\s\S]*?base\.rgb \+= u_sharpness \* \(base\.rgb - sharpBlur\);\n\s*\}\n'
content = re.sub(c1, '', content)

c2 = r'if \(u_grain > 0\.0\) \{[\s\S]*?base\.rgb \+= u_grain \* noiseVal \* weight \* 0\.15;\n\s*\}\n'
content = re.sub(c2, '', content)

# Inject into fsOutputSource
# Find fsOutputSource definition
c3 = r'(const fsOutputSource = `#version 300 es[\s\S]*?uniform sampler2D u_image;)'
c4 = r'\1\n        uniform float u_sharpness;\n        uniform float u_grain;\n        uniform vec2 u_texelSize;\n        uniform float u_spatialScale;\n        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }'
content = re.sub(c3, c4, content, count=1)

c5 = r'vec3 c = PBRNeutralToneMapping\(color\);'
c6 = r"""vec3 c = PBRNeutralToneMapping(color);
            
            if (u_sharpness != 0.0) {
                vec3 n = PBRNeutralToneMapping(texture(u_image, v_texCoord + vec2(0.0, u_texelSize.y * u_spatialScale)).rgb);
                vec3 s = PBRNeutralToneMapping(texture(u_image, v_texCoord + vec2(0.0, -u_texelSize.y * u_spatialScale)).rgb);
                vec3 e = PBRNeutralToneMapping(texture(u_image, v_texCoord + vec2(u_texelSize.x * u_spatialScale, 0.0)).rgb);
                vec3 w = PBRNeutralToneMapping(texture(u_image, v_texCoord + vec2(-u_texelSize.x * u_spatialScale, 0.0)).rgb);
                vec3 sharpBlur = (n + s + e + w) * 0.25;
                c += u_sharpness * (c - sharpBlur);
            }
"""
content = re.sub(c5, c6, content)

c7 = r'vec3 encoded = encodeSRGB\(c\);'
c8 = r"""vec3 encoded = encodeSRGB(c);
            if (u_grain > 0.0) {
                float luma = dot(encoded, vec3(0.2126, 0.7152, 0.0722));
                float weight = 1.0 - abs(luma - 0.5) * 2.0; 
                float noiseVal = (hash(v_texCoord * 133.7) - 0.5) * 2.0;
                encoded += u_grain * noiseVal * weight * 0.15;
            }
"""
content = re.sub(c7, c8, content)

# Add uniform locations
c9 = r'this\.outputLocs\[\'u_lut_size\'\] = gl\.getUniformLocation\(this\.outputProgram, \'u_lut_size\'\);'
c10 = r"""this.outputLocs['u_lut_size'] = gl.getUniformLocation(this.outputProgram, 'u_lut_size');
        this.outputLocs['u_sharpness'] = gl.getUniformLocation(this.outputProgram, 'u_sharpness');
        this.outputLocs['u_grain'] = gl.getUniformLocation(this.outputProgram, 'u_grain');
        this.outputLocs['u_texelSize'] = gl.getUniformLocation(this.outputProgram, 'u_texelSize');
        this.outputLocs['u_spatialScale'] = gl.getUniformLocation(this.outputProgram, 'u_spatialScale');"""
content = re.sub(c9, c10, content)

# Pass uniforms in render()
c11 = r'gl\.uniform1f\(this\.outputLocs\[\'u_lut_size\'\], 32\.0\);'
c12 = r"""gl.uniform1f(this.outputLocs['u_lut_size'], 32.0);
        gl.uniform1f(this.outputLocs['u_sharpness'], safeVal('u_sharpness'));
        gl.uniform1f(this.outputLocs['u_grain'], safeVal('u_grain'));
        gl.uniform2f(this.outputLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);
        gl.uniform1f(this.outputLocs['u_spatialScale'], spatialScale);"""
content = re.sub(c11, c12, content)

with open('engine.js', 'w') as f:
    f.write(content)
