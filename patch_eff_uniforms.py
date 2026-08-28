import re
with open('engine.js', 'r') as f:
    content = f.read()

c1 = r'gl\.uniform1f\(this\.outputLocs\[\'u_lut_size\'\], this\.lutSize \|\| 1\.0\);'
c2 = r"""gl.uniform1f(this.outputLocs['u_lut_size'], this.lutSize || 1.0);
            let globalSharpness = 0.0;
            let globalGrain = 0.0;
            if (layersArray && layersArray.length > 0) {
                const active = layersArray.find(l => l.active) || layersArray[0];
                if (active.engineState) {
                    globalSharpness = active.engineState['u_sharpness'] || 0.0;
                    globalGrain = active.engineState['u_grain'] || 0.0;
                }
            } else if (!this.bypassed) {
                globalSharpness = this.state['u_sharpness'] || 0.0;
                globalGrain = this.state['u_grain'] || 0.0;
            }
            gl.uniform1f(this.outputLocs['u_sharpness'], globalSharpness);
            gl.uniform1f(this.outputLocs['u_grain'], globalGrain);"""
content = re.sub(c1, c2, content)

with open('engine.js', 'w') as f:
    f.write(content)
