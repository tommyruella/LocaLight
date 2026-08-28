import re
with open('engine.js', 'r') as f:
    text = f.read()

# Restore my M11 texelSize changes
text = text.replace(
    "gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);",
    "gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / this.blurW, 1.0 / this.blurH);"
)

with open('engine.js', 'w') as f:
    f.write(text)
