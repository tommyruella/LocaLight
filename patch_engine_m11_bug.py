import re
with open('engine.js', 'r') as f:
    text = f.read()

# Fix the texelSize bug in PASS 2: Blur
text = text.replace(
    "gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / this.blurW, 1.0 / this.blurH);",
    "gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);"
)

with open('engine.js', 'w') as f:
    f.write(text)
