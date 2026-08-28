import re
with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# Replace the LRef/LTst block with dr/dg/db
old_block = """            const LRef = 0.299*rRef + 0.587*gRef + 0.114*bRef;
            
            const rTst = upscaled[idx] / 255.0;
            const gTst = upscaled[idx+1] / 255.0;
            const bTst = upscaled[idx+2] / 255.0;
            const LTst = 0.299*rTst + 0.587*gTst + 0.114*bTst;
            
            const diff = Math.abs(LRef - LTst);"""

new_block = """            const rTst = upscaled[idx] / 255.0;
            const gTst = upscaled[idx+1] / 255.0;
            const bTst = upscaled[idx+2] / 255.0;
            
            const dr = rRef - rTst;
            const dg = gRef - gTst;
            const db = bRef - bTst;
            
            const diff = Math.abs(0.299*dr + 0.587*dg + 0.114*db);"""

if old_block in text:
    text = text.replace(old_block, new_block)
else:
    print("Could not find the block to replace!")

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
