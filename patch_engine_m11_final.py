import re

with open('engine.js', 'r') as f:
    text = f.read()

# Fix deepCloneState
clone_old = """        const deepCloneState = (obj) => {
            const clone = {};
            for (let k in obj) {
                if (obj[k] instanceof Float32Array) {
                    clone[k] = new Float32Array(obj[k]);
                } else {
                    clone[k] = obj[k];
                }
            }
            return clone;
        };"""

clone_new = """        const deepCloneState = (obj) => {
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
        };"""
text = text.replace(clone_old, clone_new)

# Remove this.state = S_before;
text = text.replace('this.state = S_before;', '// this.state = S_before; removed to prove non-mutation')

with open('engine.js', 'w') as f:
    f.write(text)
