function calculateWBScale(tempUI, tintUI) {
    if (tempUI === 0.0 && tintUI === 0.0) return [1.0, 1.0, 1.0];

    const get_uv = (T) => {
        let xp, yp, xd, yd, x, y;
        xp = -0.2661239 * (1e9 / (T*T*T)) - 0.2343589 * (1e6 / (T*T)) + 0.8776956 * (1e3 / T) + 0.179910;
        if (T <= 2222) {
            yp = -1.1063814 * (xp*xp*xp) - 1.34811020 * (xp*xp) + 2.18555832 * xp - 0.20219683;
        } else {
            yp = -0.9549476 * (xp*xp*xp) - 1.37418593 * (xp*xp) + 2.09137015 * xp - 0.16748867;
        }
        if (T <= 7000) {
            xd = -4.6070 * (1e9 / (T*T*T)) + 2.9678 * (1e6 / (T*T)) + 0.09911 * (1e3 / T) + 0.244063;
        } else {
            xd = -2.0064 * (1e9 / (T*T*T)) + 1.9018 * (1e6 / (T*T)) + 0.24748 * (1e3 / T) + 0.237040;
        }
        yd = -3.000 * (xd*xd) + 2.870 * xd - 0.275;
        
        if (T < 4000) { x = xp; y = yp; }
        else if (T > 5000) { x = xd; y = yd; }
        else {
            let t = (T - 4000.0) / 1000.0;
            let alpha = t * t * (3.0 - 2.0 * t);
            x = xp + (xd - xp) * alpha;
            y = yp + (yd - yp) * alpha;
        }
        let u = (4.0 * x) / (-2.0 * x + 12.0 * y + 3.0);
        let v = (6.0 * y) / (-2.0 * x + 12.0 * y + 3.0);
        return [u, v];
    };

    const mired_neutral = 1000000.0 / 6504.0;
    const mired_warm = 1000000.0 / 15000.0;
    const mired_cool = 1000000.0 / 2000.0;
    
    let mired;
    if (tempUI < 0) {
        mired = mired_neutral + (-tempUI) * (mired_cool - mired_neutral);
    } else {
        mired = mired_neutral + tempUI * (mired_warm - mired_neutral);
    }
    const T = 1000000.0 / mired;
    
    let uv0 = get_uv(T);
    let uv1 = get_uv(T + 0.1);
    let du = uv1[0] - uv0[0];
    let dv = uv1[1] - uv0[1];
    let len = Math.sqrt(du*du + dv*dv);
    
    const TINT_SCALE = 0.015;
    let u = uv0[0] + tintUI * TINT_SCALE * (-dv / len);
    let v = uv0[1] + tintUI * TINT_SCALE * (du / len);
    
    let x = (3.0 * u) / (2.0 * u - 8.0 * v + 4.0);
    let y = (2.0 * v) / (2.0 * u - 8.0 * v + 4.0);
    
    const Y = 1.0;
    const X = (x * Y) / y;
    const Z = ((1.0 - x - y) * Y) / y;
    
    const M_BFD = [
        [ 0.8951,  0.2664, -0.1614],
        [-0.7502,  1.7135,  0.0367],
        [ 0.0389, -0.0685,  1.0296]
    ];
    
    const lms_source = [
        M_BFD[0][0]*X + M_BFD[0][1]*Y + M_BFD[0][2]*Z,
        M_BFD[1][0]*X + M_BFD[1][1]*Y + M_BFD[1][2]*Z,
        M_BFD[2][0]*X + M_BFD[2][1]*Y + M_BFD[2][2]*Z
    ];
    
    const x_D65 = 0.31271;
    const y_D65 = 0.32902;
    const X_D65 = (x_D65 * Y) / y_D65;
    const Z_D65 = ((1.0 - x_D65 - y_D65) * Y) / y_D65;
    const lms_D65 = [
        M_BFD[0][0]*X_D65 + M_BFD[0][1]*Y + M_BFD[0][2]*Z_D65,
        M_BFD[1][0]*X_D65 + M_BFD[1][1]*Y + M_BFD[1][2]*Z_D65,
        M_BFD[2][0]*X_D65 + M_BFD[2][1]*Y + M_BFD[2][2]*Z_D65
    ];
    
    return [
        lms_D65[0] / lms_source[0],
        lms_D65[1] / lms_source[1],
        lms_D65[2] / lms_source[2]
    ];
}

console.log("TESTING WHITE BALANCE (M4)");

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        process.exit(1);
    }
}

function check(arr) {
    for (let i = 0; i < arr.length; i++) {
        assert(!isNaN(arr[i]) && isFinite(arr[i]), "NaN or Inf detected");
    }
}

// 1. Identity
let id = calculateWBScale(0.0, 0.0);
console.log("identity (0,0):", id);
assert(id[0] === 1.0 && id[1] === 1.0 && id[2] === 1.0, "Identity at 0,0 failed");

// 2. Continuity around 0
let t_eps = calculateWBScale(0.0001, 0.0);
let t_m_eps = calculateWBScale(-0.0001, 0.0);
assert(Math.abs(t_eps[0] - t_m_eps[0]) < 0.01, "Discontinuity at temp=0");

// 3. Extremes
let extreme_cool = calculateWBScale(-1.0, 0.0);
let extreme_warm = calculateWBScale(1.0, 0.0);
check(extreme_cool);
check(extreme_warm);

console.log("extreme_cool (2000K):", extreme_cool);
console.log("extreme_warm (15000K):", extreme_warm);

// 4. Tint
let tint_pos = calculateWBScale(0.0, 1.0);
let tint_neg = calculateWBScale(0.0, -1.0);
check(tint_pos);
check(tint_neg);
console.log("tint_pos:", tint_pos);
console.log("tint_neg:", tint_neg);

console.log("PASS: White Balance M4");

