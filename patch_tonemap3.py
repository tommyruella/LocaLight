import re

with open('engine.js', 'r') as f:
    content = f.read()

c_match = r'// Provisional Display Transform\n\s*vec3 c = max\(vec3\(0\.0\), color\);\n\s*c = clamp\(c, 0\.0, 1\.0\);'
c_repl = r'// Khronos PBR Neutral Tone Mapper (M12)\n            vec3 c = color;\n            if (u_pipelineVersion == 1) {\n                c = clamp(c, 0.0, 1.0);\n            } else {\n                c = PBRNeutralToneMapping(c);\n            }'
content = re.sub(c_match, c_repl, content)

with open('engine.js', 'w') as f:
    f.write(content)
