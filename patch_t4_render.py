with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# I am rendering at 256, but since blurFbo is downsampled by 4, it is 64x64.
# Then upsampling to 1024.
# Let's add debugging output for the center pixel of both.
debug_code = """
    console.log("REF 1024 Center pixel:", pixels1024[(512*1024+512)*4], pixels1024[(512*1024+512)*4+1], pixels1024[(512*1024+512)*4+2]);
    console.log("TST 256 Center pixel upscaled:", upscaled[(512*1024+512)*4], upscaled[(512*1024+512)*4+1], upscaled[(512*1024+512)*4+2]);
    let maxX = 0, maxY = 0;
"""
text = text.replace('let maxAbsErr = 0;', debug_code + 'let maxAbsErr = 0;')
text = text.replace('if (diff > maxAbsErr) maxAbsErr = diff;', 'if (diff > maxAbsErr) { maxAbsErr = diff; maxX = x; maxY = y; }')
text = text.replace('const rmse = Math.sqrt(sumSqErr / count);', 'const rmse = Math.sqrt(sumSqErr / count); console.log("Max Err:", maxAbsErr, "at", maxX, maxY);')

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
