import re

with open('engine.js', 'r') as f:
    content = f.read()

c1 = r'gl\.uniform1i\(this\.outputLocs\[\'u_lut\'\], 1\);'
c2 = r"gl.uniform1i(this.outputLocs['u_lut'], 1);\n            const pipelineVersion = this.pipelineVersion || 2;\n            gl.uniform1i(this.outputLocs['u_pipelineVersion'], pipelineVersion);"
content = re.sub(c1, c2, content)

with open('engine.js', 'w') as f:
    f.write(content)
