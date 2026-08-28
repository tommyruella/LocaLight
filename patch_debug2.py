import re
with open('engine.js', 'r') as f:
    content = f.read()
c1 = r'color\.rgb = linearizeSRGB\(color\.rgb\);'
c2 = r'color.rgb = vec3(2.0, 0.0, 0.0);'
content = re.sub(c1, c2, content)
with open('engine.js', 'w') as f:
    f.write(content)
