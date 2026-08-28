with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# We need to make sure the mock isn't breaking the *preview* rendering in finally.
# Wait, the error is inside `test_m11_resolution.html:113` which is:
# engine.render(null, 1024, 1024, engine.compAFbo);
# Oh, that's because `gl.checkFramebufferStatus = origCheck` was NOT called in `finally` if we manually do try/catch, wait it WAS called.
# Let's check line 113.
