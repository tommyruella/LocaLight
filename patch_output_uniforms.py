import re
with open('engine.js', 'r') as f:
    content = f.read()

c1 = r'gl\.uniform1f\(this\.outputLocs\[\'u_lut_size\'\], this\.lutSize \|\| 1\.0\);'
c2 = r"gl.uniform1f(this.outputLocs['u_lut_size'], this.lutSize || 1.0);\n            gl.uniform2f(this.outputLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);\n            gl.uniform1f(this.outputLocs['u_spatialScale'], spatialScale);"
content = re.sub(c1, c2, content)

with open('engine.js', 'w') as f:
    f.write(content)
