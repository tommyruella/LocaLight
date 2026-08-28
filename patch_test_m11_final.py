with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# Fix deepCloneState in test
clone_old = """    function deepCloneState(obj) {
        let clone = {};
        for (let k in obj) {
            if (obj[k] instanceof Float32Array) clone[k] = new Float32Array(obj[k]);
            else clone[k] = obj[k];
        }
        return clone;
    }"""
clone_new = """    function deepCloneState(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Float32Array) return new Float32Array(obj);
        if (Array.isArray(obj)) return obj.map(deepCloneState);
        const clone = {};
        for (let k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
                clone[k] = deepCloneState(obj[k]);
            }
        }
        return clone;
    }"""
text = text.replace(clone_old, clone_new)

# Add deepEqual
deep_equal = """    function deepEqual(a, b) {
        if (a === b) return true;
        if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') return false;
        if (a instanceof Float32Array && b instanceof Float32Array) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
            return true;
        }
        if (Array.isArray(a) !== Array.isArray(b)) return false;
        const keysA = Object.keys(a), keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (let key of keysA) {
            if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
        }
        return true;
    }"""
text = text.replace('function isIdenticalObj', deep_equal + '\n    function isIdenticalObj')

# Update T3 to compare state and GL
text = text.replace(
"""    const S_after = deepCloneState(engine.state);
    const postPixels = new Uint8Array(1024 * 1024 * 4);
    engine.render(null, 1024, 1024, engine.compAFbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, engine.compAFbo);
    gl.readPixels(0, 0, 1024, 1024, gl.RGBA, gl.UNSIGNED_BYTE, postPixels);

    function isIdenticalObj(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
    function isIdenticalArr(a, b) { for(let i=0; i<a.length; i++) if(a[i]!==b[i]) return false; return true; }

    log("T3: State and UI pixels are unmutated after export", 
        isIdenticalObj(S_before, S_after) && isIdenticalArr(prePixels, postPixels));""",
"""    const S_after = deepCloneState(engine.state);
    const GL_after = {
        viewport: gl.getParameter(gl.VIEWPORT),
        readFbo: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
        drawFbo: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
        rbo: gl.getParameter(gl.RENDERBUFFER_BINDING),
        prog: gl.getParameter(gl.CURRENT_PROGRAM)
    };
    
    const postPixels = new Uint8Array(1024 * 1024 * 4);
    engine.render(null, 1024, 1024, engine.compAFbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, engine.compAFbo);
    gl.readPixels(0, 0, 1024, 1024, gl.RGBA, gl.UNSIGNED_BYTE, postPixels);

    function isIdenticalArr(a, b) { for(let i=0; i<a.length; i++) if(a[i]!==b[i]) return false; return true; }

    const stateEq = deepEqual(S_before, S_after);
    const glEq = deepEqual(GL_before, GL_after);
    const pixEq = isIdenticalArr(prePixels, postPixels);

    log("T3: State, GL config, and UI pixels are unmutated after export", 
        stateEq && glEq && pixEq, { stateEq, glEq, pixEq });"""
)

# Update T2a to check NO_ERROR
text = text.replace(
    'expObj && expObj.width === 1024 && expObj.height === 1024 && expObj.pixels.length === 1024 * 1024 * 4);',
    'expObj && expObj.width === 1024 && expObj.height === 1024 && expObj.pixels.length === 1024 * 1024 * 4 && gl.getError() === gl.NO_ERROR);'
)

# Update T2b to check preview restoration
text = text.replace(
"""    try { engine.export(); } catch(e) { exceptionCaught = true; }
    gl.checkFramebufferStatus = origCheck;
    const err = gl.getError(); 
    log("T2b: Invalid Framebuffer throws gracefully", checkCalled && exceptionCaught && err === gl.NO_ERROR);""",
"""    
    const preFailPixels = new Uint8Array(1024 * 1024 * 4);
    engine.render(null, 1024, 1024, engine.compAFbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, engine.compAFbo);
    gl.readPixels(0, 0, 1024, 1024, gl.RGBA, gl.UNSIGNED_BYTE, preFailPixels);
    
    try { engine.export(); } catch(e) { exceptionCaught = true; }
    gl.checkFramebufferStatus = origCheck;
    
    const postFailPixels = new Uint8Array(1024 * 1024 * 4);
    engine.render(null, 1024, 1024, engine.compAFbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, engine.compAFbo);
    gl.readPixels(0, 0, 1024, 1024, gl.RGBA, gl.UNSIGNED_BYTE, postFailPixels);
    
    const err = gl.getError();
    const previewRestored = isIdenticalArr(preFailPixels, postFailPixels);
    
    log("T2b: Invalid Framebuffer throws gracefully and restores preview", 
        checkCalled && exceptionCaught && err === gl.NO_ERROR && previewRestored,
        { exceptionCaught, err, previewRestored });"""
)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
