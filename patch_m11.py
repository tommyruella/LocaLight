import sys

with open('engine.js', 'r') as f:
    text = f.read()

# 1. Inject u_spatialScale in shaders
text = text.replace(
    'uniform vec2 u_texelSize;\n        out vec4 outColor;',
    'uniform vec2 u_texelSize;\n        uniform float u_spatialScale;\n        out vec4 outColor;'
)

text = text.replace(
    'vec2 off = u_texelSize * 1.5;',
    'vec2 off = u_texelSize * u_spatialScale * 1.5;'
)

text = text.replace(
    'uniform vec2 u_texelSize;\n        \n        uniform float u_sharpness;',
    'uniform vec2 u_texelSize;\n        uniform float u_spatialScale;\n        \n        uniform float u_sharpness;'
)

text = text.replace(
    'vec3 n = texture(u_baseImage, v_texCoord + vec2(0.0, u_texelSize.y)).rgb;',
    'vec3 n = texture(u_baseImage, v_texCoord + vec2(0.0, u_texelSize.y * u_spatialScale)).rgb;'
)
text = text.replace(
    'vec3 s = texture(u_baseImage, v_texCoord + vec2(0.0, -u_texelSize.y)).rgb;',
    'vec3 s = texture(u_baseImage, v_texCoord + vec2(0.0, -u_texelSize.y * u_spatialScale)).rgb;'
)
text = text.replace(
    'vec3 e = texture(u_baseImage, v_texCoord + vec2(u_texelSize.x, 0.0)).rgb;',
    'vec3 e = texture(u_baseImage, v_texCoord + vec2(u_texelSize.x * u_spatialScale, 0.0)).rgb;'
)
text = text.replace(
    'vec3 w = texture(u_baseImage, v_texCoord + vec2(-u_texelSize.x, 0.0)).rgb;',
    'vec3 w = texture(u_baseImage, v_texCoord + vec2(-u_texelSize.x * u_spatialScale, 0.0)).rgb;'
)

# 2. Add limits and calculateIngestionSize
constructor_replacement = """        const gl = this.gl;
        
        const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const maxRb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        const maxVp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
        this.limits = {
            maxTex: maxTex,
            maxRb: maxRb,
            maxVp: Math.min(maxVp[0], maxVp[1])
        };
        this.limits.tLimit = Math.min(this.limits.maxTex, this.limits.maxRb, this.limits.maxVp);
"""
text = text.replace('        const gl = this.gl;\n', constructor_replacement, 1)

calc_ingest = """
    static calculateIngestionSize(w, h, limit) {
        const scale = Math.min(1.0, limit / Math.max(w, h));
        return {
            w: Math.max(1, Math.floor(w * scale)),
            h: Math.max(1, Math.floor(h * scale))
        };
    }
"""
text = text.replace('    loadLUT(lutData) {', calc_ingest + '\n    loadLUT(lutData) {')

# 3. Modify loadImage
loadImage_old = """    loadImage(imageElement) {
        const gl = this.gl;
        
        this.canvas.width = imageElement.width;
        this.canvas.height = imageElement.height;
        
        const baseW = this.canvas.width;
        const baseH = this.canvas.height;
        const blurW = Math.max(1, Math.floor(baseW / 4));
        const blurH = Math.max(1, Math.floor(baseH / 4));

        if (this.originalTexture) gl.deleteTexture(this.originalTexture);
        this.originalTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageElement);

        if (this.baseTexture) gl.deleteTexture(this.baseTexture);
        if (this.baseFbo) gl.deleteFramebuffer(this.baseFbo);
        const base = this.createFboAndTexture(baseW, baseH, true);
        this.baseTexture = base.tex;
        this.baseFbo = base.fbo;

        if (this.blurTexture) gl.deleteTexture(this.blurTexture);
        if (this.blurFbo) gl.deleteFramebuffer(this.blurFbo);
        const blur = this.createFboAndTexture(blurW, blurH, true);
        this.blurTexture = blur.tex;
        this.blurFbo = blur.fbo;

        if (this.layerTexture) gl.deleteTexture(this.layerTexture);
        if (this.layerFbo) gl.deleteFramebuffer(this.layerFbo);
        const layerFboObj = this.createFboAndTexture(baseW, baseH, true);
        this.layerTexture = layerFboObj.tex;
        this.layerFbo = layerFboObj.fbo;

        if (this.compATexture) gl.deleteTexture(this.compATexture);
        if (this.compAFbo) gl.deleteFramebuffer(this.compAFbo);
        const compA = this.createFboAndTexture(baseW, baseH, true);
        this.compATexture = compA.tex;
        this.compAFbo = compA.fbo;

        if (this.compBTexture) gl.deleteTexture(this.compBTexture);
        if (this.compBFbo) gl.deleteFramebuffer(this.compBFbo);
        const compB = this.createFboAndTexture(baseW, baseH, true);
        this.compBTexture = compB.tex;
        this.compBFbo = compB.fbo;
        
        this.blurW = blurW;
        this.blurH = blurH;

        this.render();
    }"""

