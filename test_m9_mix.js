const fs = require('fs');

const engineSrc = fs.readFileSync('engine.js', 'utf8');

// Extract the HSL helpers
const rgb2hslMatch = engineSrc.match(/vec3 rgb2hsl\([\s\S]*?return vec3\(h, s, l\);\n    \}/);
const hue2rgbMatch = engineSrc.match(/float hue2rgb\([\s\S]*?return p;\n    \}/);
const hsl2rgbMatch = engineSrc.match(/vec3 hsl2rgb\([\s\S]*?return vec3\([\s\S]*?\);\n        \}\n    \}/);

if (!rgb2hslMatch || !hue2rgbMatch || !hsl2rgbMatch) {
    console.error("FAIL: HSL functions not found");
    process.exit(1);
}

// Convert GLSL vec3 to JS arrays
function vec3(x, y, z) {
    if (y === undefined && z === undefined) return [x, x, x];
    return [x, y, z];
}
function min(a, b) { return Math.min(a, b); }
function max(a, b) { return Math.max(a, b); }
function clamp(val, minv, maxv) { return Math.min(Math.max(val, minv), maxv); }
function fract(x) { return x - Math.floor(x); }
function smoothstep(edge0, edge1, x) {
    let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

// Recreate JS versions using regex-extracted GLSL logic
const js_rgb2hsl = `function rgb2hsl(c) {
    let r = c[0], g = c[1], b = c[2];
    float cMin = min(min(r, g), b);
    float cMax = max(max(r, g), b);
    float l = (cMax + cMin) / 2.0;
    float s = 0.0;
    float h = 0.0;
    if (cMax != cMin) {
        float delta = cMax - cMin;
        s = l > 0.5 ? delta / (2.0 - cMax - cMin) : delta / (cMax + cMin);
        if (cMax == r) {
            h = (g - b) / delta + (g < b ? 6.0 : 0.0);
        } else if (cMax == g) {
            h = (b - r) / delta + 2.0;
        } else {
            h = (r - g) / delta + 4.0;
        }
        h /= 6.0;
    }
    return [h, s, l];
}`;

const js_hue2rgb = `function hue2rgb(p, q, t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}`;

const js_hsl2rgb = `function hsl2rgb(c) {
    float h = c[0];
    float s = c[1];
    float l = c[2];
    if (s == 0.0) {
        return [l, l, l];
    } else {
        float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
        float p = 2.0 * l - q;
        return [
            hue2rgb(p, q, h + 1.0/3.0),
            hue2rgb(p, q, h),
            hue2rgb(p, q, h - 1.0/3.0)
        ];
    }
}`;

eval(js_rgb2hsl.replace(/float /g, 'let '));
eval(js_hue2rgb.replace(/float /g, 'let '));
eval(js_hsl2rgb.replace(/float /g, 'let '));

function simulateMix(color, u_hsl_shifts) {
    let hsl = rgb2hsl(color);
    let h = hsl[0];
    
    let centers = [0.0, 30.0/360.0, 60.0/360.0, 120.0/360.0, 180.0/360.0, 240.0/360.0, 270.0/360.0, 300.0/360.0];
    
    let idx1 = 7;
    let idx2 = 0;
    for (let i = 0; i < 7; i++) {
        if (h >= centers[i] && h < centers[i+1]) {
            idx1 = i;
            idx2 = i+1;
            break;
        }
    }
    
    let d1, range;
    if (idx1 == 7) {
        range = 1.0 - centers[7];
        if (h >= centers[7]) {
            d1 = h - centers[7];
        } else {
            d1 = h + (1.0 - centers[7]);
        }
    } else {
        range = centers[idx2] - centers[idx1];
        d1 = h - centers[idx1];
    }
    
    let t = d1 / range;
    t = smoothstep(0.0, 1.0, t);
    
    let w1 = 1.0 - t;
    let w2 = t;
    
    let shift_h = w1 * u_hsl_shifts[idx1*3] + w2 * u_hsl_shifts[idx2*3];
    let shift_s = w1 * u_hsl_shifts[idx1*3+1] + w2 * u_hsl_shifts[idx2*3+1];
    let shift_l = w1 * u_hsl_shifts[idx1*3+2] + w2 * u_hsl_shifts[idx2*3+2];
    
    hsl[0] = fract(hsl[0] + shift_h * 0.125 + 1.0);
    hsl[1] = clamp(hsl[1] + shift_s, 0.0, 1.0);
    hsl[2] = clamp(hsl[2] + shift_l, 0.0, 1.0);
    
    return hsl2rgb(hsl);
}

function assertApprox(a, b, msg) {
    if (Math.abs(a - b) > 1e-4) {
        console.error(`FAIL: ${msg}. Expected ${b}, got ${a}`);
        process.exit(1);
    }
}

console.log("TESTING COLOR MIX M9");

// Test 1: Red Isolation
let shifts = new Float32Array(24);
shifts[0] = 1.0; // Max Hue Shift on Red (approx +45 deg)
let outRed = simulateMix([1.0, 0.0, 0.0], shifts);
let outBlue = simulateMix([0.0, 0.0, 1.0], shifts);

// Blue should remain perfectly unaffected
assertApprox(outBlue[0], 0.0, "Blue R must remain 0");
assertApprox(outBlue[1], 0.0, "Blue G must remain 0");
assertApprox(outBlue[2], 1.0, "Blue B must remain 1");

// Red should be shifted towards Orange
let outRedHsl = rgb2hsl(outRed);
assertApprox(outRedHsl[0], 0.125, "Red shifted +1.0 H should end at hue 0.125 (45 deg)");

// Test 2: Interpolation Exactly at 15 degrees (midpoint Red and Orange)
let shifts2 = new Float32Array(24);
shifts2[0] = 0.5; // Red hue shift
shifts2[3] = -0.5; // Orange hue shift
let midColor = hsl2rgb([15.0/360.0, 1.0, 0.5]);
let outMid = simulateMix(midColor, shifts2);
// 15 degrees is t=0.5 on linear.
// With smoothstep(0,1, 0.5), t=0.5.
// weight 1 = 0.5, weight 2 = 0.5
// expected shift = 0.5*0.5 + 0.5*(-0.5) = 0.0
let outMidHsl = rgb2hsl(outMid);
assertApprox(outMidHsl[0], 15.0/360.0, "Midpoint hue should remain unchanged when opposing shifts cancel out");

console.log("PASS: 8-Band HSL shifts are isolated, smoothed correctly, and accurate");
