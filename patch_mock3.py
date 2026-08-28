with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# Ah wait, engine.export() creates a NEW framebuffer but does not bind the texture properly? No, the error is 36054 (gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT)
# In export:
# const fbo = gl.createFramebuffer();
# gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
# this.checkFBO(); <-- THIS is what fails if we mock it, or it fails legitimately?
# Let's check without the mock if export works. Yes, T2a passed.
# So the mock *was* the reason it failed.
# But wait, T2a passed.
# Wait, why did line 114 fail?
# Because the try-catch block didn't catch the error? No, it's inside `try`. Wait, is `try` catching it?
# The error trace says:
# at LocalLightEngine.render (http://127.0.0.1:8000/engine.js:1153:18)
# at window.runTest (http://127.0.0.1:8000/test_m11_resolution.html:114:12)
# Line 114 is: engine.render(null, 1024, 1024, engine.compAFbo);
# This is BEFORE the try/catch!
# Wait, line 114 is before the try catch.
# Oh! The mock is active because I set it up at line 102!
