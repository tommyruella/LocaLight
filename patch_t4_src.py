with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

text = text.replace('srcCanvas.width = 256; srcCanvas.height = 256;', 'srcCanvas.width = 1024; srcCanvas.height = 1024;')
text = text.replace('ctx.fillRect(0, 0, 128, 256);', 'ctx.fillRect(0, 0, 512, 1024);')
text = text.replace('ctx.fillRect(128, 0, 128, 256);', 'ctx.fillRect(512, 0, 512, 1024);')

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
