with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# Instead of mocking engine.checkFBO, let's mock it, but make it restore ITSELF on the first call!
mock_new = """    const origCheckFBO = engine.checkFBO;
    let checkCalled = false;
    let exceptionCaught = false;
    engine.checkFBO = function() {
        checkCalled = true;
        engine.checkFBO = origCheckFBO; // restore immediately!
        throw new Error("Framebuffer incomplete. Status: 36054");
    };"""

text = text.replace(
"""    const origCheckFBO = engine.checkFBO;
    let checkCalled = false;
    let exceptionCaught = false;
    engine.checkFBO = function() {
        checkCalled = true;
        throw new Error("Framebuffer incomplete. Status: 36054");
    };""",
mock_new)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