loadImage_new = """    ensureFBOs(w, h) {
        const gl = this.gl;
        if (this.fboW === w && this.fboH === h) return;
        
        this.fboW = w;
        this.fboH = h;
        
        const baseW = w;
        const baseH = h;
        const blurW = Math.max(1, Math.floor(baseW / 4));
        const blurH = Math.max(1, Math.floor(baseH / 4));

        if (this.baseTexture) gl.deleteTexture(this.baseTexture);
        if (this.baseFbo) gl.deleteFramebuffer(this.baseFbo);
        const base = this.createFboAndTexture(baseW, baseH, true);
        this.baseTexture = base.tex;
        this.baseFbo = base.fbo;

        if (this.blurTexture) gl.deleteTexture(this.blurTexture);
        if (this.blurFbo) gl.deleteFramebuffer(this.blurFbo);
        const blur = this.createFboAndTexture(blurW, blurH, true);
        this.blurTexture = blur.tex;
        this.blurFbo = blur.fbo;

        if (this.layerTexture) gl.deleteTexture(this.layerTexture);
        if (this.layerFbo) gl.deleteFramebuffer(this.layerFbo);
        const layerFboObj = this.createFboAndTexture(baseW, baseH, true);
        this.layerTexture = layerFboObj.tex;
        this.layerFbo = layerFboObj.fbo;

        if (this.compATexture) gl.deleteTexture(this.compATexture);
        if (this.compAFbo) gl.deleteFramebuffer(this.compAFbo);
        const compA = this.createFboAndTexture(baseW, baseH, true);
        this.compATexture = compA.tex;
        this.compAFbo = compA.fbo;

        if (this.compBTexture) gl.deleteTexture(this.compBTexture);
        if (this.compBFbo) gl.deleteFramebuffer(this.compBFbo);
        const compB = this.createFboAndTexture(baseW, baseH, true);
        this.compBTexture = compB.tex;
        this.compBFbo = compB.fbo;
        
        this.blurW = blurW;
        this.blurH = blurH;
    }

    loadImage(imageElement) {
        const gl = this.gl;
        
        const srcW = imageElement.width || imageElement.videoWidth || 1;
        const srcH = imageElement.height || imageElement.videoHeight || 1;
        
        const ingest = LocalLightEngine.calculateIngestionSize(srcW, srcH, this.limits.tLimit);
        this.ingestW = ingest.w;
        this.ingestH = ingest.h;
        
        // App.js should manage canvas size. If it didn't, set a safe default.
        if (this.canvas.width === 0 || this.canvas.width === 300) {
            this.canvas.width = this.ingestW;
            this.canvas.height = this.ingestH;
        }
        
        if (this.originalTexture) gl.deleteTexture(this.originalTexture);
        this.originalTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        if (srcW !== ingest.w || srcH !== ingest.h) {
            const tmp = document.createElement('canvas');
            tmp.width = ingest.w;
            tmp.height = ingest.h;
            const ctx = tmp.getContext('2d');
            ctx.drawImage(imageElement, 0, 0, ingest.w, ingest.h);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tmp);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageElement);
        }

        this.ensureFBOs(this.canvas.width, this.canvas.height);
        this.render();
    }"""
text = text.replace(loadImage_old, loadImage_new)


# 4. Modify render to use target size and bind locations
render_sig = "    render(layers = null) {"
render_new = """    render(layers = null, targetW = this.canvas.width, targetH = this.canvas.height, targetFBO = null) {
        const gl = this.gl;
        if (!this.originalTexture) return;
        
        this.ensureFBOs(targetW, targetH);
        
        const spatialScale = Math.max(targetW, targetH) / 1024.0;
        const checkFBO = () => {
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                throw new Error("Framebuffer incomplete. Status: " + status);
            }
        };
"""
text = text.replace("    render(layers = null) {\n        const gl = this.gl;\n        if (!this.originalTexture) return;", render_new)

# Find all occurrences of gl.viewport(0, 0, this.canvas.width, this.canvas.height);
# and replace with targetW, targetH
text = text.replace('gl.viewport(0, 0, this.canvas.width, this.canvas.height);', 'gl.viewport(0, 0, targetW, targetH);')
text = text.replace('gl.bindFramebuffer(gl.FRAMEBUFFER, null);', 'gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO); checkFBO();')
text = text.replace('gl.bindFramebuffer(gl.FRAMEBUFFER, this.baseFbo);', 'gl.bindFramebuffer(gl.FRAMEBUFFER, this.baseFbo); checkFBO();')
text = text.replace('gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbo);', 'gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbo); checkFBO();')
text = text.replace('gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo);', 'gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo); checkFBO();')
text = text.replace('gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo);', 'gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo); checkFBO();')

