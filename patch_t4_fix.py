with open('test_m11_resolution.html', 'r') as f:
    text = f.read()

text = text.replace('maxAbsErr2', 'maxAbsErr')
text = text.replace('maxAbsErr <= (3.0/255.0) && maxAbsErr <= 0.015', 'maxAbsErr <= (3.0/255.0) && rmse <= 0.015')

with open('test_m11_resolution.html', 'w') as f:
    f.write(text)
