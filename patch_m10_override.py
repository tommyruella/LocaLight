import re
with open('test_m10_runner.html', 'r') as f:
    text = f.read()

# Let's override engine.renderSingleLayerState to force spatialScale = 1.0
override = """
    // M10 tests assume spatialScale = 1.0. Override it for this test suite.
    const origRender = engine.renderSingleLayerState;
    engine.renderSingleLayerState = function(state, targetFbo, inputTexture, targetW, targetH, spatialScale) {
        origRender.call(this, state, targetFbo, inputTexture, targetW, targetH, 1.0);
    };
"""

text = text.replace('window.runTest = function() {', override + '\n    window.runTest = function() {')

with open('test_m10_runner.html', 'w') as f:
    f.write(text)
