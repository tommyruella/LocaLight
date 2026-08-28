import re

with open('engine.js', 'r') as f:
    engine = f.read()

# 1. Update loadLUT
old_load = """    loadLUT(lutData) {
        // Disabled for M3
    }"""

new_load = """    loadLUT(lutData) {
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
engine = engine.replace(old_load, new_load)

# 2. Add dummyLutTexture in initTextures()
old_init_textures_end = """        gl.bindTexture(gl.TEXTURE_2D, null);
    }"""

new_init_textures_end = """        gl.bindTexture(gl.TEXTURE_2D, null);
        
        // Dummy 3D LUT (1x1x1 identity)
        this.dummyLutTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, this.dummyLutTexture);
        const dummyData = new Float32Array([0.0, 0.0, 0.0]); 
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, 1, 1, 1, 0, gl.RGB, gl.FLOAT, dummyData);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_3D, null);
        
        this.lutTexture = null;
        this.lutSize = 1;
    }"""
engine = engine.replace(old_init_textures_end, new_init_textures_end)

# 3. Update fsOutputSource
old_output_shader = """        const fsOutputSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_image;
        out vec4 outColor;
        
        ${GLSL_COLOR_SPACE}

        void main() {
            vec3 color = texture(u_image, v_texCoord).rgb;
            // Provisional Display Transform
            color = clamp(color, 0.0, 1.0);
            // Output Encoding
            color = encodeSRGB(color);
            outColor = vec4(color, 1.0);
        }`;"""

new_output_shader = """        const fsOutputSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        
        uniform sampler2D u_image;
        
        // 3D LUT
        uniform mediump sampler3D u_lut;
        uniform float u_lut_intensity;
        uniform float u_lut_size;
        
        out vec4 outColor;
        
        ${GLSL_COLOR_SPACE}

        void main() {
            vec3 color = texture(u_image, v_texCoord).rgb;
            
            // Provisional Display Transform
            vec3 c = max(vec3(0.0), color);
            c = clamp(c, 0.0, 1.0);
            
            // Output Encoding (Linear -> sRGB)
            vec3 encoded = encodeSRGB(c);
            
            // --- 3D LUT in Display-Referred Space ---
            // Scale coords to sample voxel centers and avoid edge bleeding
            vec3 lutCoord = (encoded * (u_lut_size - 1.0) + 0.5) / u_lut_size;
            vec3 lutColor = texture(u_lut, lutCoord).rgb;
            
            encoded = mix(encoded, lutColor, u_lut_intensity);
            
            outColor = vec4(encoded, 1.0);
        }`;"""
engine = engine.replace(old_output_shader, new_output_shader)

# 4. Bind uniforms in initShaders
old_output_locs = """        this.outputLocs = {};
        gl.useProgram(this.outputProgram);
        this.outputLocs['u_image'] = gl.getUniformLocation(this.outputProgram, 'u_image');"""

new_output_locs = """        this.outputLocs = {};
        gl.useProgram(this.outputProgram);
        this.outputLocs['u_image'] = gl.getUniformLocation(this.outputProgram, 'u_image');
        this.outputLocs['u_lut'] = gl.getUniformLocation(this.outputProgram, 'u_lut');
        this.outputLocs['u_lut_intensity'] = gl.getUniformLocation(this.outputProgram, 'u_lut_intensity');
        this.outputLocs['u_lut_size'] = gl.getUniformLocation(this.outputProgram, 'u_lut_size');"""
engine = engine.replace(old_output_locs, new_output_locs)

# 5. Bind in render()
# Bystander pass
old_render_bypass = """            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.compATexture);
            gl.uniform1i(this.outputLocs['u_image'], 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return;"""

new_render_bypass = """            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.compATexture);
            gl.uniform1i(this.outputLocs['u_image'], 0);
            
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this.lutTexture || this.dummyLutTexture);
            gl.uniform1i(this.outputLocs['u_lut'], 1);
            gl.uniform1f(this.outputLocs['u_lut_intensity'], 0.0);
            gl.uniform1f(this.outputLocs['u_lut_size'], this.lutSize || 1.0);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return;"""
engine = engine.replace(old_render_bypass, new_render_bypass)

# Normal pass
old_render_normal = """            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, currentCompTex);
            gl.uniform1i(this.outputLocs['u_image'], 0);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);"""

new_render_normal = """            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, currentCompTex);
            gl.uniform1i(this.outputLocs['u_image'], 0);
            
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this.lutTexture || this.dummyLutTexture);
            gl.uniform1i(this.outputLocs['u_lut'], 1);
            gl.uniform1f(this.outputLocs['u_lut_intensity'], this.state['u_lut_intensity'] || 0.0);
            gl.uniform1f(this.outputLocs['u_lut_size'], this.lutSize || 1.0);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);"""
engine = engine.replace(old_render_normal, new_render_normal)

with open('engine.js', 'w') as f:
    f.write(engine)

