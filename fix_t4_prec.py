import re
with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

# I will add an epsilon 1e-6 to handle float precision for 3.0/255.0
text = text.replace(
    'maxAbsErr <= (3.0/255.0)',
    'maxAbsErr <= (3.0/255.0 + 1e-6)'
)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
