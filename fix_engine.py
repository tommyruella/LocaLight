import re
with open('engine.js', 'r') as f:
    text = f.read()

# Fix GL restore logic: Active texture needs to be restored, then bind texture.
# Scissor test, Scissor Box, Pack alignment.
# We also need to restore these missing ones.
save_gl = """        const GL_before = {
            viewport: gl.getParameter(gl.VIEWPORT),
            readFbo: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
            drawFbo: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
            rbo: gl.getParameter(gl.RENDERBUFFER_BINDING),
            prog: gl.getParameter(gl.CURRENT_PROGRAM),
            tex2D: gl.getParameter(gl.TEXTURE_BINDING_2D)
        };"""
save_gl_new = """        const GL_before = {
            viewport: gl.getParameter(gl.VIEWPORT),
            scissorBox: gl.getParameter(gl.SCISSOR_BOX),
            scissorTest: gl.getParameter(gl.SCISSOR_TEST),
            readFbo: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
            drawFbo: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
            rbo: gl.getParameter(gl.RENDERBUFFER_BINDING),
            prog: gl.getParameter(gl.CURRENT_PROGRAM),
            activeTex: gl.getParameter(gl.ACTIVE_TEXTURE),
            tex2D: gl.getParameter(gl.TEXTURE_BINDING_2D),
            packAlign: gl.getParameter(gl.PACK_ALIGNMENT)
        };"""
text = text.replace(save_gl, save_gl_new)

restore_gl = """            if (!GL_before.readFbo || gl.isFramebuffer(GL_before.readFbo)) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, GL_before.readFbo);
            if (!GL_before.drawFbo || gl.isFramebuffer(GL_before.drawFbo)) gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, GL_before.drawFbo);
            if (!GL_before.rbo || gl.isRenderbuffer(GL_before.rbo)) gl.bindRenderbuffer(gl.RENDERBUFFER, GL_before.rbo);
            gl.useProgram(GL_before.prog);
            if (!GL_before.tex2D || gl.isTexture(GL_before.tex2D)) gl.bindTexture(gl.TEXTURE_2D, GL_before.tex2D);"""
restore_gl_new = """            if (!GL_before.readFbo || gl.isFramebuffer(GL_before.readFbo)) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, GL_before.readFbo);
            if (!GL_before.drawFbo || gl.isFramebuffer(GL_before.drawFbo)) gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, GL_before.drawFbo);
            if (!GL_before.rbo || gl.isRenderbuffer(GL_before.rbo)) gl.bindRenderbuffer(gl.RENDERBUFFER, GL_before.rbo);
            if (GL_before.prog) gl.useProgram(GL_before.prog);
            
            gl.activeTexture(GL_before.activeTex);
            if (!GL_before.tex2D || gl.isTexture(GL_before.tex2D)) gl.bindTexture(gl.TEXTURE_2D, GL_before.tex2D);
            
            if (GL_before.scissorTest) gl.enable(gl.SCISSOR_TEST); else gl.disable(gl.SCISSOR_TEST);
            gl.scissor(GL_before.scissorBox[0], GL_before.scissorBox[1], GL_before.scissorBox[2], GL_before.scissorBox[3]);
            gl.pixelStorei(gl.PACK_ALIGNMENT, GL_before.packAlign);"""
text = text.replace(restore_gl, restore_gl_new)

with open('engine.js', 'w') as f:
    f.write(text)
