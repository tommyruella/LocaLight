import re
with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

old_block = """            const rRef = pixels1024[idx] / 255.0;
            const gRef = pixels1024[idx+1] / 255.0;
            const bRef = pixels1024[idx+2] / 255.0;
            
            const rTst = upscaled[idx] / 255.0;
            const gTst = upscaled[idx+1] / 255.0;
            const bTst = upscaled[idx+2] / 255.0;
            
            const dr = rRef - rTst;
            const dg = gRef - gTst;
            const db = bRef - bTst;
            
            const diff = Math.abs(0.299*dr + 0.587*dg + 0.114*db);"""

new_block = """            const dr = pixels1024[idx] - upscaled[idx];
            const dg = pixels1024[idx+1] - upscaled[idx+1];
            const db = pixels1024[idx+2] - upscaled[idx+2];
            
            const diff = Math.abs(0.299*dr + 0.587*dg + 0.114*db) / 255.0;"""

if old_block in text:
    text = text.replace(old_block, new_block)
else:
    print("Could not find the block to replace!")

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
