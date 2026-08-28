with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

mock_old = """    gl.checkFramebufferStatus = function(target) {
        if (target === gl.FRAMEBUFFER) {
            checkCalled = true;
            return gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        }
        return origCheck.call(gl, target);
    };"""

mock_new = """    gl.checkFramebufferStatus = function(target) {
        if (target === gl.FRAMEBUFFER) {
            checkCalled = true;
            gl.checkFramebufferStatus = origCheck; // restore immediately
            return gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        }
        return origCheck.call(gl, target);
    };"""
text = text.replace(mock_old, mock_new)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
