import re

with open('lut-parser.js', 'r') as f:
    code = f.read()

old_parser = """        } else if (line.startsWith('TITLE') || line.startsWith('DOMAIN_') || line.startsWith('LUT_1D_SIZE')) {
            // Ignore headers we don't need
        } else {"""

new_parser = """        } else if (line.startsWith('DOMAIN_MIN')) {
            const parts = line.split(/\\s+/);
            const r = parseFloat(parts[1]);
            const g = parseFloat(parts[2]);
            const b = parseFloat(parts[3]);
            if (r !== 0.0 || g !== 0.0 || b !== 0.0) {
                console.warn("LUT DOMAIN_MIN is not 0.0. Only [0,1] display-referred LUTs are officially supported.");
            }
        } else if (line.startsWith('DOMAIN_MAX')) {
            const parts = line.split(/\\s+/);
            const r = parseFloat(parts[1]);
            const g = parseFloat(parts[2]);
            const b = parseFloat(parts[3]);
            if (r !== 1.0 || g !== 1.0 || b !== 1.0) {
                console.warn("LUT DOMAIN_MAX is not 1.0. Only [0,1] display-referred LUTs are officially supported.");
            }
        } else if (line.startsWith('TITLE') || line.startsWith('LUT_1D_SIZE')) {
            // Ignore other headers
        } else {"""

code = code.replace(old_parser, new_parser)

with open('lut-parser.js', 'w') as f:
    f.write(code)

