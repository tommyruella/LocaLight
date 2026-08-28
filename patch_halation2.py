import re

with open('engine.js', 'r') as f:
    content = f.read()

# Add uniform sampler
c1 = r'uniform sampler2D u_blurImage;'
c2 = r'uniform sampler2D u_blurImage;\n        uniform sampler2D u_haloBlurImage;'
content = re.sub(c1, c2, content)

# Use it in main
c3 = r'if \(u_halation > 0\.0\) \{\n\s*vec3 bloom = max\(blur\.rgb - 0\.6, 0\.0\);\n\s*base\.rgb \+= u_halation \* bloom \* 2\.0;\n\s*\}'
c4 = r'if (u_halation > 0.0) {\n                vec3 halo = texture(u_haloBlurImage, v_texCoord).rgb;\n                base.rgb += u_halation * halo * 2.0;\n            }'
content = re.sub(c3, c4, content)

with open('engine.js', 'w') as f:
    f.write(content)
