import re

with open('engine.js', 'r') as f:
    content = f.read()

color_spaces_str = """
const GLSL_COLOR_SPACES = `
// Piecewise sRGB to Linear
vec3 linearizeSRGB(vec3 srgb) {
    vec3 bLess = step(vec3(0.04045), srgb);
    vec3 linOut = mix(
        srgb / 12.92,
        pow((srgb + vec3(0.055)) / 1.055, vec3(2.4)),
        bLess
    );
    return linOut;
}

// Piecewise Linear to sRGB
vec3 encodeSRGB(vec3 linear) {
    vec3 bLess = step(vec3(0.0031308), linear);
    vec3 srgbOut = mix(
        linear * 12.92,
        1.055 * pow(max(linear, vec3(0.0)), vec3(1.0 / 2.4)) - vec3(0.055),
        bLess
    );
    return srgbOut;
}
`;
"""

content = re.sub(r'const vsSource = `', color_spaces_str + '\n        const vsSource = `', content)

base_match = r'const fsBaseSource = `#version 300 es\n\s*precision highp float;\n'
base_replace = 'const fsBaseSource = `#version 300 es\n    precision highp float;\n    ${GLSL_COLOR_SPACES}\n'
content = re.sub(base_match, base_replace, content)

output_match = r'const fsOutputSource = `#version 300 es\n\s*precision highp float;\n'
output_replace = 'const fsOutputSource = `#version 300 es\n    precision highp float;\n    ${GLSL_COLOR_SPACES}\n'
content = re.sub(output_match, output_replace, content)

base_main_match = r'if \(u_is_srgb_input == 1\) \{\s*vec3 srgb = color\.rgb;\s*bvec3 cutoff = lessThanEqual\(srgb, vec3\(0\.04045\)\);\s*vec3 higher = pow\(\(srgb \+ vec3\(0\.055\)\) / vec3\(1\.055\), vec3\(2\.4\)\);\s*vec3 lower = srgb / vec3\(12\.92\);\s*color\.rgb = mix\(higher, lower, cutoff\);\s*\}'
base_main_replace = r'if (u_is_srgb_input == 1) {\n            color.rgb = linearizeSRGB(color.rgb);\n        }'
content = re.sub(base_main_match, base_main_replace, content)


with open('engine.js', 'w') as f:
    f.write(content)

