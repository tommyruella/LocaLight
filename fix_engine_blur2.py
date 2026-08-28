import re
with open('engine.js', 'r') as f:
    text = f.read()

# I see. ensureFBOs caches by this.fboW and this.fboH!
# In render(), we call `this.ensureFBOs(targetW, targetH)`.
# So it WILL recreate the FBOs for 1024, and then for 256.
# If they are recreated correctly, why does it error out with "Feedback loop formed between Framebuffer and active Texture"?
# Wait! In `engine.js` line 1148:
