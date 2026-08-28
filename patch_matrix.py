with open('engine.js', 'r') as f:
    text = f.read()

# Replace the matrix block
old_matrix = """        const mat3 M_LMS_TO_SRGB = mat3(
            2.538047, -0.146005, -0.042299,
            -1.293278, 1.116649, -0.071607,
            -0.040237, -0.022329, 1.022753
        );"""

new_matrix = """        const mat3 M_LMS_TO_SRGB = mat3(
            2.538045, -0.146004, -0.042299,
            -1.293277, 1.116648, -0.071607,
            -0.040237, -0.022329, 1.022753
        );"""

text = text.replace(old_matrix, new_matrix)

with open('engine.js', 'w') as f:
    f.write(text)
