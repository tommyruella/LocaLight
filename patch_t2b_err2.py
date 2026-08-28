with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

text = text.replace(
    'const err = gl.getError();',
    'while(gl.getError() !== gl.NO_ERROR) {} const err = gl.getError();'
)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
