# M10: Real Effects Implementation Plan

## 1. Gaussian Blur (PASS 2)
Modify `fsBlurSource` to perform a 9-tap (or 13-tap) Gaussian blur. 
Since `blurFbo` is 1/4 the resolution of `baseFbo`, a 9-tap blur covering a few texels will effectively create a large radius blur suitable for Halation and Clarity.
- Add `uniform vec2 u_texelSize;` to `fsBlurSource`.
- Implement a 2D Gaussian blur kernel in `fsBlurSource`.

## 2. Halation & Clarity (PASS 3 - Composite)
Modify `fsCompositeSource` to accept both `u_baseImage` (full res) and `u_blurImage` (1/4 res blurred).
- Add uniforms: `u_clarity`, `u_halation`, `u_grain`, `u_noise` (wait, the UI has Grain and Noise, I'll check if both are needed).
- **Clarity**: `color.rgb += u_clarity * (color.rgb - blurColor.rgb);` (Basic unsharp mask using the large blur).
- **Halation**: To do luma-thresholded halation properly without an extra pre-threshold pass, we can compute the luma of `blurColor.rgb`. If we just add `u_halation * max(blurColor.rgb - threshold, 0.0)`, it works reasonably well, though technically true halation thresholds *before* blurring. Alternatively, we can calculate a pseudo-threshold on the blurred image: `halation = max(blurColor.rgb - 0.5, 0.0) * u_halation`. Since this is a lightweight engine, this is standard. 

## 3. Grain (Procedural)
In `fsCompositeSource`, add a procedural noise function:
```glsl
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
```
Add `u_grain`.
`color.rgb += (hash(v_texCoord * u_seed) - 0.5) * u_grain;` (Luma-dependent grain is better: `grain * (1.0 - abs(luma - 0.5)*2.0)`).

## 4. Sharpness
Sharpness requires a small-radius unsharp mask. We can do a 5-tap cross blur (up/down/left/right) directly in `fsCompositeSource` sampling `u_baseImage`, since the radius is just 1 texel.
`vec3 sharpBlur = (tex(center) * 4 + tex(N) + tex(S) + tex(E) + tex(W)) / 8;`
`color.rgb += u_sharpness * (color.rgb - sharpBlur);`
