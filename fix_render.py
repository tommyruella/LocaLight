import re
with open('engine.js', 'r') as f:
    text = f.read()

# Ah! If targetFBO is engine.compAFbo!
# test_m11_resolution.html line 114: `engine.render(null, 1024, 1024, engine.compAFbo)`
# This causes targetFBO to be `this.compAFbo`.
# Then `gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO)` (which is `this.compAFbo`).
# Then `gl.bindTexture(gl.TEXTURE_2D, this.compATexture)`.
# Feedback loop!
# Wait, I already fixed test_m11_resolution.html to pass `null`!
# Why did it still fail with MAE = 0.37?
# Because the source image is a hard edge from 128->255!
# At 1024x1024, it is 512->1023.
# The upscaling of 256x256 to 1024x1024 creates bilinear interpolation at the edge.
# The `maxAbsErr <= 3.0/255.0` is failing because of the bilinear interpolation of the hard edge.
