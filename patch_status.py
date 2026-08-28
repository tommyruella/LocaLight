import re
with open('MILESTONE_STATUS.md', 'r') as f:
    text = f.read()

m11_block = """## M11: Resolution & Export Management
**Status**: READY FOR ARBITRATION

**Architecture**: (IMPLEMENTATION-DERIVED DOCUMENTATION)
- Pipeline FBO dinamica (Source -> Ingest -> Preview -> Export).
- `u_spatialScale` implementato come `max(W, H) / 1024.0` per garantire l'invarianza dimensionale degli effetti spaziali (es. blur radii).
- Gestione disaccoppiata della cache FBO rispetto alla risoluzione sorgente (downsample indipendente per blurFbo).

**Invariants**:
- Un fallimento durante l'esportazione (es. FBO non supportato) deve essere catturato e ripristinare il 100% dello stato WebGL (`deepEqual`).
- Esportazione non deve mutare l'oggetto `engine.state`.
- La dimensione massima di Ingestione ed Esportazione non deve mai eccedere il limite globale calcolato.

**Forbidden behavior**:
- Uso di dimensioni FBO diverse da quelle allocate (causa feedback loops).
- Export che lascia attivi gli offscreen FBO al termine.

**Acceptance criteria**:
- T1 (Limits), T2a (Export dimensions), T2b (Failure Graceful & Restore), T3 (GL State immutability), T4 (Scale Independence).

**Required tests**:
- `test_m11_resolution.html` (Playwright wrapper)

**Known limitations**:
- Il calcolo dell'errore (MAE) su bordi hard-edge con shader multi-pass e downsampling comporta inevitabilmente aliasing da interpolazione. Si risolve testando l'effetto su layer lineari (gradienti continui).
"""

text = re.sub(r'## M11: Resolution & Export Management.*', m11_block, text, flags=re.DOTALL)

with open('MILESTONE_STATUS.md', 'w') as f:
    f.write(text)
