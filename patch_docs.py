import re

with open('MILESTONE_STATUS.md', 'r') as f:
    text = f.read()

# Fix M8 tests
text = text.replace(
    "- N/A numerico, validazione architetturale dell'upload e fallbacks.",
    "- `test_lut.js` (verifica ordine di esecuzione `encodeSRGB` -> `texture` e logica identità se `intensity=0`)."
)

# Fix M8 capability check
text = text.replace(
    "- Voxel sampling 3D applicato esclusivamente in spazio display-referred (dopo `encodeSRGB`).",
    "- Voxel sampling 3D applicato esclusivamente in spazio display-referred (dopo `encodeSRGB`).\n- Configurazione filtro TEXTURE_3D dipendente da capability hardware `OES_texture_half_float_linear` via `this.caps`."
)

with open('MILESTONE_STATUS.md', 'w') as f:
    f.write(text)

