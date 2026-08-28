const fs = require('fs');
const engineSrc = fs.readFileSync('engine.js', 'utf8');

const match = engineSrc.match(/buildSpline\([\s\S]*?return \{ x, y, m \};\n    \}/);
if (!match) {
    console.error("FAIL: buildSpline not found in engine.js");
    process.exit(1);
}

// Convert it to a standalone function
const buildSplineStr = "function " + match[0];
// Use eval to instantiate the function in this scope
let buildSpline;
try {
    eval("buildSpline = " + buildSplineStr);
} catch(e) {
    console.error("FAIL: Could not eval buildSpline", e);
    process.exit(1);
}

function evalSpline(sp, x_val) {
    if (x_val <= sp.x[0]) return sp.y[0] + sp.m[0]*(x_val - sp.x[0]);
    if (x_val >= sp.x[4]) return sp.y[4] + sp.m[4]*(x_val - sp.x[4]);
    for (let i = 0; i < 4; i++) {
        if (x_val >= sp.x[i] && x_val <= sp.x[i+1]) {
            let h = sp.x[i+1] - sp.x[i];
            let t = (x_val - sp.x[i])/h;
            let t2 = t*t;
            let t3 = t2*t;
            let h00 = 2.0*t3 - 3.0*t2 + 1.0;
            let h10 = t3 - 2.0*t2 + t;
            let h01 = -2.0*t3 + 3.0*t2;
            let h11 = t3 - t2;
            return h00*sp.y[i] + h10*h*sp.m[i] + h01*sp.y[i+1] + h11*h*sp.m[i+1];
        }
    }
    return x_val;
}

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        process.exit(1);
    }
}

console.log("TESTING SPLINE M5");

let id_sp = buildSpline(0,0,0,0,0);
for (let xv = -12; xv <= 12; xv += 0.5) {
    let yv = evalSpline(id_sp, xv);
    assert(Math.abs(yv - xv) < 1e-5, "Identity failed at x=" + xv);
}

let min_derivative = Infinity;
let max_pivot_err = 0;

function checkMonotonicity(sp) {
    let prev_y = -Infinity;
    for (let xv = -12; xv <= 12; xv += 0.1) {
        let yv = evalSpline(sp, xv);
        assert(!isNaN(yv) && isFinite(yv), "NaN/Inf detected");
        
        if (xv > -12) {
            let deriv = (yv - prev_y) / 0.1; // normalized step
            if (deriv < min_derivative) min_derivative = deriv;
        }
        
        assert(yv >= prev_y - 1e-6, "Monotonicity failed: " + yv + " < " + prev_y);
        prev_y = yv;
    }
    let pivot = Math.abs(evalSpline(sp, 0.0));
    if (pivot > max_pivot_err) max_pivot_err = pivot;
}

let vals = [-1, 0, 1];
let count = 0;
for(let c of vals) {
  for(let s of vals) {
    for(let h of vals) {
      for(let b of vals) {
        for(let w of vals) {
          let sp = buildSpline(c,s,h,b,w);
          checkMonotonicity(sp);
          count++;
        }
      }
    }
  }
}
console.log(`Tested ${count} deterministic extreme configurations [-1,0,1]^5.`);

// Deterministic seed for PRNG to satisfy ChatGPT "seed deterministico"
let seed = 12345;
function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

let randCount = 100000;
for(let i=0; i<randCount; i++) {
    let c = (random()*2 - 1);
    let s = (random()*2 - 1);
    let h = (random()*2 - 1);
    let b = (random()*2 - 1);
    let w = (random()*2 - 1);
    let sp = buildSpline(c,s,h,b,w);
    let x_test = (random()*24 - 12);
    let y1 = evalSpline(sp, x_test);
    let y2 = evalSpline(sp, x_test + 0.01);
    let deriv = (y2 - y1) / 0.01;
    if (deriv < min_derivative) min_derivative = deriv;
    assert(y2 >= y1 - 1e-6, "Monotonicity failed at x=" + x_test);
}
console.log(`Tested ${randCount} random float configurations [-1.0, 1.0]^5 (seeded).`);
console.log(`Min derivative encountered (should be >= 0): ${min_derivative.toFixed(6)}`);
console.log(`Max pivot f(0) deviation (should be 0): ${max_pivot_err}`);
console.log("PASS: Spline Tone Mapping M5");

