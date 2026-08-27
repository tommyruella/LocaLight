class ColorReference {
    static get M_SRGB_TO_LMS() {
        return [
            [0.422725, 0.491345, 0.027358],
            [0.055700, 0.961534, 0.023184],
            [0.021383, 0.087642, 0.980508]
        ];
    }
    
    static get M_LMS_TO_SRGB() {
        return [
            [2.538045, -1.293277, -0.040237],
            [-0.146004, 1.116648, -0.022329],
            [-0.042299, -0.071607, 1.022753]
        ];
    }

    static linearizeSRGB(srgb) {
        return srgb.map(c => {
            if (c <= 0.04045) return c / 12.92;
            return Math.pow((c + 0.055) / 1.055, 2.4);
        });
    }

    static encodeSRGB(linear) {
        return linear.map(c => {
            c = Math.max(0, Math.min(1, c));
            if (c <= 0.0031308) return c * 12.92;
            return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        });
    }

    static exposure(linear, ev) {
        const mult = Math.pow(2.0, ev);
        return linear.map(c => c * mult);
    }
    
    

    static calculateWBScale(tempUI, tintUI) {
        if (tempUI === 0.0 && tintUI === 0.0) {
            return [1.0, 1.0, 1.0];
        }

        const get_uv = (T) => {
            let xp, yp, xd, yd, x, y;
            // Planckian
            xp = -0.2661239 * (1e9 / (T*T*T)) - 0.2343589 * (1e6 / (T*T)) + 0.8776956 * (1e3 / T) + 0.179910;
            if (T <= 2222) {
                yp = -1.1063814 * (xp*xp*xp) - 1.34811020 * (xp*xp) + 2.18555832 * xp - 0.20219683;
            } else {
                yp = -0.9549476 * (xp*xp*xp) - 1.37418593 * (xp*xp) + 2.09137015 * xp - 0.16748867;
            }
            // Daylight
            if (T <= 7000) {
                xd = -4.6070 * (1e9 / (T*T*T)) + 2.9678 * (1e6 / (T*T)) + 0.09911 * (1e3 / T) + 0.244063;
            } else {
                xd = -2.0064 * (1e9 / (T*T*T)) + 1.9018 * (1e6 / (T*T)) + 0.24748 * (1e3 / T) + 0.237040;
            }
            yd = -3.000 * (xd*xd) + 2.870 * xd - 0.275;
            
            if (T < 4000) {
                x = xp; y = yp;
            } else if (T > 5000) {
                x = xd; y = yd;
            } else {
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
        let uv1 = get_uv(T + 1.0);
        let du = uv1[0] - uv0[0];
        let dv = uv1[1] - uv0[1];
        let len = Math.sqrt(du*du + dv*dv);
        
        let u = uv0[0] + tintUI * 0.015 * (-dv / len);
        let v = uv0[1] + tintUI * 0.015 * (du / len);
        
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

    static whiteBalance(linear, temp, tint) {
        if (temp === 0.0 && tint === 0.0) return [...linear];
        
        const scale = this.calculateWBScale(temp, tint);
        
        const M1 = this.M_SRGB_TO_LMS;
        let lms = [
            M1[0][0]*linear[0] + M1[0][1]*linear[1] + M1[0][2]*linear[2],
            M1[1][0]*linear[0] + M1[1][1]*linear[1] + M1[1][2]*linear[2],
            M1[2][0]*linear[0] + M1[2][1]*linear[1] + M1[2][2]*linear[2]
        ];
        
        lms[0] *= scale[0];
        lms[1] *= scale[1];
        lms[2] *= scale[2];
        
        const M2 = this.M_LMS_TO_SRGB;
        let out = [
            M2[0][0]*lms[0] + M2[0][1]*lms[1] + M2[0][2]*lms[2],
            M2[1][0]*lms[0] + M2[1][1]*lms[1] + M2[1][2]*lms[2],
            M2[2][0]*lms[0] + M2[2][1]*lms[1] + M2[2][2]*lms[2]
        ];
        
        return out;
    }
}


if (typeof module !== 'undefined') {
    module.exports = ColorReference;
}
