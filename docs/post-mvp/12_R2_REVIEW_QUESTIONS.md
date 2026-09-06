# 12 — Decisioni dopo la revisione r2

**Stato:** Q10–Q13 risolte e rifinite fino al 6 settembre 2026 nella [galleria r8](mockups/index.html). Non restano domande bloccanti per questa revisione. Le decisioni aggiornano il target di design; non autorizzano ancora modifiche all'app.

## Q10 — P13: che cosa domina quando modifico una Comandata?

**DECISO — vista centrata sul giorno, con accesso diretto da P11.** Il tap sulla card di un giorno in P11 apre P13 senza popup intermedio. P13 mostra nell'ordine:

1. persone assegnate al giorno corrente;
2. persone mai assegnate;
3. persone assegnate ad altri giorni.

La revisione r8 mostra due allievi per riga. Nelle ultime due sezioni, il nome è un bottone visivamente riconoscibile e il tap assegna la persona anche al giorno corrente; dentro il bottone non si ripete “Assegna a/anche a [giorno]”. Nella card i giorni usano Lun/Mar/Mer/Gio/Ven/Sab/Dom; il nome completo resta nel titolo e nelle etichette accessibili. Una X rossa, visivamente compatta ma con area attiva da 40 px, rimuove la persona dal giorno indicato. I duplicati restano consentiti e segnalati in rosso secondo CMD-07: una persona con più giorni può occupare entrambe le colonne per mantenere leggibili warning, giorni e rimozioni. Il commento iniziale non ripete il giorno, già visibile nel titolo.

## Q11 — P15: come scala la fascia delle barche oltre cinque elementi?

**DECISO — due righe sticky, nessuno scroll orizzontale.** Tutte le barche della sessione devono essere visibili nello stesso momento. Ogni controllo mostra il logo/modello sopra e il numero sotto, così anche i numeri a due cifre rimangono interi. La fascia e le card equipaggio vengono compattate verticalmente; il riepilogo equipaggi usa lo stesso logo della barca.

Il divieto di scroll orizzontale vale per l'intera interfaccia, compresi selettori e riepiloghi.

**Mock approvato:** struttura P15 r4. La r6 aggiunge tre stati operativi con legenda: grigio non disponibile, verde assegnata, blu disponibile non assegnata. La sequenza equipaggio senza barca → barca blu crea l'associazione della sessione; la resa e l'interazione r6 restano da rivedere, mentre la futura implementazione deve persisterle. La r7 riusa la stessa grammatica nel popup destinazione P14 e ordina sempre le barche per numero crescente.

## Q12 — P19: quale riepilogo serve nella storia?

**DECISO — griglia settimanale di P18, in alto e non sticky.** Il riepilogo S–V, AM/PM, entra nella larghezza disponibile e precede la cronologia dettagliata. Il nome completo dell'allievo diventa il titolo principale con “Storia del corso” secondario e rimane sticky durante lo scroll. Le card di giorno e sessione diventano leggermente più basse; assenza di valutazione resta una cella vuota.

**Mock approvato:** P19 r4.

## Q13 — P04: quante altre note mostrare direttamente nel profilo?

**DECISO — due note recenti, poi “Altre note”.** La sezione compare solo se esistono note. Mostra le due più recenti con tipo e sessione chiaramente etichettati; il comando “Altre note” apre il resto su richiesta. Nota iniziale, note generali del corso e note di valutazione restano concetti distinti.

**Mock approvato:** struttura P04 r5, con azione breve “Modifica” nell'header. La r7 aggiunge alla card Valutazioni la stessa griglia settimanale usata in P18/P19; questa integrazione puntuale resta da rivedere.

## Chiarimento già risolto — tipi di barca

La fonte normativa `01_PRODUCT_SPEC.md` usa:

- D5 → RS 500;
- C1 → J/80;
- C2 → First 25.7;
- C3 → First 27.

La r7 usa quindi **First 25.7**, non 27.5. P07 mostra per questo ciclo RS Quest, RS 500, J/80, First 25.7 e First 27.

## Questioni ancora non bloccanti

Restano da concordare in una fase successiva il nome finale dell'app, l'eventuale marchio derivato, l'uso di fotografie Instagram e i risultati delle prove fisiche su OCR/voce. P19 resta approvata; P04 conserva la struttura approvata e richiede revisione della nuova griglia; la struttura P15 resta approvata. I target r8 di P13/P17, i target r7 di P14/P16 e il fix P18 richiedono una lettura finale.
