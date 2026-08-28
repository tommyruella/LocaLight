import re
with open('engine.js', 'r') as f:
    content = f.read()

c1 = r'vec3 encoded = mix\(encoded, lutColor, u_lut_intensity\);\n\s*outColor = vec4\(encoded, 1\.0\);'
c2 = r'encoded = mix(encoded, lutColor, u_lut_intensity);\n            outColor = vec4(color, 1.0);'
content = re.sub(c1, c2, content)

with open('engine.js', 'w') as f:
    f.write(content)
