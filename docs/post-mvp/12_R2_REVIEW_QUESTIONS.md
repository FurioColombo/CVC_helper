# 12 — Domande residue dopo la revisione r2

**Stato:** quattro scelte visuali/interattive aperte. Tutto il resto del feedback del 5 settembre 2026 è recepito nella [galleria r3](mockups/index.html). Le risposte aggiornano il target di design; non autorizzano ancora modifiche all'app.

## Q10 — P13: che cosa deve dominare quando modifico una Comandata?

**Raccomandazione: vista centrata sul giorno.** Se sto modificando Sabato, mostrare prima “In Sabato” con le persone già assegnate e sotto “Disponibili”; un tap aggiunge o rimuove. Accanto al nome basta un avviso se la persona è già assegnata anche altrove, con dettaglio al tap.

Alternativa: conservare la vista r2 centrata sulla persona, con tutti i chip dei giorni della settimana accanto a ogni nome. Questa aiuta a ricostruire l'intera storia, ma rende meno immediato il compito “chi c'è sabato?” e ha prodotto l'ambiguità rilevata.

**Domanda:** per P13 preferisci la vista del giorno proposta, oppure vuoi mantenere la storia settimanale per persona?

## Q11 — P15: come deve scalare la fascia delle barche oltre cinque elementi?

**Raccomandazione: una sola riga sticky, corta e scorribile orizzontalmente.** La r3 mostra sette barche; la fascia resta disponibile mentre si scorre l'elenco equipaggi e non consuma due righe. Lo scroll orizzontale sarebbe limitato a questo selettore di oggetti, con elementi grandi e discreti; il divieto resta assoluto per tabelle e riepiloghi come P18.

Alternativa: due righe che vanno a capo. Tutte le barche sono subito visibili, ma la fascia occupa molta più altezza ed è meno stabile quando il numero cambia.

**Domanda:** approvi la riga sticky scorribile, oppure preferisci due righe senza scroll orizzontale?

## Q12 — P19: quale riepilogo intendevi in fondo alla storia?

**Raccomandazione: la stessa griglia settimanale di P18.** La r3 aggiunge in fondo una griglia completa S–V, AM/PM, larga quanto la pagina e senza scroll orizzontale. È coerente con il Riepilogo generale e permette di confrontare rapidamente la cronologia dettagliata appena letta.

Alternativa: una tabella di totali, per esempio numero di `++`, `+`, `=`, `-`, `--`. Questa risponde a una domanda diversa e perde la sequenza temporale.

**Domanda:** il riepilogo r3 è quello che intendevi, oppure volevi una tabella di totali?

## Q13 — P04: quante “altre note” mostrare direttamente nel profilo?

**Raccomandazione: le due più recenti, poi “Apri storia”.** La sezione compare solo quando esistono note; nota iniziale, nota generale del corso e note valutazione restano etichettate e non si confondono. Mostrare tutta la cronologia nel profilo renderebbe inevitabile uno scroll lungo e duplicherebbe P19.

La r3 mostra una nota recente come esempio e conserva l'accesso a Valutazioni/Storia.

**Domanda:** va bene il limite di due note recenti, oppure vuoi tutte le note direttamente nel profilo?

## Chiarimento già risolto — tipi di barca

Non serve una risposta salvo correzione del dato. La fonte normativa `01_PRODUCT_SPEC.md` usa:

- D5 → RS 500;
- C1 → J/80;
- C2 → First 25.7;
- C3 → First 27.

La r3 usa quindi **First 25.7**, non 27.5. P07 mostra per questo ciclo RS Quest, RS 500, J/80, First 25.7 e First 27.
