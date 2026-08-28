with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

text = text.replace(
    'log("T3: State and UI pixels are unmutated after export",',
    'log("T3: State, GL config, and UI pixels are unmutated after export",'
)

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
