import re
with open('engine.js', 'r') as f:
    text = f.read()

# Add spatialScale uniform!
text = text.replace(
    "gl.uniform2f(this.compLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);",
    "gl.uniform2f(this.compLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);\n        gl.uniform1f(this.compLocs['u_spatialScale'], spatialScale);"
)
text = text.replace(
    "gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / this.blurW, 1.0 / this.blurH);",
    "gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / this.blurW, 1.0 / this.blurH);\n        gl.uniform1f(this.blurLocs['u_spatialScale'], spatialScale);"
)

with open('engine.js', 'w') as f:
    f.write(text)
