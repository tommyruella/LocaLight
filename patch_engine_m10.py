import re

with open('engine.js', 'r') as f:
    text = f.read()

# 1. Update constructor state
state_block = """            u_clarity: 0.0,
            u_lut_intensity: 0.0,"""
new_state_block = """            u_clarity: 0.0,
            u_grain: 0.0,
            u_noise: 0.0,
            u_halation: 0.0,
            u_glow: 0.0,
            u_lut_intensity: 0.0,"""
text = text.replace(state_block, new_state_block)

# 2. Update fsBlurSource
blur_src = """        const fsBlurSource = `#version 300 es
        precision mediump float;
        in vec2 v_texCoord;
        uniform sampler2D u_image;
        uniform vec2 u_texelSize;
        out vec4 outColor;
        void main() {
            outColor = texture(u_image, v_texCoord);
        }`;"""
new_blur_src = """        const fsBlurSource = `#version 300 es
        precision mediump float;
        in vec2 v_texCoord;
        uniform sampler2D u_image;
        uniform vec2 u_texelSize;
        out vec4 outColor;
        
        void main() {
            vec4 color = vec4(0.0);
            vec2 off = u_texelSize * 1.5;
            
            color += texture(u_image, v_texCoord + vec2(-off.x, -off.y)) * 0.0625;
            color += texture(u_image, v_texCoord + vec2(0.0, -off.y)) * 0.125;
            color += texture(u_image, v_texCoord + vec2(off.x, -off.y)) * 0.0625;
            
            color += texture(u_image, v_texCoord + vec2(-off.x, 0.0)) * 0.125;
            color += texture(u_image, v_texCoord) * 0.25;
            color += texture(u_image, v_texCoord + vec2(off.x, 0.0)) * 0.125;
            
            color += texture(u_image, v_texCoord + vec2(-off.x, off.y)) * 0.0625;
            color += texture(u_image, v_texCoord + vec2(0.0, off.y)) * 0.125;
            color += texture(u_image, v_texCoord + vec2(off.x, off.y)) * 0.0625;
            
            outColor = color;
        }`;"""
text = text.replace(blur_src, new_blur_src)

# 3. Update fsCompositeSource
comp_src = """        const fsCompositeSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_baseImage;
        out vec4 outColor;
        void main() {
            outColor = texture(u_baseImage, v_texCoord);
        }`;"""
new_comp_src = """        const fsCompositeSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_baseImage;
        uniform sampler2D u_blurImage;
        uniform vec2 u_texelSize;
        
        uniform float u_sharpness;
        uniform float u_clarity;
        uniform float u_halation;
        uniform float u_grain;
        uniform float u_noise;
        uniform float u_glow;
        
        out vec4 outColor;
        
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        void main() {
            vec4 base = texture(u_baseImage, v_texCoord);
            vec4 blur = texture(u_blurImage, v_texCoord);
            
            if (u_sharpness != 0.0) {
                vec3 n = texture(u_baseImage, v_texCoord + vec2(0.0, u_texelSize.y)).rgb;
                vec3 s = texture(u_baseImage, v_texCoord + vec2(0.0, -u_texelSize.y)).rgb;
                vec3 e = texture(u_baseImage, v_texCoord + vec2(u_texelSize.x, 0.0)).rgb;
                vec3 w = texture(u_baseImage, v_texCoord + vec2(-u_texelSize.x, 0.0)).rgb;
                vec3 sharpBlur = (n + s + e + w) * 0.25;
                base.rgb += u_sharpness * (base.rgb - sharpBlur);
            }
            
            if (u_clarity != 0.0) {
                base.rgb += u_clarity * (base.rgb - blur.rgb);
            }
            
            if (u_halation > 0.0) {
                vec3 bloom = max(blur.rgb - 0.6, 0.0);
                base.rgb += u_halation * bloom * 2.0;
            }
            
            if (u_glow > 0.0) {
                base.rgb += u_glow * blur.rgb;
            }
            
            if (u_grain > 0.0) {
                float luma = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
                float weight = 1.0 - abs(luma - 0.5) * 2.0; 
                float noiseVal = (hash(v_texCoord * 133.7) - 0.5) * 2.0;
                base.rgb += u_grain * noiseVal * weight * 0.15;
            }
            
            if (u_noise > 0.0) {
                float noiseVal = (hash(v_texCoord * 42.0) - 0.5) * 2.0;
                base.rgb += u_noise * noiseVal * 0.1;
            }
            
            outColor = base;
        }`;"""
