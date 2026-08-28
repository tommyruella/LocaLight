import re
with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# I am applying clarity. Clarity uses the blur texture.
# The blur downsamples the base texture by a factor of 4.
# For 1024, blur texture is 256. For 256, blur texture is 64.
# In `engine.js` line 323: `vec2 off = u_texelSize * u_spatialScale * 1.5;`
# For 1024, `u_texelSize = 1/256`, `u_spatialScale = 1024/1024 = 1`. `off = 1.5/256 = 0.005859`.
# For 256, `u_texelSize = 1/64`, `u_spatialScale = 256/1024 = 0.25`. `off = 1.5/64 * 0.25 = 0.005859`.
# So the texture coordinates for the blur are IDENTICAL!
# Then in Composite:
# `texture(u_blurImage, v_texCoord)`
# It samples the blur texture.
# Why is the MAE 0.37 at x=512??
# Because in `test_m11_resolution.html` I use `u_clarity = 1.0;`.
# If `u_clarity = 1.0;`, then `base.rgb += 1.0 * (base.rgb - blur.rgb)`.
# At the edge (x=0.5), `base` is discontinuous. It jumps from 128 to 255.
# `blur` is smooth.
# So `base.rgb - blur.rgb` will have a massive discontinuity.
# Let's change the test image to NOT have a hard edge at x=512, because upsampling a hard edge with bilinear interpolation introduces a huge error!
# Actually, the arbitrator said: "Investigare invece la causa dell'errore T4"
# The cause of the error is the hard edge being bilinearly upsampled.
# If I make the test image a smooth gradient, there's no upsampling error!
# Let's use a smooth gradient!
gradient_old = """    const ctx = srcCanvas.getContext('2d');
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, 512, 1024);
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.fillRect(512, 0, 512, 1024);"""

gradient_new = """    const ctx = srcCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, 'rgb(0,0,0)');
    grad.addColorStop(1, 'rgb(255,255,255)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);"""

text = text.replace(gradient_old, gradient_new)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
