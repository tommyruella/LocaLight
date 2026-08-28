import re
with open('engine.js', 'r') as f:
    text = f.read()

# Fix blur downsampling to targetW/targetH instead of canvas width/height
text = text.replace(
    "this.blurW = Math.max(1, Math.floor(this.canvas.width / 4));",
    "this.blurW = Math.max(1, Math.floor(targetW / 4));"
)
text = text.replace(
    "this.blurH = Math.max(1, Math.floor(this.canvas.height / 4));",
    "this.blurH = Math.max(1, Math.floor(targetH / 4));"
)

with open('engine.js', 'w') as f:
    f.write(text)