text = text.replace(comp_src, new_comp_src)

# 4. Update initShaders for compLocs
init_shaders = """        this.compLocs['u_baseImage'] = gl.getUniformLocation(this.compositeProgram, 'u_baseImage');
    }"""
new_init_shaders = """        this.compLocs['u_baseImage'] = gl.getUniformLocation(this.compositeProgram, 'u_baseImage');
        this.compLocs['u_blurImage'] = gl.getUniformLocation(this.compositeProgram, 'u_blurImage');
        this.compLocs['u_texelSize'] = gl.getUniformLocation(this.compositeProgram, 'u_texelSize');
        this.compLocs['u_sharpness'] = gl.getUniformLocation(this.compositeProgram, 'u_sharpness');
        this.compLocs['u_clarity'] = gl.getUniformLocation(this.compositeProgram, 'u_clarity');
        this.compLocs['u_halation'] = gl.getUniformLocation(this.compositeProgram, 'u_halation');
        this.compLocs['u_grain'] = gl.getUniformLocation(this.compositeProgram, 'u_grain');
        this.compLocs['u_noise'] = gl.getUniformLocation(this.compositeProgram, 'u_noise');
        this.compLocs['u_glow'] = gl.getUniformLocation(this.compositeProgram, 'u_glow');
    }"""
text = text.replace(init_shaders, new_init_shaders)

# 5. Update renderSingleLayerState PASS 2 and PASS 3
render_blocks = """        // PASS 2: Blur (Pass-through for M3)
        gl.useProgram(this.blurProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbo);
        gl.viewport(0, 0, this.blurW, this.blurH);
        this.bindQuad(this.blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.blurLocs['u_image'], 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 3: Composite (Pass-through for M3)
        gl.useProgram(this.compositeProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.bindQuad(this.compositeProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.compLocs['u_baseImage'], 0);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);"""

new_render_blocks = """        // PASS 2: Blur (9-tap Gaussian)
        gl.useProgram(this.blurProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbo);
        gl.viewport(0, 0, this.blurW, this.blurH);
        this.bindQuad(this.blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.blurLocs['u_image'], 0);
        gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / this.blurW, 1.0 / this.blurH);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 3: Composite (M10 Effects)
        gl.useProgram(this.compositeProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.bindQuad(this.compositeProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.compLocs['u_baseImage'], 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
        gl.uniform1i(this.compLocs['u_blurImage'], 1);
        
        gl.uniform2f(this.compLocs['u_texelSize'], 1.0 / this.canvas.width, 1.0 / this.canvas.height);
        
        const safeVal = (name) => this.bypassed ? 0.0 : (state[name] !== undefined ? state[name] : (this.state[name] || 0.0));
        
        gl.uniform1f(this.compLocs['u_sharpness'], safeVal('u_sharpness'));
        gl.uniform1f(this.compLocs['u_clarity'], safeVal('u_clarity'));
        gl.uniform1f(this.compLocs['u_halation'], safeVal('u_halation'));
        gl.uniform1f(this.compLocs['u_grain'], safeVal('u_grain'));
        gl.uniform1f(this.compLocs['u_noise'], safeVal('u_noise'));
        gl.uniform1f(this.compLocs['u_glow'], safeVal('u_glow'));
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);"""
text = text.replace(render_blocks, new_render_blocks)

with open('engine.js', 'w') as f:
    f.write(text)
print("PATCH M10 APPLIED")
