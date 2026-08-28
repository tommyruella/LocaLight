import re
with open('engine.js', 'r') as f:
    text = f.read()

# Fix u_texelSize being hardcoded to this.canvas.width/height instead of targetW/targetH
text = text.replace(
    "gl.uniform2f(this.compLocs['u_texelSize'], 1.0 / this.canvas.width, 1.0 / this.canvas.height);",
    "gl.uniform2f(this.compLocs['u_texelSize'], 1.0 / targetW, 1.0 / targetH);"
)

with open('engine.js', 'w') as f:
    f.write(text)
