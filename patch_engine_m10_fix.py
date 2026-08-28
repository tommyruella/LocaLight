with open('engine.js', 'r') as f:
    text = f.read()

comp_src = """        const fsCompositeSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_baseImage;
        out vec4 outColor;
        void main() {
            vec3 color = texture(u_baseImage, v_texCoord).rgb;
            outColor = vec4(color, 1.0);
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

if comp_src in text:
    text = text.replace(comp_src, new_comp_src)
    print("FIX APPLIED")
else:
    print("FAILED TO FIND comp_src")

with open('engine.js', 'w') as f:
    f.write(text)
