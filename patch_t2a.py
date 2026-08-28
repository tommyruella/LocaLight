with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

text = text.replace(
    'expObj.width === 256 && expObj.height === 256 && expObj.pixels.length === 256 * 256 * 4',
    'expObj.width === 1024 && expObj.height === 1024 && expObj.pixels.length === 1024 * 1024 * 4'
)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
