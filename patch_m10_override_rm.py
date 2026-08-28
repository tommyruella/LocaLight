import re
with open('test_m10_runner.html', 'r') as f:
    text = f.read()

override = """
    // M10 tests assume spatialScale = 1.0. Override it for this test suite.
    const origRender = engine.renderSingleLayerState;
    engine.renderSingleLayerState = function(state, targetFbo, inputTexture, targetW, targetH, spatialScale) {
        origRender.call(this, state, targetFbo, inputTexture, targetW, targetH, 1.0);
    };
"""
text = text.replace(override + '\n    window.runTest = function() {', 'window.runTest = function() {')

with open('test_m10_runner.html', 'w') as f:
    f.write(text)
