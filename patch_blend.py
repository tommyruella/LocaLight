import re

with open('engine.js', 'r') as f:
    content = f.read()

s_match = r'\} else if \(u_blendMode == 2\) \{ // Screen\n\s*blended = 1\.0 - \(1\.0 - base\) \* \(1\.0 - layer\);\n\s*\} else if \(u_blendMode == 3\) \{ // Overlay\n\s*blended = vec3\([\s\S]*?\);\n\s*\}'
s_repl = r"""} else if (u_blendMode == 2) { // Screen (Linear Additive)
                blended = base + layer;
            } else if (u_blendMode == 3) { // Overlay (Linear HDR)
                blended = base * (base + layer) / (base + 0.18);
            }"""

content = re.sub(s_match, s_repl, content)

with open('engine.js', 'w') as f:
    f.write(content)
