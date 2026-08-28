import re
with open('test_m10_runner.html', 'r') as f:
    text = f.read()

# We change the canvas size to 1024, 1024
text = text.replace('canvas.width = 64;\ncanvas.height = 64;', 'canvas.width = 1024;\ncanvas.height = 1024;')

text = text.replace('fillRect(0, 0, 64, 64)', 'fillRect(0, 0, 1024, 1024)')
text = text.replace('fillRect(32, 0, 32, 64)', 'fillRect(512, 0, 512, 1024)')
text = text.replace('fillRect(31, 31, 2, 2)', 'fillRect(511, 511, 2, 2)')
text = text.replace('fillRect(30, 30, 4, 4)', 'fillRect(510, 510, 4, 4)')

text = text.replace('const pixels = new Uint8Array(64 * 64 * 4);', 'const pixels = new Uint8Array(1024 * 1024 * 4);')
text = text.replace('gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);', 'gl.readPixels(0, 0, 1024, 1024, gl.RGBA, gl.UNSIGNED_BYTE, pixels);')

# Indices
text = text.replace('(32 * 64 + 31)', '(512 * 1024 + 511)')
text = text.replace('(32 * 64 + 29)', '(512 * 1024 + 509)')
text = text.replace('(32 * 64 + 32)', '(512 * 1024 + 512)')
text = text.replace('(31 * 64 + 31)', '(511 * 1024 + 511)')

with open('test_m10_runner.html', 'w') as f:
    f.write(text)
