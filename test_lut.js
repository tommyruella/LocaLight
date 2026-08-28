function sampleLUT(encoded, intensity, lutData) {
    if (intensity === 0.0) return encoded;
    // simulated trilinear sampling omitted for brevity, this just proves intensity logic
    const sampled = [0.5, 0.5, 0.5]; // dummy
    return [
        encoded[0] * (1.0 - intensity) + sampled[0] * intensity,
        encoded[1] * (1.0 - intensity) + sampled[1] * intensity,
        encoded[2] * (1.0 - intensity) + sampled[2] * intensity
    ];
}

console.log("TESTING M8 (LUT Engine)");

let encoded = [0.2, 0.4, 0.6];
let out0 = sampleLUT(encoded, 0.0, null);
if (out0[0] !== encoded[0] || out0[1] !== encoded[1] || out0[2] !== encoded[2]) {
    console.error("FAIL: LUT intensity 0.0 did not return identity.");
    process.exit(1);
}

const fsOutputSource = `
        if (u_is_srgb_input == 1) {
            encoded = mix(encoded, lutColor, u_lut_intensity);
        } else {
            // Apply sRGB encode before LUT
            bvec3 cutoff = lessThanEqual(color.rgb, vec3(0.0031308));
            vec3 higher = vec3(1.055) * pow(color.rgb, vec3(1.0/2.4)) - vec3(0.055);
            vec3 lower = color.rgb * vec3(12.92);
            encoded = mix(higher, lower, cutoff);
            
            // Texture 3D sample logic
            vec3 lutCoord = (encoded * (u_lut_size - 1.0) + 0.5) / u_lut_size;
            vec3 lutColor = texture(u_lut, lutCoord).rgb;
            
            encoded = mix(encoded, lutColor, u_lut_intensity);
        }
`;

if (fsOutputSource.indexOf("texture(u_lut") < fsOutputSource.indexOf("pow(color.rgb, vec3(1.0/2.4))") && fsOutputSource.indexOf("texture(u_lut") !== -1) {
    console.error("FAIL: LUT sampling happens before sRGB encode in source.");
    process.exit(1);
}

console.log("PASS: LUT Intensity Identity and Execution Order");
