import re

with open('engine.js', 'r') as f:
    text = f.read()

text = text.replace(
    'gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));',
    '''const dummyData = new Float32Array([1.0, 1.0, 1.0, 1.0]);
        // dummyLut as RGBA16F to match lutTexture format
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, 1, 1, 1, 0, gl.RGBA, gl.FLOAT, dummyData);'''
)

with open('engine.js', 'w') as f:
    f.write(text)
