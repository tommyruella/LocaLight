const assert = require('assert');
const ColorReference = require('./reference');

function approxEqual(actual, expected, tol = 1e-4) {
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) {
        if (Math.abs(actual[i] - expected[i]) > tol) return false;
    }
    return true;
}

const srgbInput = [0.1, 0.5, 0.9];
const linear = ColorReference.linearizeSRGB(srgbInput);

console.log('Exposure Tests:');
console.log('EV 0  (1x):', approxEqual(ColorReference.exposure(linear, 0), linear));
console.log('EV +1 (2x):', approxEqual(ColorReference.exposure(linear, 1), linear.map(x => x * 2.0)));
console.log('EV +2 (4x):', approxEqual(ColorReference.exposure(linear, 2), linear.map(x => x * 4.0)));
console.log('EV -1 (0.5x):', approxEqual(ColorReference.exposure(linear, -1), linear.map(x => x * 0.5)));
console.log('EV -2 (0.25x):', approxEqual(ColorReference.exposure(linear, -2), linear.map(x => x * 0.25)));

console.log('\nWhite Balance Tests:');

const gray = [0.18, 0.18, 0.18];
const grayWB = ColorReference.whiteBalance(gray, 0, 0);
console.log('Neutrality/Grayscale (Temp=0, Tint=0) == Input:', approxEqual(gray, grayWB));

const hdrLinear = [1.2, 0.8, 0.5];
const hdrWB = ColorReference.whiteBalance(hdrLinear, 1.0, 0.5);
console.log('HDR Safe (No NaN/Inf on values > 1):', !hdrWB.some(x => isNaN(x) || !isFinite(x)));

const wbExtreme = ColorReference.whiteBalance(gray, 5.0, -5.0);
console.log('Extreme stability (Temp=5, Tint=-5):', !wbExtreme.some(x => isNaN(x) || !isFinite(x)));
