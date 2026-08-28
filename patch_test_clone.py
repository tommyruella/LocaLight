with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

clone_func = """
    function deepCloneState(obj) {
        let clone = {};
        for (let k in obj) {
            if (obj[k] instanceof Float32Array) clone[k] = new Float32Array(obj[k]);
            else clone[k] = obj[k];
        }
        return clone;
    }
    const S_before = deepCloneState(engine.state);
"""
text = text.replace('const S_before = JSON.parse(JSON.stringify(engine.state));', clone_func)
text = text.replace('const S_after = JSON.parse(JSON.stringify(engine.state));', 'const S_after = deepCloneState(engine.state);')

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
