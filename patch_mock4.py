with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# We need to render the preFailPixels BEFORE we override gl.checkFramebufferStatus!
mock_setup = """    const origCheck = gl.checkFramebufferStatus;
    let checkCalled = false;
    let exceptionCaught = false;
    gl.checkFramebufferStatus = function(target) {
        if (target === gl.FRAMEBUFFER) {
            checkCalled = true;
            gl.checkFramebufferStatus = origCheck; // restore immediately
            return gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        }
        return origCheck.call(gl, target);
    };"""

text = text.replace(mock_setup, "")

pre_fail = """    const preFailPixels = new Uint8Array(1024 * 1024 * 4);
    engine.render(null, 1024, 1024, engine.compAFbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, engine.compAFbo);
    gl.readPixels(0, 0, 1024, 1024, gl.RGBA, gl.UNSIGNED_BYTE, preFailPixels);
"""

text = text.replace(pre_fail, pre_fail + mock_setup + '\n')

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
