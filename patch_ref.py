import re

with open('reference.js', 'r') as f:
    ref = f.read()

ref = ref.replace('let uv1 = get_uv(T + 1.0);', 'let uv1 = get_uv(T + 0.1);')

with open('reference.js', 'w') as f:
    f.write(ref)

