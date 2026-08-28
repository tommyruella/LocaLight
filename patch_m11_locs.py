with open('engine.js', 'r') as f:
    text = f.read()

text = text.replace(
    "this.blurLocs['u_texelSize'] = gl.getUniformLocation(this.blurProgram, 'u_texelSize');",
    "this.blurLocs['u_texelSize'] = gl.getUniformLocation(this.blurProgram, 'u_texelSize');\n        this.blurLocs['u_spatialScale'] = gl.getUniformLocation(this.blurProgram, 'u_spatialScale');"
)

text = text.replace(
    "this.compLocs['u_texelSize'] = gl.getUniformLocation(this.compositeProgram, 'u_texelSize');",
    "this.compLocs['u_texelSize'] = gl.getUniformLocation(this.compositeProgram, 'u_texelSize');\n        this.compLocs['u_spatialScale'] = gl.getUniformLocation(this.compositeProgram, 'u_spatialScale');"
)

with open('engine.js', 'w') as f:
    f.write(text)
