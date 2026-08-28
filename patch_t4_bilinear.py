with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

upsample_old = """
            const u = x / 1024;
            const v = y / 1024;
            const sx = u * 256;
            const sy = v * 256;
            const x0 = Math.floor(sx), x1 = Math.min(x0 + 1, 255);
            const y0 = Math.floor(sy), y1 = Math.min(y0 + 1, 255);
            const tx = sx - x0, ty = sy - y0;
"""

upsample_new = """
            const u = (x + 0.5) / 1024;
            const v = (y + 0.5) / 1024;
            const sx = u * 256 - 0.5;
            const sy = v * 256 - 0.5;
            const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(x0 + 1, 255);
            const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(y0 + 1, 255);
            const tx = Math.max(0, sx - x0), ty = Math.max(0, sy - y0);
"""

text = text.replace(upsample_old, upsample_new)

# Revert my broken debug patch
text = text.replace('console.log("PIXELS', '//')
text = text.replace('maxAbsErr2', 'maxAbsErr')
text = text.replace('maxAbsErr = 0; // reset', 'let maxAbsErr = 0;')

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
