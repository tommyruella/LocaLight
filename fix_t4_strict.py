import re
with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

text = text.replace(
    'maxAbsErr <= (3.0/255.0 + 1e-6)',
    'maxAbsErr <= (3.0/255.0)'
)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
