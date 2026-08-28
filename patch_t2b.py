with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

text = text.replace(
    'log("T2b: Invalid Framebuffer throws gracefully", checkCalled && exceptionCaught && gl.getError() === gl.NO_ERROR);',
    'log("T2b: Invalid Framebuffer throws gracefully", checkCalled && exceptionCaught && gl.getError() === gl.NO_ERROR, { checkCalled, exceptionCaught, error: gl.getError() });'
)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
