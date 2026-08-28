import re
with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# I will pass `null` to `engine.render` in T3! Or wait, it needs to render to an FBO so I can read it!
# Wait, if I pass an FBO, I need to create my own FBO!
# In the test:
text = text.replace(
    'engine.render(null, 1024, 1024, engine.compAFbo);',
    'engine.render(null, 1024, 1024, null);'
)
text = text.replace(
    'gl.bindFramebuffer(gl.FRAMEBUFFER, engine.compAFbo);',
    'gl.bindFramebuffer(gl.FRAMEBUFFER, null);'
)

# And remove the debug logs
text = text.replace('console.log("REF 1024', '//')
text = text.replace('console.log("TST 256', '//')
text = text.replace('console.log("Max Err', '//')

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
