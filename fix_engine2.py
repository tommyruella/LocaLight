import re
with open('engine.js', 'r') as f:
    text = f.read()

# I need to set the filter in ensureFBOs for blur downsampling and upsampling
# Wait! "Feedback loop formed between Framebuffer and active Texture."
# This is happening during `renderSingleLayerState`.
# Why? Because in `test_m11_resolution.html`:
# engine.render(null, 1024, 1024, engine.compAFbo)
# But `renderSingleLayerState` uses `this.compAFbo` internally!
# It does: `this.renderSingleLayerState(this.state, this.compAFbo, this.originalTexture, targetW, targetH, spatialScale);`
# And in `renderSingleLayerState`, it does:
# PASS 1: baseFbo. uses originalTexture.
# PASS 2: blurFbo. uses baseTexture.
# PASS 3: targetFbo. uses baseTexture and blurTexture.
# Oh! If targetFbo === this.compAFbo, and it IS!
# But wait, in `render(layersArray = null, targetW = this.canvas.width, targetH = this.canvas.height, targetFBO = null)`,
# `this.renderSingleLayerState` is called with `this.compAFbo` as targetFBO!
# Wait! `render` is:
# this.renderSingleLayerState(this.state, this.compAFbo, this.originalTexture, targetW, targetH, spatialScale);
# gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO); // This is where the output is copied!
# Ah! It renders to `compAFbo`, then copies to `targetFBO`.
# If `targetFBO` === `compAFbo`, it reads from `compATexture` and writes to `compAFbo`!!! Feedback loop!
