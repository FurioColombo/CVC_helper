# 08 — Decisioni dopo la revisione umana

**Stato:** risposte recepite il 4 settembre 2026. I punti necessari ai primi mock sono risolti. Il codice resta fuori da questa fase; i mock richiedono ancora revisione, non sono automaticamente target approvati.

La [revisione originale dell'autore](sources/08_reviewed_2026-09-04.txt) conserva le risposte verbatim, prima della pulizia editoriale. SHA-256: `BE269A535301A8D7F8BF533CA36ABA0F922F725D69044C3B4004AEA43756278F`. Le domande/proposte precedenti sono anche nel checkpoint `9e6b6b5`.

## Q01 — Barca della sessione e indisponibilità del corso

**DECISO · CREW-06 · P08/P14/P15.** La richiesta è **deselezionare la barca dall'uscita della sessione aperta**. L'equipaggio conserva persone e identità e torna senza barca; le altre sessioni non cambiano.

Se invece la barca diventa indisponibile per il corso, mantenere le assegnazioni esistenti. Warning massimo/rosso vicino alla barca in Equipaggi o nel pannello Barche/Equipaggi. Un'avaria irrisolta produce un segnale meno grave/giallo; non rende automaticamente la barca inutilizzabile. Un'avaria risolta non produce questo warning.

“Barca rimossa” nella risposta è interpretato nel contesto come barca rimossa dalle disponibili del corso, non eliminazione del record storico. La cancellazione di una barca già referenziata resta distinta e protetta.

## Q02 — Duplicato nelle Comandate

**DECISO · CMD-07 · P11/P13.** Proposta accettata: duplicati **rossi**, su persona e giorni coinvolti; giallo per raccomandazioni. Il rosso resta visibile anche se intenzionale. Assegnare più turni rimane consentito. Resa grafica da verificare nel mock.

## Q03 — Giorni con meno persone

**DECISO · CMD-03 · P12.** Etichetta da usare: **Giorni con meno persone**, al posto di “giorni leggeri”.

Per N persone e D giorni rimanenti: quota base `floor(N/D)`, un extra a N mod D giorni. Extra prima ai giorni non selezionati in ordine cronologico, poi ai selezionati se necessario. Tutti selezionati equivale a nessuna preferenza. Con 23/7 e sabato selezionato: `3,4,4,3,3,3,3`.

Se N < D, alcuni giorni sono a zero: segnalare l'eccezione e lasciare la correzione manuale. Nessun limite rigido e nessun nuovo solver. Completati fuori dal ricalcolo; priorità venerdì/minori/sesso e tie-break restano applicate.

## Q04 — Viewport e densità

**ACCETTATO PER I MOCK · P03/P11/P14/P17.** Usare la proposta iniziale: 430 × 820 CSS px come target grande, 390 × 664 come piccolo, 412 × 760 come intermedio; 21/23 allievi. Aggiungere stress a larghezza 320 e testo ingrandito senza pretendere zero scroll.

Esaminare i due estremi e il caso medio prima di valutare adattamenti più aggressivi basati su pixel/proporzioni. Per ora niente sistema complesso di resizing. Portrait, tocco e nomi leggibili precedono il traguardo zero scroll; eventuali deroghe si decidono sui risultati visivi.

## Q05 — Valutazioni in una o due righe

**ACCETTATO PER ORA · EVAL-01 · P17.** Una riga dove entra davvero; due righe basse sugli schermi insufficienti. Voti sempre selezionabili direttamente, senza dialog aggiuntivo e senza ridurre i touch target per rispettare artificialmente la singola riga.

## Q06 — OCR: metrica e acquisizione guidata

**DECISO · OCR-001 · P06.** La percentuale di campi corretti associati alla persona giusta, sui campi leggibili nel corpus, è la metrica pratica principale. Riportare anche righe complete, mancanti, associazioni errate e falsi allievi. **Non dedicare lavoro a un confronto cronometrato con l'inserimento manuale.** Puntare a risultati vicini al 90% nella maggior parte dei casi; corpus e risultati definiranno quanto l'obiettivo sia raggiunto, senza prometterlo prima delle prove.

- Guidare l'utente a inquadrare **nome, cognome e data di nascita**, evitando il resto del foglio ove possibile. Esplorare rettangolo di guida in camera e/o crop e rotazione dopo lo scatto; file e screenshot restano utilizzabili.
- Non penalizzare come “dato mancato” un telefono intenzionalmente escluso dall'inquadratura. Se presente e affidabile, continua a essere recuperabile; non inventare dati assenti. Il sesso suggerito resta separato dalla lettura OCR.
- Nomi/campi affidabili parziali restano nella revisione; obbligatori da completare prima del commit, senza cambiare implicitamente il modello anagrafico.
- ADV/IS/AT/CT non diventano allievi; nessuna creazione automatica di volontari.
- Nessuna conservazione della foto umana originale nel repository. Fixture sintetica o versione completamente anonimizzata concordata.
- Confine locale confermato per il ciclo; confronto limitato di motori locali ammesso. Online-first rimane successivo.

## Q07 — Voce: piattaforme e permessi

**REQUISITI DECISI · STT-001 · P20/P05/P09/P17.** Deve funzionare da browser PC, Android e iPhone. Richiedere il permesso microfono al **primo tentativo di registrazione**, non all'apertura dell'app; gestire poi lo stato di permesso già concesso/negato dal browser.

L'autore svolgerà il collaudo finale fisico. Preparare un percorso breve e ripetibile con piattaforma/browser, esito microfono, caricamento, testo, retry e tempi osservati. Le prove automatiche con fixture e gli errori simulati restano responsabilità dell'implementazione e non sostituiscono quel collaudo.

La soglia “10 secondi per una nota di 15 secondi” era una proposta: **non è stata esplicitamente approvata**. Misurare prima di fissarla. Il modello locale, cache, testo correggibile, audio scartato e feedback primo uso restano la direzione esistente; nessuna nuova scelta di motore è implicita nella risposta.

## Q08 — Riferimenti visivi

**RIFERIMENTI RICEVUTI · BRAND-01/02.** L'autore indica:

- [Centro Velico Caprera](https://www.centrovelicocaprera.it/)
- [Instagram CVC](https://www.instagram.com/cvcaprera/?hl=it)
- [YouTube CVC](https://www.youtube.com/user/CentroVelicoCaprera)
- [Fondazione CVC](https://www.fondazionecvc.org/)

Usarli per palette, tipografia e marchio. Il nome definitivo dell'app, un logo derivato e l'inserimento del codice corso nel logo **non sono ancora scelte approvate**. Per r1 si usa un titolo di lavoro “CVC Helper” dichiarato provvisorio; il logo originale resta riconoscibile e non viene ridisegnato come se fosse un marchio approvato.

## Q09 — Modifica immediata del profilo

**ACCETTATO · STUD-01/02/03 · P04/P05.** Record esistente: selezioni salvate subito, testo valido dopo breve pausa; campo obbligatorio temporaneamente vuoto come bozza con errore, senza corrompere il dato salvato. Gestire scritture pendenti prima della navigazione. Fine chiude il form senza nuova approvazione di ogni edit. Creazione e cancellazione con conferma esplicita.

Scorciatoia iniziale: form aperto e focalizzato sul campo; inline successivo solo con beneficio concreto. Long press negli Equipaggi continua ad aprire il profilo, non a modificare un campo.

## Cosa resta da decidere guardando i mock

La resa dei warning, la densità effettiva sui tre viewport, il posizionamento del contatore, la geometria delle valutazioni e la variante di branding. Nessuno di questi punti richiede di riproporre Q01–Q06/Q09 da zero. I tempi voce si stabiliscono con misure; nome/marchio definitivo si concordano nella revisione grafica.
