# Goal Description
Implement true 8-Band Color Mix (HSL shifts) via GLSL for M9, allowing selective hue, saturation, and lightness adjustments.

## HSL Bands
The UI defines 8 color bands:
0: Red (Hue: 0°)
1: Orange (Hue: 30°)
2: Yellow (Hue: 60°)
3: Green (Hue: 120°)
4: Aqua (Hue: 180°)
5: Blue (Hue: 240°)
6: Purple (Hue: 270°)
7: Magenta (Hue: 300°)

The `app.js` already constructs `u_hsl_shifts[24]`, which flattens the shifts into a `Float32Array`.

## Proposed Changes

### 1. `engine.js` (GLSL Updates)
- Define `uniform float u_hsl_shifts[24];` in `fsBaseSource`.
- Add `rgb2hsl` and `hsl2rgb` GLSL helper functions.
- In `main()` of `fsBaseSource`, perform the following logic:
  - Convert the current `color.rgb` to HSL.
  - Calculate the distances from the current Hue to the 8 bands (handling wrap-around at 360°/0°).
  - Use a smooth weight function (e.g. linear or cosine interpolation based on hue distance) to blend the shifts from the two nearest bands. The weights must sum to 1.0 (or less if we narrow the influence, but for standard overlap, overlapping linear weights work best).
  - Apply the blended Hue shift, Saturation shift, and Lightness shift.
  - Convert back to RGB.

### 2. Smooth Overlap Algorithm
The centers are `[0, 30, 60, 120, 180, 240, 270, 300] / 360.0`.
For a given hue `h` (in `[0, 1]`), we find the band `i` and `i+1` (wrapping around to 0) that bound `h`.
Since the bands are not equally spaced, we calculate the local distance.
```glsl
float centers[8] = float[](0.0, 30.0/360.0, 60.0/360.0, 120.0/360.0, 180.0/360.0, 240.0/360.0, 270.0/360.0, 300.0/360.0);
// ... find adjacent bands, compute weights, accumulate shift.
```

### 3. Pipeline Order
When should Color Mix be applied?
Usually, in Lightroom, HSL Mix is applied *after* WB, but *before* the tone curve or global saturation.
Since our current `fsBaseSource` has:
1. WB
2. Spline (Tone Curve)
3. Saturation & Vibrance
4. Lift/Gamma/Gain

Applying it right after WB and before the Spline makes sense, because it operates on the linear/balanced color, though HSL of linear light is very desaturated. If we apply it after the Spline, it operates on a more perceptually uniform space. Many engines apply HSL on gamma-encoded or tone-mapped values because adjusting Lightness on linear values feels unnatural.
We will apply it *after* the Spline, before global Saturation/Vibrance.

## Verification Plan
1. Ensure the shader compiles.
2. Ensure sliding the "Red" hue slider shifts reds without affecting blues.
3. Validate smooth transitions between colors.
