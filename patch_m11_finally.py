with open('engine.js', 'r') as f:
    text = f.read()

text = text.replace(
    'gl.bindTexture(gl.TEXTURE_2D, GL_before.tex2D);',
    'if (!GL_before.tex2D || gl.isTexture(GL_before.tex2D)) gl.bindTexture(gl.TEXTURE_2D, GL_before.tex2D);'
)

text = text.replace(
    'gl.bindFramebuffer(gl.READ_FRAMEBUFFER, GL_before.readFbo);',
    'if (!GL_before.readFbo || gl.isFramebuffer(GL_before.readFbo)) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, GL_before.readFbo);'
)
text = text.replace(
    'gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, GL_before.drawFbo);',
    'if (!GL_before.drawFbo || gl.isFramebuffer(GL_before.drawFbo)) gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, GL_before.drawFbo);'
)
text = text.replace(
    'gl.bindRenderbuffer(gl.RENDERBUFFER, GL_before.rbo);',
    'if (!GL_before.rbo || gl.isRenderbuffer(GL_before.rbo)) gl.bindRenderbuffer(gl.RENDERBUFFER, GL_before.rbo);'
)

with open('engine.js', 'w') as f:
    f.write(text)
