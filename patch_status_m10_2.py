with open('MILESTONE_STATUS.md', 'r') as f:
    text = f.read()

text = text.replace("IMPLEMENTED (Pending Audit)", "VERIFIED (Passed Arbitrator Audit)")
text = text.replace("**Known limitations:**\n- TBD", "**Known limitations:**\n- Gaussian Blur is implemented as a 9-sample binomial approximation with 1.5 texel scaling for performance.\n- Halation calculates threshold *after* blur (`max(blur - threshold, 0)`), which acts as an acceptable soft bloom approximation rather than a strictly physical halation model.")

with open('MILESTONE_STATUS.md', 'w') as f:
    f.write(text)
