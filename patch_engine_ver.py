import re

with open('engine.js', 'r') as f:
    content = f.read()

c1 = r'const pipelineVersion = state\.pipelineVersion \|\| 2;'
c2 = r'const pipelineVersion = this.pipelineVersion || 2;'
content = re.sub(c1, c2, content)

with open('engine.js', 'w') as f:
    f.write(content)
