import re

with open('engine.js', 'r') as f:
    content = f.read()

tonemap_func = """
vec3 PBRNeutralToneMapping(vec3 color) {
    const float startCompression = 0.8 - 0.04;
    const float desaturation = 0.15;
    
    vec3 c = max(color, vec3(0.0));
    float x = min(c.r, min(c.g, c.b));
    float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
    c -= offset;
    
    float peak = max(c.r, max(c.g, c.b));
    if (peak < startCompression) return c;
    
    const float d = 1.0 - startCompression;
    float newPeak = 1.0 - d * d / (peak + d - startCompression);
    c *= newPeak / peak;
    
    float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
    return mix(c, newPeak * vec3(1, 1, 1), g);
}
"""

content = re.sub(r'const fsOutputSource = `#version 300 es\n\s*precision highp float;\n\s*\$\{GLSL_COLOR_SPACE\}\n', 
                 'const fsOutputSource = `#version 300 es\n    precision highp float;\n    ${GLSL_COLOR_SPACE}\n' + tonemap_func, 
                 content)

c_match = r'// Provisional Display Transform\n\s*vec3 c = max\(vec3\(0\.0\), color\);\n\s*c = clamp\(c, 0\.0, 1\.0\);'
c_repl = r'// Khronos PBR Neutral Tone Mapper (M12)\n            vec3 c = PBRNeutralToneMapping(color);'
content = re.sub(c_match, c_repl, content)

with open('engine.js', 'w') as f:
    f.write(content)
