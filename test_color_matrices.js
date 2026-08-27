const assert = require('assert');

// Matrices from reference.js / engine.js
const M_SRGB_TO_LMS = [
    [0.422725, 0.491345, 0.027358],
    [0.055700, 0.961534, 0.023184],
    [0.021383, 0.087642, 0.980508]
];

const M_LMS_TO_SRGB = [
    [2.538047, -1.293278, -0.040237],
    [-0.146005, 1.116649, -0.022329],
    [-0.042299, -0.071607, 1.022753]
];

function multiply(a, b) {
    let res = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                res[i][j] += a[i][k] * b[k][j];
            }
        }
    }
    return res;
}

const prod = multiply(M_LMS_TO_SRGB, M_SRGB_TO_LMS);

let maxError = 0;
for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
        const expected = (i === j) ? 1.0 : 0.0;
        const err = Math.abs(prod[i][j] - expected);
        if (err > maxError) maxError = err;
    }
}

console.log(`Max identity residual: ${maxError}`);
assert(maxError < 1e-5, `Matrix product is not identity! Max error: ${maxError}`);
console.log("White Balance matrices verified: Product is Identity within tolerance.");
