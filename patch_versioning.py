import re

with open('engine.js', 'r') as f:
    content = f.read()

# Add uniform to shader
c1 = r'uniform sampler2D u_image;'
c2 = r'uniform sampler2D u_image;\n        uniform int u_pipelineVersion;'
content = re.sub(c1, c2, content)

# Use uniform in shader
c3 = r'vec3 c = PBRNeutralToneMapping\(color\);'
c4 = r"""vec3 c = color;
            if (u_pipelineVersion == 1) {
                c = clamp(c, 0.0, 1.0); // Legacy M1-M11 hard clip
            } else {
                c = PBRNeutralToneMapping(c); // M12
            }"""
content = re.sub(c3, c4, content)

# Add uniform loc
c5 = r'this\.outputLocs\[\'u_image\'\] = gl\.getUniformLocation\(this\.outputProgram, \'u_image\'\);'
c6 = r"this.outputLocs['u_image'] = gl.getUniformLocation(this.outputProgram, 'u_image');\n        this.outputLocs['u_pipelineVersion'] = gl.getUniformLocation(this.outputProgram, 'u_pipelineVersion');"
content = re.sub(c5, c6, content)

# Pass uniform
c7 = r'gl\.uniform1i\(this\.outputLocs\[\'u_lut\'\], 3\);'
c8 = r"gl.uniform1i(this.outputLocs['u_lut'], 3);\n        const pipelineVersion = state.pipelineVersion || 2;\n        gl.uniform1i(this.outputLocs['u_pipelineVersion'], pipelineVersion);"
content = re.sub(c7, c8, content)

with open('engine.js', 'w') as f:
    f.write(content)
