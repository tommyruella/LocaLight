import re
with open('engine.js', 'r') as f:
    text = f.read()

# Wait, `this.blurW` and `this.blurH` are used in the first pass (`gl.viewport(0, 0, this.blurW, this.blurH)`)
# But what about the `texImage2D` for `blurTexture`?
# In `ensureFBOs`, we need to recreate the texture if dimensions change!
text = text.replace(
    'if (this.layerTexture && this.canvas.width === targetW && this.canvas.height === targetH) return;',
    'if (this.layerTexture && this.lastTargetW === targetW && this.lastTargetH === targetH) return;\n        this.lastTargetW = targetW;\n        this.lastTargetH = targetH;'
)

with open('engine.js', 'w') as f:
    f.write(text)
