with open('MILESTONE_STATUS.md', 'r') as f:
    text = f.read()

text += """
## MILESTONE 10: Real Effects
**Status:** IMPLEMENTED (Pending Audit)

**Architecture:**
- Real-time 9-tap Gaussian blur executed on a 1/4th scale FBO (PASS 2).
- Composite pass (PASS 3) executes 5 simultaneous effects.
- Sharpness: 1-texel high-frequency cross-sample unsharp mask.
- Clarity: Wide-radius low-frequency unsharp mask (blends PASS 2 blur).
- Halation: Luma-thresholded additive bloom.
- Grain & Noise: Procedural hash-based noise injection. Grain is luma-weighted (strongest in midtones).

**Required invariants:**
- Setting an effect to `0.0` must precisely bypass its calculation block.

**Required tests:**
- `test_m10_playwright.js` verifies that Grain adds variance, Sharpness steepens midtone edges, Clarity alters contrast, and Halation bleeds highlights into shadows.

**Acceptance criteria:**
- TBD

**Known limitations:**
- TBD
"""

with open('MILESTONE_STATUS.md', 'w') as f:
    f.write(text)
