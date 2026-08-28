with open('MILESTONE_STATUS.md', 'r') as f:
    text = f.read()

text = text.replace('**Status:** IMPLEMENTED (Pending Audit)', '**Status:** VERIFIED')

with open('MILESTONE_STATUS.md', 'w') as f:
    f.write(text)
