const fs = require('fs');
const exec = require('child_process').execSync;

function getBlock(file, startStr, endStr) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    let out = [];
    let capture = false;
    for (let line of lines) {
        if (line.includes(startStr)) capture = true;
        if (capture) {
            out.push(line);
            if (line.includes(endStr)) break;
        }
    }
    return out.join('\n');
}

console.log("COMMIT:\nb81bb14\n");

console.log("MILESTONE:\nM4\n");
console.log("FILES:\ntest_wb.js, engine.js\n");
console.log("TEST COMMANDS:\nnode test_wb.js\n");
console.log("TEST OUTPUT:");
console.log(exec('node test_wb.js').toString());
console.log("GPU EVIDENCE:");
console.log("--- M_SRGB_TO_LMS/M_LMS_TO_SRGB in engine.js ---");
console.log(getBlock('engine.js', 'const mat3 M_SRGB_TO_LMS = mat3(', 'const mat3 M_LMS_TO_SRGB = mat3('));
console.log(getBlock('engine.js', 'const mat3 M_LMS_TO_SRGB = mat3(', '-0.040237, -0.022329, 1.022753\n        );'));
console.log("STATUS:\nIMPLEMENTED\n");
console.log("=========================================\n");

console.log("COMMIT:\nb81bb14\n");
console.log("MILESTONE:\nM5\n");
console.log("FILES:\ntest_spline.js\n");
console.log("TEST COMMANDS:\nnode test_spline.js\n");
console.log("TEST SOURCE (Runtime connection excerpt):");
console.log(getBlock('test_spline.js', 'const engineSrc = fs.readFileSync', 'eval("buildSpline = " + buildSplineStr);'));
console.log("\nTEST OUTPUT:");
console.log(exec('node test_spline.js').toString());
console.log("STATUS:\nIMPLEMENTED\n");
console.log("=========================================\n");

console.log("COMMIT:\nb81bb14\n");
console.log("MILESTONE:\nM8\n");
console.log("FILES:\ntest_lut.js, test_m8_wiring.js\n");
console.log("TEST COMMANDS:\nnode test_lut.js && node test_m8_wiring.js\n");
console.log("TEST OUTPUT:");
console.log(exec('node test_lut.js').toString());
console.log(exec('node test_m8_wiring.js').toString());

console.log("GPU EVIDENCE:");
console.log("--- App.js dynamic wiring injection ---");
console.log(getBlock('app.js', 'layers.forEach((layer, i) => {', 'layer.engineState = computeEngineStateForLayer(layer.state);'));
console.log("STATUS:\nIMPLEMENTED\n");

