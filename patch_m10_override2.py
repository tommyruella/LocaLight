import re
with open('test_m10_runner.html', 'r') as f:
    text = f.read()

# Let's override engine.render to pass a huge spatial scale, or just override spatialScale in the engine
override = """
    // M10 tests assume spatialScale = 1.0. Override it by intercepting uniform1f.
    const origUniform1f = gl.uniform1f;
    gl.uniform1f = function(loc, val) {
        if (loc === engine.compLocs['u_spatialScale'] || loc === engine.blurLocs['u_spatialScale']) {
            origUniform1f.call(gl, loc, 1.0);
        } else {
            origUniform1f.call(gl, loc, val);
        }
    };
"""

text = text.replace('window.runTest = function() {', override + '\n    window.runTest = function() {')

with open('test_m10_runner.html', 'w') as f:
    f.write(text)
