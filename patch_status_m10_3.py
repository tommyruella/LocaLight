with open('MILESTONE_STATUS.md', 'r') as f:
    text = f.read()

text = text.replace("VERIFIED (Passed Arbitrator Audit)", "IMPLEMENTED (Pending Audit)")

with open('MILESTONE_STATUS.md', 'w') as f:
    f.write(text)
