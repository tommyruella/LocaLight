import re

with open('app.js', 'r') as f:
    content = f.read()

# 1. captureCurrentState should inject pipelineVersion
c1 = r'return \{\n\s*layers: JSON\.parse\(JSON\.stringify\(layers\)\),\n\s*activeLayerIndex: activeLayerIndex\n\s*\}'
c2 = r'return {\n        pipelineVersion: 2,\n        layers: JSON.parse(JSON.stringify(layers)),\n        activeLayerIndex: activeLayerIndex\n    }'
content = re.sub(c1, c2, content)

# 2. applyHistoryState should set engine.pipelineVersion
c3 = r'activeLayerIndex = state\.activeLayerIndex;'
c4 = r'activeLayerIndex = state.activeLayerIndex;\n    engine.pipelineVersion = state.pipelineVersion || 1;'
content = re.sub(c3, c4, content)

# 3. triggerEngineRender shouldn't need to do anything since engine has pipelineVersion.
with open('app.js', 'w') as f:
    f.write(content)
