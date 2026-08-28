with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

text = text.replace(
    'engine.ensureFBOs(1024, 1024);',
    'canvas.width = 1024; canvas.height = 1024; engine.ensureFBOs(1024, 1024);'
)

text = text.replace(
    'engine.ensureFBOs(256, 256);',
    'canvas.width = 256; canvas.height = 256; engine.ensureFBOs(256, 256);'
)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
