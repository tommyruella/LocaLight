const fs = require('fs');
const content = fs.readFileSync('engine.js', 'utf8');
const match = content.match(/createFboAndTexture[\s\S]*?return \{ tex, fbo, isFloat: \(internalFormat === gl.RGBA16F\) \};\n\s*\}/);
if(match) console.log(match[0]);
