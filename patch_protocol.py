with open('AUDIT_PROTOCOL.md', 'r') as f:
    text = f.read()

rule_to_add = "  - **I test permanenti devono leggere il file sorgente reale a runtime (`fs.readFileSync` o equivalente)**, non contenere una copia manuale del codice da verificare.\n"
text = text.replace('  - NON "correggono mentalmente" il codice', rule_to_add + '  - NON "correggono mentalmente" il codice')

with open('AUDIT_PROTOCOL.md', 'w') as f:
    f.write(text)
