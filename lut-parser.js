export function parseCubeLUT(text) {
    const lines = text.split('\n');
    let size = 0;
    const data = [];
    
    for (let line of lines) {
        line = line.trim();
        if (line === '' || line.startsWith('#')) continue;
        
        if (line.startsWith('LUT_3D_SIZE')) {
            size = parseInt(line.split(/\s+/)[1], 10);
        } else if (line.startsWith('DOMAIN_MIN')) {
            const parts = line.split(/\s+/);
            const r = parseFloat(parts[1]);
            const g = parseFloat(parts[2]);
            const b = parseFloat(parts[3]);
            if (r !== 0.0 || g !== 0.0 || b !== 0.0) {
                console.warn("LUT DOMAIN_MIN is not 0.0. Only [0,1] display-referred LUTs are officially supported.");
            }
        } else if (line.startsWith('DOMAIN_MAX')) {
            const parts = line.split(/\s+/);
            const r = parseFloat(parts[1]);
            const g = parseFloat(parts[2]);
            const b = parseFloat(parts[3]);
            if (r !== 1.0 || g !== 1.0 || b !== 1.0) {
                console.warn("LUT DOMAIN_MAX is not 1.0. Only [0,1] display-referred LUTs are officially supported.");
            }
        } else if (line.startsWith('TITLE') || line.startsWith('LUT_1D_SIZE')) {
            // Ignore other headers
        } else {
            // Data line: r g b
            const parts = line.split(/\s+/);
            if (parts.length === 3) {
                // WebGL textures typically use 4 channels (RGBA) or RGB. WebGL2 supports RGB32F or RGB16F.
                // However, Float32Array for RGB needs to be exact size.
                data.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
            }
        }
    }
    
    if (size === 0 || data.length !== size * size * size * 3) {
        throw new Error("Invalid or unsupported .cube file format.");
    }
    
    return { size, data: new Float32Array(data) };
}
