import re

with open('engine.js', 'r') as f:
    content = f.read()

match = r"this\.caps = \{[\s\S]*?\};\s*"
def repl(m):
    return m.group(0) + "\n        this.pipelineFloatPrecision = this.caps.colorBufferFloat ? 16 : 8;\n"

content = re.sub(match, repl, content)

with open('engine.js', 'w') as f:
    f.write(content)

