with open('engine.js', 'r') as f:
    text = f.read()

# Replace JSON.parse(JSON.stringify(this.state)) with a proper deepClone
clone_func = """        const deepCloneState = (obj) => {
            const clone = {};
            for (let k in obj) {
                if (obj[k] instanceof Float32Array) {
                    clone[k] = new Float32Array(obj[k]);
                } else {
                    clone[k] = obj[k];
                }
            }
            return clone;
        };
        const S_before = deepCloneState(this.state);"""

text = text.replace('const S_before = JSON.parse(JSON.stringify(this.state));', clone_func)

with open('engine.js', 'w') as f:
    f.write(text)
