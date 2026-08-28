import re

with open('engine.js', 'r') as f:
    content = f.read()

# find: const blurShader = this.compileShader(gl.FRAGMENT_SHADER, fsBlurSource);
m1 = r'const blurShader = this\.compileShader\(gl\.FRAGMENT_SHADER, fsBlurSource\);'
r1 = r'const haloExtShader = this.compileShader(gl.FRAGMENT_SHADER, fsHaloExtSource);\n        const blurShader = this.compileShader(gl.FRAGMENT_SHADER, fsBlurSource);'
content = re.sub(m1, r1, content)

# find: this.blurProgram = this.createProgram(vertexShader, blurShader);
m2 = r'this\.blurProgram = this\.createProgram\(vertexShader, blurShader\);'
r2 = r'this.haloExtProgram = this.createProgram(vertexShader, haloExtShader);\n        this.blurProgram = this.createProgram(vertexShader, blurShader);'
content = re.sub(m2, r2, content)

with open('engine.js', 'w') as f:
    f.write(content)
