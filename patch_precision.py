import re
with open('engine.js', 'r') as f:
    content = f.read()

# Remove static precision assignment
c1 = r'this\.pipelineFloatPrecision = this\.caps\.colorBufferFloat \? 16 : 8;\n'
content = re.sub(c1, '', content)

# Assign it based on actual FBO creation in initBuffers
c2 = r'const base = this\.createFboAndTexture\(baseW, baseH, true\);\n\s*this\.baseTexture = base\.tex;'
c3 = r"""const base = this.createFboAndTexture(baseW, baseH, true);
        this.pipelineFloatPrecision = base.isFloat ? 16 : 8;
        this.baseTexture = base.tex;"""
content = re.sub(c2, c3, content)

with open('engine.js', 'w') as f:
    f.write(content)
