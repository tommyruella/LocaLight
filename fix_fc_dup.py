import re

with open('engine.js', 'r') as f:
    engine = f.read()

bad_dup = """        // 1. Initialize tangents with average slope
        m[0] = delta[0];
        m[4] = delta[3];
        for (let i = 1; i < 4; i++) {
            if (delta[i-1] * delta[i] <= 0) {
                m[i] = 0;
            } else {
                m[i] = (delta[i-1] + delta[i]) / 2.0;
            }
        }
        
        // 2. Fritsch-Carlson monotone correction
        for (let i = 0; i < 4; i++) {
            if (delta[i] === 0.0) {
                m[i] = 0.0;
                m[i+1] = 0.0;
            } else {
                let alpha = m[i] / delta[i];
                let beta = m[i+1] / delta[i];
                let tau = alpha * alpha + beta * beta;
                if (tau > 9.0) {
                    let scale = 3.0 / Math.sqrt(tau);
                    m[i] = alpha * scale * delta[i];
                    m[i+1] = beta * scale * delta[i];
                }
            }
        }"""

good_original = """        m[0] = delta[0];
        m[4] = delta[3];
        for (let i = 1; i < 4; i++) {
            if (delta[i-1] * delta[i] <= 0) {
                m[i] = 0;
            } else {
                m[i] = (delta[i-1] + delta[i]) / 2.0;
            }
        }"""

engine = engine.replace(bad_dup, good_original)

with open('engine.js', 'w') as f:
    f.write(engine)
