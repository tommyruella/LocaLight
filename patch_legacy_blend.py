import re
with open('engine.js', 'r') as f:
    content = f.read()

# Add uniform
c1 = r'uniform int u_blendMode;'
c2 = r'uniform int u_blendMode;\n        uniform int u_pipelineVersion;'
content = re.sub(c1, c2, content)

# Update blend logic
c3 = r'\} else if \(u_blendMode == 2\) \{ // Screen \(Linear Additive\)[\s\S]*?\} else if \(u_blendMode == 3\) \{ // Overlay \(Linear HDR\)[\s\S]*?\}'
c4 = r"""} else if (u_blendMode == 2) {
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
            }"""
content = re.sub(c3, c4, content)

# Add uniform loc
c5 = r'this\.blendLocs\[\'u_blendMode\'\] = gl\.getUniformLocation\(this\.blendProgram, \'u_blendMode\'\);'
c6 = r"this.blendLocs['u_blendMode'] = gl.getUniformLocation(this.blendProgram, 'u_blendMode');\n        this.blendLocs['u_pipelineVersion'] = gl.getUniformLocation(this.blendProgram, 'u_pipelineVersion');"
content = re.sub(c5, c6, content)

# Pass uniform
c7 = r'gl\.uniform1i\(this\.blendLocs\[\'u_blendMode\'\], mode\);'
c8 = r"gl.uniform1i(this.blendLocs['u_blendMode'], mode);\n                gl.uniform1i(this.blendLocs['u_pipelineVersion'], this.pipelineVersion || 2);"
content = re.sub(c7, c8, content)

with open('engine.js', 'w') as f:
    f.write(content)
