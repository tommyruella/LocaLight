with open('engine.js', 'r') as f:
    text = f.read()
# Let's verify what causes MAE. Is it sharpness? No, sharpness is 0 because the state was changed to clarity = 1.0!
# Wait, I changed it to clarity = 1.0 per your instructions: "Ripristinare il caso normativo u_clarity = 1.0"
# And then "Se T4 continua a produrre ~0.16, indagare il renderer"
# Wait! In T4, when I upsample, the center pixel was (159,159,159) vs (255,255,255)!
# Why is clarity reducing the center pixel to 159 in 256x256, but leaving it 255 in 1024x1024?
# Oh! Because clarity formula: base.rgb += u_clarity * (base.rgb - blur.rgb);
# If base is white (255) and blur is white (255), clarity does nothing. (255 += 1.0 * (255-255) = 255)
# Wait, if blur is NOT white in 256x256, why would blur not be white?
# The image is 50% gray and 50% white.
# At 1024x1024, the blur radius is tiny relative to the center pixel (512,512). The center pixel is at the edge!
# Wait, the edge is exactly at x=512! The left half is gray (0-511), the right half is white (512-1023).
# At 1024x1024, pixel 512 is right on the edge.
# Blur will mix gray and white, so blur.rgb will be ~191.
# base.rgb (white) + 1.0 * (white - 191) = 255 + (255 - 191) = 319 -> clamped to 255.
# At 256x256, the edge is exactly at x=128.
# pixel 128 is right on the edge.
# Blur will mix gray and white.
# BUT wait! If both are clamped to 255, why did the debug say 159 for 256x256?
