with open('engine.js', 'r') as f:
    text = f.read()

# Fix checkFBO
text = text.replace(
"""        const checkFBO = () => {
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                throw new Error("Framebuffer incomplete. Status: " + status);
            }
        };""",
""
)

# Replace all `checkFBO();` with `this.checkFBO();`
text = text.replace('checkFBO();', 'this.checkFBO();')

# Add checkFBO method
method = """
    checkFBO() {
        const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
        if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
            throw new Error("Framebuffer incomplete. Status: " + status);
        }
    }
"""
text = text.replace('    render(layers', method + '\n    render(layers')

with open('engine.js', 'w') as f:
    f.write(text)

