import re

with open('engine.js', 'r') as f:
    content = f.read()

# Add to constructor
c_match = r'this\.blurTexture = null;\n\s*this\.blurFbo = null;\n'
c_repl = r'this.blurTexture = null;\n        this.blurFbo = null;\n        this.haloExtTexture = null;\n        this.haloExtFbo = null;\n        this.haloBlurTexture = null;\n        this.haloBlurFbo = null;\n'
content = re.sub(c_match, c_repl, content)

# Add shaders
s_match = r'const fsBlurSource = `#version 300 es\n'
fsHaloExtSource = """
        const fsHaloExtSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_image;
        out vec4 outColor;
        
        void main() {
            vec4 color = texture(u_image, v_texCoord);
            float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            float threshold = 0.8;
            float mask = max(luma - threshold, 0.0);
            outColor = vec4(color.rgb * mask, 1.0);
        }`;

"""
content = re.sub(s_match, fsHaloExtSource + '        const fsBlurSource = `#version 300 es\n', content)

# Add program initialization
p_match = r'this\.blurProgram = this\.createProgram\(vsSource, fsBlurSource\);'
p_repl = r'this.blurProgram = this.createProgram(vsSource, fsBlurSource);\n        this.haloExtProgram = this.createProgram(vsSource, fsHaloExtSource);\n'
content = re.sub(p_match, p_repl, content)

p2_match = r'this\.blurLocs\[\'u_spatialScale\'\] = gl\.getUniformLocation\(this\.blurProgram, \'u_spatialScale\'\);'
p2_repl = r'this.blurLocs[\'u_spatialScale\'] = gl.getUniformLocation(this.blurProgram, \'u_spatialScale\');\n        \n        this.haloExtLocs = {};\n        gl.useProgram(this.haloExtProgram);\n        this.haloExtLocs[\'u_image\'] = gl.getUniformLocation(this.haloExtProgram, \'u_image\');\n'
content = re.sub(p2_match, p2_repl, content)

# Add FBO initialization
f_match = r'this\.blurTexture = blur\.tex;\n\s*this\.blurFbo = blur\.fbo;\n'
f_repl = r'this.blurTexture = blur.tex;\n        this.blurFbo = blur.fbo;\n        \n        if (this.haloExtTexture) gl.deleteTexture(this.haloExtTexture);\n        if (this.haloExtFbo) gl.deleteFramebuffer(this.haloExtFbo);\n        const hext = this.createFboAndTexture(blurW, blurH, true);\n        this.haloExtTexture = hext.tex;\n        this.haloExtFbo = hext.fbo;\n        \n        if (this.haloBlurTexture) gl.deleteTexture(this.haloBlurTexture);\n        if (this.haloBlurFbo) gl.deleteFramebuffer(this.haloBlurFbo);\n        const hblur = this.createFboAndTexture(blurW, blurH, true);\n        this.haloBlurTexture = hblur.tex;\n        this.haloBlurFbo = hblur.fbo;\n'
content = re.sub(f_match, f_repl, content)

# Add to uniform locations for composite
u_match = r'this\.compLocs\[\'u_blurImage\'\] = gl\.getUniformLocation\(this\.compositeProgram, \'u_blurImage\'\);'
u_repl = r'this.compLocs[\'u_blurImage\'] = gl.getUniformLocation(this.compositeProgram, \'u_blurImage\');\n        this.compLocs[\'u_haloBlurImage\'] = gl.getUniformLocation(this.compositeProgram, \'u_haloBlurImage\');'
content = re.sub(u_match, u_repl, content)

# Add to render loop
r_match = r'// PASS 3: Composite \(M10 Effects\)'
r_repl = """// PASS 2b: Halation Extractor
        gl.useProgram(this.haloExtProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.haloExtFbo); this.checkFBO();
        gl.viewport(0, 0, this.blurW, this.blurH);
        this.bindQuad(this.haloExtProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.uniform1i(this.haloExtLocs['u_image'], 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // PASS 2c: Halation Blur
        gl.useProgram(this.blurProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.haloBlurFbo); this.checkFBO();
        gl.viewport(0, 0, this.blurW, this.blurH);
        this.bindQuad(this.blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.haloExtTexture);
        gl.uniform1i(this.blurLocs['u_image'], 0);
        gl.uniform2f(this.blurLocs['u_texelSize'], 1.0 / this.blurW, 1.0 / this.blurH);
        gl.uniform1f(this.blurLocs['u_spatialScale'], spatialScale * 2.0); // Halation is usually a broader blur
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 3: Composite (M10 Effects)
"""
content = re.sub(r_match, r_repl, content)

bind_match = r'gl\.activeTexture\(gl\.TEXTURE1\);\n\s*gl\.bindTexture\(gl\.TEXTURE_2D, this\.blurTexture\);\n\s*gl\.uniform1i\(this\.compLocs\[\'u_blurImage\'\], 1\);'
bind_repl = r"gl.activeTexture(gl.TEXTURE1);\n        gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);\n        gl.uniform1i(this.compLocs['u_blurImage'], 1);\n        gl.activeTexture(gl.TEXTURE2);\n        gl.bindTexture(gl.TEXTURE_2D, this.haloBlurTexture);\n        gl.uniform1i(this.compLocs['u_haloBlurImage'], 2);"
content = re.sub(bind_match, bind_repl, content)

with open('engine.js', 'w') as f:
    f.write(content)