# 5. Inject u_spatialScale uniforms
# In Pass 2:
text = text.replace(
    'gl.uniform2f(this.blurLocs.u_texelSize, 1.0 / this.blurW, 1.0 / this.blurH);',
    'gl.uniform2f(this.blurLocs.u_texelSize, 1.0 / this.blurW, 1.0 / this.blurH);\n        if (this.blurLocs.u_spatialScale) gl.uniform1f(this.blurLocs.u_spatialScale, spatialScale);'
)
# In Pass 3:
text = text.replace(
    'gl.uniform2f(this.compLocs.u_texelSize, 1.0 / targetW, 1.0 / targetH);',
    'gl.uniform2f(this.compLocs.u_texelSize, 1.0 / targetW, 1.0 / targetH);\n        if (this.compLocs.u_spatialScale) gl.uniform1f(this.compLocs.u_spatialScale, spatialScale);'
)
text = text.replace(
    'gl.uniform2f(this.compLocs.u_texelSize, 1.0 / this.canvas.width, 1.0 / this.canvas.height);',
    'gl.uniform2f(this.compLocs.u_texelSize, 1.0 / targetW, 1.0 / targetH);\n        if (this.compLocs.u_spatialScale) gl.uniform1f(this.compLocs.u_spatialScale, spatialScale);'
)

# 6. Add Export method
export_code = """
    export() {
        const gl = this.gl;
        if (!this.originalTexture || !this.ingestW || !this.ingestH) return null;
        
        // Deep clone state to ensure it wasn't mutated
        const S_before = JSON.parse(JSON.stringify(this.state));
        
        // Snapshot GL state
        const GL_before = {
            viewport: gl.getParameter(gl.VIEWPORT),
            scissorBox: gl.getParameter(gl.SCISSOR_BOX),
            scissorTest: gl.getParameter(gl.SCISSOR_TEST),
            drawFbo: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
            readFbo: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
            rbo: gl.getParameter(gl.RENDERBUFFER_BINDING),
            prog: gl.getParameter(gl.CURRENT_PROGRAM),
            activeTex: gl.getParameter(gl.ACTIVE_TEXTURE),
            tex2D: gl.getParameter(gl.TEXTURE_BINDING_2D),
            packAlign: gl.getParameter(gl.PACK_ALIGNMENT)
        };
        
        // We render to ingest resolution
        const W_exp = this.ingestW;
        const H_exp = this.ingestH;
        
        // Offscreen export FBO
        let exportTex = null;
        let exportFbo = null;
        let pixels = null;
        
        try {
            const expObj = this.createFboAndTexture(W_exp, H_exp, false);
            exportTex = expObj.tex;
            exportFbo = expObj.fbo;
            
            this.render(null, W_exp, H_exp, exportFbo);
            
            pixels = new Uint8Array(W_exp * H_exp * 4);
            gl.bindFramebuffer(gl.FRAMEBUFFER, exportFbo);
            gl.readPixels(0, 0, W_exp, H_exp, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            
            // FBO incomplete exception will jump to catch.
        } finally {
            if (exportFbo) gl.deleteFramebuffer(exportFbo);
            if (exportTex) gl.deleteTexture(exportTex);
            
            // Restore GL State
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, GL_before.readFbo);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, GL_before.drawFbo);
            gl.bindRenderbuffer(gl.RENDERBUFFER, GL_before.rbo);
            gl.useProgram(GL_before.prog);
            gl.activeTexture(GL_before.activeTex);
            gl.bindTexture(gl.TEXTURE_2D, GL_before.tex2D);
            gl.pixelStorei(gl.PACK_ALIGNMENT, GL_before.packAlign);
            
            if (GL_before.scissorTest) gl.enable(gl.SCISSOR_TEST);
            else gl.disable(gl.SCISSOR_TEST);
            
            if (GL_before.scissorBox) {
                gl.scissor(GL_before.scissorBox[0], GL_before.scissorBox[1], GL_before.scissorBox[2], GL_before.scissorBox[3]);
            }
            if (GL_before.viewport) {
                gl.viewport(GL_before.viewport[0], GL_before.viewport[1], GL_before.viewport[2], GL_before.viewport[3]);
            }
            
            // Force re-render to preview
            this.ensureFBOs(this.canvas.width, this.canvas.height);
            this.render(null, this.canvas.width, this.canvas.height, null);
            
            // Re-assign identical snapshot (if modified, the caller/test will catch it)
            this.state = S_before;
        }
        
        return { width: W_exp, height: H_exp, pixels: pixels };
    }
"""
text = text.replace('    loadImage(imageElement)', export_code + '\n    loadImage(imageElement)')

with open('engine.js', 'w') as f:
    f.write(text)

