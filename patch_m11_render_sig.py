with open('engine.js', 'r') as f:
    text = f.read()

render_sig = """    render(layersArray) {
        if (!this.originalTexture) return;
        
        const gl = this.gl;"""

render_new = """    render(layersArray = null, targetW = this.canvas.width, targetH = this.canvas.height, targetFBO = null) {
        if (!this.originalTexture) return;
        
        const gl = this.gl;
        
        this.ensureFBOs(targetW, targetH);
        const spatialScale = Math.max(targetW, targetH) / 1024.0;
"""

text = text.replace(render_sig, render_new)

with open('engine.js', 'w') as f:
    f.write(text)
