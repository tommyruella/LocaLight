with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# Wait, if we restore it immediately, the first `checkFBO` inside the *export* function fails, which is great.
# But then `export` throws, and goes to `finally`.
# In `finally`, `engine.render()` is called, which calls `checkFBO`, which succeeds.
# So why is line 114 failing? Let's check what line 114 is.
