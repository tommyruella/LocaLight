with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

debug_code = """
    console.log("PIXELS at middle (512, 512) for 1024:", pixels1024[(512*1024 + 512)*4], pixels1024[(512*1024 + 512)*4 + 1], pixels1024[(512*1024 + 512)*4 + 2]);
    console.log("PIXELS at middle (512, 512) for upscaled 256:", upscaled[(512*1024 + 512)*4], upscaled[(512*1024 + 512)*4 + 1], upscaled[(512*1024 + 512)*4 + 2]);
    
    // Find where maxAbsErr occurs
    let maxX = 0, maxY = 0, maxRefL = 0, maxTstL = 0;
    
    maxAbsErr = 0; // reset
    for (let y = 20; y < 1004; y++) {
        for (let x = 20; x < 1004; x++) {
            const idx = (y * 1024 + x) * 4;
            const rRef = pixels1024[idx] / 255.0;
            const gRef = pixels1024[idx+1] / 255.0;
            const bRef = pixels1024[idx+2] / 255.0;
            const LRef = 0.299*rRef + 0.587*gRef + 0.114*bRef;
            
            const rTst = upscaled[idx] / 255.0;
            const gTst = upscaled[idx+1] / 255.0;
            const bTst = upscaled[idx+2] / 255.0;
            const LTst = 0.299*rTst + 0.587*gTst + 0.114*bTst;
            
            const diff = Math.abs(LRef - LTst);
            if (diff > maxAbsErr) {
                maxAbsErr = diff;
                maxX = x; maxY = y; maxRefL = LRef; maxTstL = LTst;
            }
        }
    }
    console.log(`MAX ERR ${maxAbsErr} at ${maxX}, ${maxY}. Ref L=${maxRefL}, Tst L=${maxTstL}`);
"""
text = text.replace('let maxAbsErr = 0;', debug_code + 'let maxAbsErr2 = 0;')
text = text.replace('if (diff > maxAbsErr) maxAbsErr = diff;', 'if (diff > maxAbsErr2) maxAbsErr2 = diff;')
text = text.replace('maxAbsErr <= (3.0/255.0)', 'maxAbsErr2 <= (3.0/255.0)')
text = text.replace('mae: maxAbsErr', 'mae: maxAbsErr2')

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
