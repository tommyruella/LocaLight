import re
with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# Fix T3 GL_before
gl_before_old = """    const GL_before = {
        viewport: gl.getParameter(gl.VIEWPORT),
        readFbo: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
        drawFbo: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
        rbo: gl.getParameter(gl.RENDERBUFFER_BINDING),
        prog: gl.getParameter(gl.CURRENT_PROGRAM)
    };"""
gl_before_new = """    const GL_before = {
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
text = text.replace(gl_before_old, gl_before_new)

# Fix T3 GL_after
gl_after_old = """    const GL_after = {
        viewport: gl.getParameter(gl.VIEWPORT),
        readFbo: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
        drawFbo: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
        rbo: gl.getParameter(gl.RENDERBUFFER_BINDING),
        prog: gl.getParameter(gl.CURRENT_PROGRAM)
    };"""
gl_after_new = """    const GL_after = {
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
text = text.replace(gl_after_old, gl_after_new)

# Fix u_glow -> u_clarity
text = text.replace("engine.state['u_glow'] = 1.0;", "engine.state['u_clarity'] = 1.0;")

# Fix MAE assert
text = text.replace("maxAbsErr <= (45.0/255.0)", "maxAbsErr <= (3.0/255.0)")

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
