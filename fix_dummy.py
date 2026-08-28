import re

with open('engine.js', 'r') as f:
    engine = f.read()

engine = engine.replace('this.dummyLutTexture', 'this.dummyLut')

with open('engine.js', 'w') as f:
    f.write(engine)
