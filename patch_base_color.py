import re

with open('engine.js', 'r') as f:
    content = f.read()

# 1. Inject into fsBaseSource
base_match = r'const fsBaseSource = `#version 300 es\n\s*precision highp float;\n'
base_replace = 'const fsBaseSource = `#version 300 es\n    precision highp float;\n    ${GLSL_COLOR_SPACE}\n'
content = re.sub(base_match, base_replace, content)

# 2. Remove inline conversion and use linearizeSRGB
base_main_match = r'if \(u_is_srgb_input == 1\) \{\s*vec3 srgb = color\.rgb;\s*bvec3 cutoff = lessThanEqual\(srgb, vec3\(0\.04045\)\);\s*vec3 higher = pow\(\(srgb \+ vec3\(0\.055\)\) / vec3\(1\.055\), vec3\(2\.4\)\);\s*vec3 lower = srgb / vec3\(12\.92\);\s*color\.rgb = mix\(higher, lower, cutoff\);\s*\}'
base_main_replace = r'if (u_is_srgb_input == 1) {\n            color.rgb = linearizeSRGB(color.rgb);\n        }'
content = re.sub(base_main_match, base_main_replace, content)

with open('engine.js', 'w') as f:
    f.write(content)
