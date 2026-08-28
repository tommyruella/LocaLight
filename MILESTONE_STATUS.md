# LocaLight Milestone Status

Questo documento traccia lo stato architetturale delle milestone.
Stati possibili: `PENDING` | `IMPLEMENTED` (in attesa di audit) | `VERIFIED` (approvato dagli arbitri) | `BLOCKED`

---

## MILESTONE 4: White Balance
**Status:** VERIFIED

**Architecture:**
- Trasformazione in Linear RGB via Matrice Bradford verso D65.
- Parametrizzazione scientifica via Mired (Temp) e offset lungo la normale al locus UCS (Tint).

**Required invariants:**
- `tempUI == 0 && tintUI == 0` deve produrre matrice identità esatta.

**Forbidden behavior:**
- Uso di moltiplicatori RGB empirici (es. `1.0 + temp * 0.3`).

**Required tests:**
- `test_wb.js` (Continuità, identità, assenza NaN/Inf, comportamento estremi 2000K/15000K).

**Acceptance criteria:**
- CPU (`reference.js`) e GPU (`engine.js`) hanno semantica identica calcolata rigorosamente.

**Known limitations:**
- N/A

---

## MILESTONE 5: Parametric Tone Mapping
**Status:** VERIFIED

**Architecture:**
- Pipeline tonale isolata su canale di Luminanza (`L = dot(RGB, weights)`).
- Traslazione pura in spazio EV (Exposure).
- Interpolazione Cubica Monotona (Fritsch-Carlson) per Blacks, Shadows, Highlights, Whites.
- Ricostruzione ratio-preserving su Linear RGB HDR (nessun clamp `[0,1]`).

**Required invariants:**
- Monotonicità stretta della curva su tutto il dominio.
- Pivot centrale: `f(0 EV) == 0 EV`.

**Forbidden behavior:**
- Medie naive delle derivate senza correzione monotona ellittica.
- Clamp HDR distruttivi.

**Required tests:**
- `test_spline.js` (Sweep densi, 243 configurazioni deterministiche, configurazioni random).

**Acceptance criteria:**
- I test matematici garantiscono la non decrescenza continua e la gestione pulita degli zero.

**Known limitations:**
- Richiede supporto WebGL2 `EXT_color_buffer_float` per i framebuffer `RGBA16F`.
- Il test `test_spline.js` estrae `buildSpline` direttamente dall'engine via regex/eval per il testing, ma `evalSpline` rimane una trascrizione JS manuale della reale interpolazione GLSL. Se il codice GLSL cambia, questa trascrizione andrà aggiornata a mano.

---

## MILESTONE 8: 3D LUT Engine
**Status:** VERIFIED

**Architecture:**
- Voxel sampling 3D applicato esclusivamente in spazio display-referred (dopo `encodeSRGB`).
- Configurazione filtro TEXTURE_3D dipendente da capability hardware `OES_texture_half_float_linear` via `this.caps`.
- Padding RGBA16F automatico in fase di caricamento per stabilità driver Mac/Metal.

**Required invariants:**
- `dummyLut` 1x1x1 RGBA di sicurezza sempre binnata sul texture unit se LUT utente assente.
- Il parser LUT scarta o avverte per domini non `[0,1]`.

**Forbidden behavior:**
- Fallback su texture 2D per un sampler 3D in GLSL.

**Required tests:**
- `test_lut.js` (verifica ordine di esecuzione `encodeSRGB` -> `texture` e logica identità se `intensity=0`).

**Acceptance criteria:**
- Caricamento stabile e rendering applicato nell'ultimo pass di composite.

**Known limitations:**
- LUT non `[0,1]` attivano un warning in console.
- L'intensità della LUT, pur essendo un uniform globale nello shader, viene estratta dallo stato del layer *attualmente selezionato* in UI (`activeLayerIndex`). Di conseguenza, cambiare il layer attivo modificherà l'intensità della LUT per tutta l'immagine. Questa è un'ambiguità architetturale voluta e non un bug.

---

## MILESTONE 9: Color Mix 8-Band
**Status:** VERIFIED

**Architecture:**
- Pipeline HSL a 8 bande interpolata fluida (smoothstep).
- Si applica dopo la Tone Curve ma prima di Saturazione e Vibrance.

**Required invariants:**
- Spostare una banda (es. Red) non deve avere alcun impatto su una banda ortogonale e non adiacente (es. Blue).

**Forbidden behavior:**
- Salti bruschi di colore (banding) dovuti a interpolazione assente o errata tra i centri HSL.

**Required tests:**
- `test_m9_mix.js` (verifica formale dell'isolamento di banda e del blend bilineare).

**Acceptance criteria:**
- TBD

**Known limitations:**
- Gaussian Blur is implemented as a 9-sample binomial approximation with 1.5 texel scaling for performance.
- Halation calculates threshold *after* blur (`max(blur - threshold, 0)`), which acts as an acceptable soft bloom approximation rather than a strictly physical halation model.

## MILESTONE 10: Real Effects
**Status:** VERIFIED (Passed Arbitrator Audit)

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
- Gaussian Blur is implemented as a 9-sample binomial approximation with 1.5 texel scaling for performance.
- Halation calculates threshold *after* blur (`max(blur - threshold, 0)`), which acts as an acceptable soft bloom approximation rather than a strictly physical halation model.
