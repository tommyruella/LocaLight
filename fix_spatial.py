import re
with open('engine.js', 'r') as f:
    text = f.read()

# I see what's happening. `this.blurW` and `this.blurH` are calculated in `loadImage` based on `this.canvas.width` and `this.canvas.height`.
# They are NOT recalculated in `ensureFBOs`!
# Let's check ensureFBOs
