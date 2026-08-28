with open('engine.js', 'r') as f:
    text = f.read()

# Fix renderSingleLayerState definition
text = text.replace(
    'renderSingleLayerState(state, targetFbo, inputTexture) {',
    'renderSingleLayerState(state, targetFbo, inputTexture, targetW, targetH, spatialScale) {'
)

# Fix calls to renderSingleLayerState
text = text.replace(
    'this.renderSingleLayerState(this.state, this.compAFbo, this.originalTexture);',
    'this.renderSingleLayerState(this.state, this.compAFbo, this.originalTexture, targetW, targetH, spatialScale);'
)
text = text.replace(
    'this.renderSingleLayerState(es, currentCompFbo, this.originalTexture);',
    'this.renderSingleLayerState(es, currentCompFbo, this.originalTexture, targetW, targetH, spatialScale);'
)
text = text.replace(
    'this.renderSingleLayerState(layer.engineState || this.state, this.layerFbo, currentCompTex);',
    'this.renderSingleLayerState(layer.engineState || this.state, this.layerFbo, currentCompTex, targetW, targetH, spatialScale);'
)

with open('engine.js', 'w') as f:
    f.write(text)
