function buildSpline(contrast, shadows, highlights, blacks, whites) {
    const x = [-8.0, -4.0, 0.0, 4.0, 8.0];
    let y = [...x];
    const MAX_OFFSET = 2.0;
    const c = Math.pow(2.0, contrast);
    for (let i = 0; i < 5; i++) {
        if (i !== 2) y[i] = x[i] * c;
    }
    y[0] += blacks * MAX_OFFSET;
    y[1] += shadows * MAX_OFFSET;
    y[3] += highlights * MAX_OFFSET;
    y[4] += whites * MAX_OFFSET;
    
    const gap = 0.05;
    y[2] = 0.0;
    y[1] = Math.min(y[1], y[2] - gap);
    y[0] = Math.min(y[0], y[1] - gap);
    y[3] = Math.max(y[3], y[2] + gap);
    y[4] = Math.max(y[4], y[3] + gap);
    
    let delta = new Array(4);
    for (let i = 0; i < 4; i++) delta[i] = (y[i+1] - y[i]) / (x[i+1] - x[i]);
    
    let m = new Array(5).fill(0);
    m[0] = delta[0]; m[4] = delta[3];
    for (let i = 1; i < 4; i++) {
        if (delta[i-1] * delta[i] <= 0) m[i] = 0;
        else m[i] = (delta[i-1] + delta[i]) / 2.0;
    }
    for (let i = 0; i < 4; i++) {
        if (delta[i] === 0) { m[i]=0; m[i+1]=0; }
        else {
            const alpha = m[i]/delta[i];
            const beta = m[i+1]/delta[i];
            const dist = alpha*alpha + beta*beta;
            if (dist > 9.0) {
                const tau = 3.0/Math.sqrt(dist);
                m[i] = tau*alpha*delta[i];
                m[i+1] = tau*beta*delta[i];
            }
        }
    }
    return { x, y, m };
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
        let diff = yv - prev_y;
        if (xv > -12 && diff < min_derivative) {
            min_derivative = diff; // Note diff per 0.1 step
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

let randCount = 100000;
for(let i=0; i<randCount; i++) {
    let c = (Math.random()*2 - 1);
    let s = (Math.random()*2 - 1);
    let h = (Math.random()*2 - 1);
    let b = (Math.random()*2 - 1);
    let w = (Math.random()*2 - 1);
    let sp = buildSpline(c,s,h,b,w);
    let x_test = (Math.random()*24 - 12);
    let y1 = evalSpline(sp, x_test);
    let y2 = evalSpline(sp, x_test + 0.01);
    let deriv = (y2 - y1) / 0.01;
    if (deriv < min_derivative) min_derivative = deriv;
    assert(y2 >= y1 - 1e-6, "Monotonicity failed at x=" + x_test);
}
console.log(`Tested ${randCount} random float configurations [-1.0, 1.0]^5.`);
console.log(`Min derivative encountered (should be >= 0): ${min_derivative.toFixed(6)}`);
console.log(`Max pivot f(0) deviation (should be 0): ${max_pivot_err}`);
console.log("PASS: Spline Tone Mapping M5");
