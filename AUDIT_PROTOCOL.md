# LocaLight Audit Protocol

Questo documento definisce il contratto operativo formale per lo sviluppo, la verifica e l'approvazione delle Milestone del motore colore LocaLight. L'obiettivo è garantire una singola fonte di verità verificabile ed eliminare le "allucinazioni da consenso" tra gli agenti AI.

## 1. Ruoli e Responsabilità

### 1.1 Antigravity (Coder / Esecutore)
- **Compiti:** Modifica il codice, esegue i test locali, crea i commit (SHA).
- **Limiti:** NON può dichiarare autonomamente una milestone come `VERIFIED` o `APPROVED`. Può solo dichiararla `IMPLEMENTED`.
- **Obblighi di Prova:** Quando richiede una revisione, DEVE fornire nel prompt il contenuto letterale dei file modificati (o diff completi) e l'output testuale esatto dell'esecuzione dei test. Le narrazioni ("ho corretto X") senza evidenza cruda sono considerate invalide.

### 1.2 Claude & ChatGPT (Arbitrators / Revisori)
- **Compiti:** Analizzano esclusivamente lo stato reale del commit. Verificano architettura, matematica, test e regressioni in sola lettura.
- **Limiti:** 
  - NON modificano mai il repository.
  - NON introducono cambi architetturali nuovi senza aggiornare la specifica.
  - NON "correggono mentalmente" il codice. Se il codice è formalmente corretto rispetto alla specifica, è `PASS`. Se viola la matematica, anche se produce un risultato "bello", è `FAIL`.
  - Non avendo accesso diretto al terminale/GPU, si basano sull'output testuale letterale incollato dal Coder. Per il comportamento visivo, il verdetto resta `N/A` a meno che non sia fornito uno screenshot o validato dall'umano.

### 1.3 Human (Tie-breaker / Visual Verifier)
- **Compiti:** Fornisce l'approvazione visiva/estetica finale.
- **Risoluzione Conflitti:** È l'unico arbitro in grado di rompere uno stallo (Reconciliation) se Claude e ChatGPT giungono a verdetti discordanti sulla medesima evidenza.

## 2. Gerarchia di Verità e Valutazione

Il codice presente nel repository (identificato da un preciso SHA) e i test eseguiti sono l'unica fonte di verità.

- **Milestone Matematiche:** `Invarianti Matematici > Test Numerici > Comportamento Visivo > Preferenze Estetiche`
- **Milestone GPU:** `Specifica della Pipeline > Shader effettivamente eseguito > Formato Framebuffer > Precisione > Test`

Ogni milestone chiusa DEVE lasciare nel repository un test permanente (es. `test_wb.js`).

## 3. Gate Protocol

1. **Antigravity** implementa la specifica.
2. **Antigravity** esegue i test locali e produce un commit (SHA).
3. **Antigravity** presenta l'evidenza (Diff crudi + Output test) agli **Arbitri**.
4. **Arbitro A** e **Arbitro B** valutano indipendentemente:
   - Entrambi `PASS` → Milestone **VERIFIED**.
   - Almeno un `FAIL` → **STOP**. Antigravity deve correggere.
   - Risultati discordanti → **RECONCILIATION** (L'Umano rompe lo stallo basandosi sull'evidenza condivisa).

## 4. Formato Obbligatorio di Revisione (Arbitrators)

Ogni revisione da parte di un Arbitro DEVE seguire questo template esatto. Se la sezione `EVIDENCE` manca di output reali copiati, il verdetto di default diventa automaticamente `BLOCKED`.

```text
COMMIT:
<sha>

MILESTONE:
<Mx>

RESULT:
PASS | FAIL | BLOCKED

ARCHITECTURE:
PASS | FAIL

MATHEMATICS:
PASS | FAIL | N/A

IMPLEMENTATION:
PASS | FAIL

TESTS:
PASS | FAIL

REGRESSIONS:
PASS | FAIL

CRITICAL FINDINGS:
- ...

NON-CRITICAL FINDINGS:
- ...

EVIDENCE:
- file:line
- test:
- command:
- observed result:

VERDICT:
PASS | FAIL | BLOCKED
```
