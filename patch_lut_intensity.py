import re

with open('engine.js', 'r') as f:
    engine = f.read()

old_logic = "gl.uniform1f(this.outputLocs['u_lut_intensity'], this.state['u_lut_intensity'] || 0.0);"
new_logic = """            let globalIntensity = 0.0;
            if (layersArray && layersArray.length > 0) {
                const active = layersArray.find(l => l.active) || layersArray[0];
                if (active.engineState && active.engineState['u_lut_intensity'] !== undefined) {
                    globalIntensity = active.engineState['u_lut_intensity'];
                }
            }
            gl.uniform1f(this.outputLocs['u_lut_intensity'], globalIntensity);"""

engine = engine.replace(old_logic, new_logic)

with open('engine.js', 'w') as f:
    f.write(engine)
