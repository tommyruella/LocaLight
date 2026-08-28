import re
with open('engine.js', 'r') as f:
    text = f.read()

# Wait, `ensureFBOs` is around line 645.
# Let's see what baseW and baseH are!
