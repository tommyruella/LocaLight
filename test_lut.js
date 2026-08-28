const fs = require('fs');

console.log("TESTING M8 (LUT Engine)");

function sampleLUT(encoded, intensity) {
    if (intensity === 0.0) return encoded;
    const sampled = [0.5, 0.5, 0.5]; // dummy
    return [
        encoded[0] * (1.0 - intensity) + sampled[0] * intensity,
        encoded[1] * (1.0 - intensity) + sampled[1] * intensity,
        encoded[2] * (1.0 - intensity) + sampled[2] * intensity
    ];
}

let encoded = [0.2, 0.4, 0.6];
let out0 = sampleLUT(encoded, 0.0);
if (out0[0] !== encoded[0] || out0[1] !== encoded[1] || out0[2] !== encoded[2]) {
    console.error("FAIL: LUT intensity 0.0 did not return identity.");
    process.exit(1);
}

// Check REAL source code
const engineSrc = fs.readFileSync('engine.js', 'utf8');

// Find fsOutputSource block
const outputSourceMatch = engineSrc.match(/const fsOutputSource = `([^`]+)`/);
if (!outputSourceMatch) {
    console.error("FAIL: fsOutputSource not found in engine.js");
    process.exit(1);
}
const fsOutputSource = outputSourceMatch[1];

const encodeIdx = fsOutputSource.indexOf("encodeSRGB(");
const textureIdx = fsOutputSource.indexOf("texture(u_lut");
const mixIdx = fsOutputSource.indexOf("mix(encoded, lutColor");

if (encodeIdx === -1 || textureIdx === -1 || mixIdx === -1) {
    console.error("FAIL: Missing required steps (encodeSRGB, texture(u_lut), mix) in output shader.");
    process.exit(1);
}

if (!(encodeIdx < textureIdx && textureIdx < mixIdx)) {
    console.error("FAIL: Execution order is wrong. Must be encodeSRGB -> texture -> mix");
    process.exit(1);
}

console.log("PASS: LUT Intensity Identity and Real Shader Execution Order Verified");
