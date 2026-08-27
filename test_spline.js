function buildSpline(contrast, shadows, highlights, blacks, whites) {
    const x = [-8.0, -4.0, 0.0, 4.0, 8.0];
    let y = [...x];
    
    // 1. Contrast
    const c = Math.pow(2.0, contrast);
    for (let i = 0; i < 5; i++) {
        if (i !== 2) y[i] = x[i] * c;
    }
    
    // 2. Tonal sliders
    y[0] += blacks * 2.0;
    y[1] += shadows * 2.0;
    y[3] += highlights * 2.0;
    y[4] += whites * 2.0;
    
    // 3. Repair strict monotonicity (pivot is y[2] = 0)
    const gap = 0.05; // ensure strictly non-flat
    y[2] = 0.0;
    y[1] = Math.min(y[1], y[2] - gap);
    y[0] = Math.min(y[0], y[1] - gap);
    y[3] = Math.max(y[3], y[2] + gap);
    y[4] = Math.max(y[4], y[3] + gap);
    
    // 4. Fritsch-Carlson Tangents
    let delta = new Array(4);
    for (let i = 0; i < 4; i++) {
        delta[i] = (y[i+1] - y[i]) / (x[i+1] - x[i]);
    }
    
    let m = new Array(5).fill(0);
    m[0] = delta[0];
    m[4] = delta[3];
    for (let i = 1; i < 4; i++) {
        if (delta[i-1] * delta[i] <= 0) {
            m[i] = 0;
        } else {
            m[i] = (delta[i-1] + delta[i]) / 2.0;
        }
    }
    
    for (let i = 0; i < 4; i++) {
        if (delta[i] === 0) {
            m[i] = 0;
            m[i+1] = 0;
        } else {
            const alpha = m[i] / delta[i];
            const beta = m[i+1] / delta[i];
            const dist = alpha*alpha + beta*beta;
            if (dist > 9.0) {
                const tau = 3.0 / Math.sqrt(dist);
                m[i] = tau * alpha * delta[i];
                m[i+1] = tau * beta * delta[i];
            }
        }
    }
    
    return { x, y, m };
}

function evalCurve(x_val, spline) {
    const { x, y, m } = spline;
    
    // Extrapolation
    if (x_val <= x[0]) {
        return y[0] + m[0] * (x_val - x[0]);
    }
    if (x_val >= x[4]) {
        return y[4] + m[4] * (x_val - x[4]);
    }
    
    // Interpolation
    for (let i = 0; i < 4; i++) {
        if (x_val >= x[i] && x_val <= x[i+1]) {
            const h = x[i+1] - x[i];
            const t = (x_val - x[i]) / h;
            const t2 = t * t;
            const t3 = t2 * t;
            
            const h00 = 2*t3 - 3*t2 + 1;
            const h10 = t3 - 2*t2 + t;
            const h01 = -2*t3 + 3*t2;
            const h11 = t3 - t2;
            
            return h00 * y[i] + h10 * h * m[i] + h01 * y[i+1] + h11 * h * m[i+1];
        }
    }
    return x_val; // Fallback
}

// ---- TESTS ----

console.log("--- 1. Identity Test ---");
let idSpline = buildSpline(0,0,0,0,0);
let isId = true;
for (let v = -12; v <= 12; v += 1) {
    if (Math.abs(evalCurve(v, idSpline) - v) > 1e-6) isId = false;
}
console.log("Identity returned for all 0s:", isId);

console.log("\n--- 2. Chromaticity & Epsilon Handling Test ---");
function applyToneCurveRGB(r, g, b, spline) {
    let lin = 0.2126*r + 0.7152*g + 0.0722*b;
    let safe_lin = Math.max(lin, 1e-6);
    let ev = Math.log2(safe_lin / 0.18);
    
    let ev_out = evalCurve(ev, spline);
    let lout = 0.18 * Math.pow(2.0, ev_out);
    
    // if lin < 1e-6, scale is computed at 1e-6 to provide linear extension to 0
    let scale = lout / safe_lin;
    return [r * scale, g * scale, b * scale];
}

let test_rgb = [0.5, 0.2, 0.1];
let test_spline = buildSpline(0.5, -0.5, 0.8, -0.2, 1.0);
let out_rgb = applyToneCurveRGB(test_rgb[0], test_rgb[1], test_rgb[2], test_spline);
let rg_in = test_rgb[0] / test_rgb[1];
let rg_out = out_rgb[0] / out_rgb[1];
console.log(`R/G in: ${rg_in.toFixed(6)}, R/G out: ${rg_out.toFixed(6)}, Delta: ${Math.abs(rg_in - rg_out)}`);

console.log("\n--- 3. Monotonicity & Robustness Tests ---");
let min_deriv_global = 9999.0;
let has_nan = false;

function testSplineConfiguration(c, s, h, b, w) {
    let spline = buildSpline(c, s, h, b, w);
    
    // Check points from -12 to +12
    let prev_y = -99999.0;
    for (let x_val = -12.0; x_val <= 12.0; x_val += 0.1) {
        let y_val = evalCurve(x_val, spline);
        if (Number.isNaN(y_val) || !Number.isFinite(y_val)) {
            has_nan = true;
            return;
        }
        
        let deriv = (evalCurve(x_val + 1e-4, spline) - evalCurve(x_val - 1e-4, spline)) / 2e-4;
        if (deriv < min_deriv_global) min_deriv_global = deriv;
    }
}

// 3^5 = 243 Exhaustive discrete
let vals = [-1.0, 0.0, 1.0];
let count_243 = 0;
for (let c of vals) {
    for (let s of vals) {
        for (let h of vals) {
            for (let b of vals) {
                for (let w of vals) {
                    testSplineConfiguration(c, s, h, b, w);
                    count_243++;
                }
            }
        }
    }
}
console.log(`Discrete 243 combinations evaluated.`);

// 100,000 Random configs
for (let i = 0; i < 100000; i++) {
    let rc = (Math.random() * 2) - 1.0;
    let rs = (Math.random() * 2) - 1.0;
    let rh = (Math.random() * 2) - 1.0;
    let rb = (Math.random() * 2) - 1.0;
    let rw = (Math.random() * 2) - 1.0;
    testSplineConfiguration(rc, rs, rh, rb, rw);
}
console.log(`Continuous 100,000 random configurations evaluated.`);
console.log(`Global Minimum Derivative: ${min_deriv_global.toFixed(6)}`);
console.log(`Has NaN/Inf: ${has_nan}`);

