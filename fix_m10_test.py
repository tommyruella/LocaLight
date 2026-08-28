import re
with open('test_m10_runner.html', 'r') as f:
    text = f.read()

# We need to change the canvas size and drawing scale for the entire test!
# But there are multiple scenes in M10 test.
# "Clarity operates at lower frequency than Sharpness" is SCENE 2.
# Let's see SCENE 2 code.
