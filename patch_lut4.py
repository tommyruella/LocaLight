import re

with open('engine.js', 'r') as f:
    engine = f.read()

# 1. Update loadLUT to use RGBA and pad the data
old_load = """    loadLUT(lutData) {
        const gl = this.gl;
        if (this.lutTexture) {
            gl.deleteTexture(this.lutTexture);
        }
        this.lutTexture = gl.createTexture();
        this.lutSize = lutData.size;
        
        gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
        
        const internalFormat = gl.RGB16F; 
        const format = gl.RGB;
        const type = gl.FLOAT;
        
        gl.texImage3D(gl.TEXTURE_3D, 0, internalFormat, this.lutSize, this.lutSize, this.lutSize, 0, format, type, lutData.data);
        
        const filter = this.caps.textureHalfFloatLinear ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        
        gl.bindTexture(gl.TEXTURE_3D, null);
        
        this.render();
    }"""

new_load = """    loadLUT(lutData) {
        const gl = this.gl;
        if (this.lutTexture) {
            gl.deleteTexture(this.lutTexture);
        }
        this.lutTexture = gl.createTexture();
        this.lutSize = lutData.size;
        
        gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
        
        // Pad RGB to RGBA to avoid WebGL2 3-channel alignment/support issues on some drivers
        const rgbaData = new Float32Array(this.lutSize * this.lutSize * this.lutSize * 4);
        for(let i=0, j=0; i < lutData.data.length; i+=3, j+=4) {
            rgbaData[j]   = lutData.data[i];
            rgbaData[j+1] = lutData.data[i+1];
            rgbaData[j+2] = lutData.data[i+2];
            rgbaData[j+3] = 1.0;
        }
        
        const internalFormat = gl.RGBA16F; 
        const format = gl.RGBA;
        const type = gl.FLOAT;
        
        gl.texImage3D(gl.TEXTURE_3D, 0, internalFormat, this.lutSize, this.lutSize, this.lutSize, 0, format, type, rgbaData);
        
        const filter = this.caps.textureHalfFloatLinear ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        
        gl.bindTexture(gl.TEXTURE_3D, null);
        
        // No explicit render() needed here because app.js triggers updateStateFromSliders immediately.
    }"""
engine = engine.replace(old_load, new_load)

# 2. Update Dummy LUT to RGBA
old_dummy = """        // Dummy 3D LUT (1x1x1 identity)
        this.dummyLutTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, this.dummyLutTexture);
        const dummyData = new Float32Array([0.0, 0.0, 0.0]); 
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, 1, 1, 1, 0, gl.RGB, gl.FLOAT, dummyData);"""

new_dummy = """        // Dummy 3D LUT (1x1x1 identity)
        this.dummyLutTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, this.dummyLutTexture);
        const dummyData = new Float32Array([0.0, 0.0, 0.0, 1.0]); 
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, 1, 1, 1, 0, gl.RGBA, gl.FLOAT, dummyData);"""
engine = engine.replace(old_dummy, new_dummy)

with open('engine.js', 'w') as f:
    f.write(engine)

