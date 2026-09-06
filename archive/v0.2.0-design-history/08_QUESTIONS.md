# 08 — Decisioni dopo la revisione umana

**Stato:** risposte r1 consolidate e revisioni pagina per pagina fino al 6 settembre 2026 recepite. Il codice resta fuori da questa fase; i mock r10 non sono automaticamente target approvati. Q10–Q13 sono risolte e aggiornate in [12](12_R2_REVIEW_QUESTIONS.md).

La [revisione originale dell'autore](sources/08_reviewed_2026-09-04.txt) conserva le risposte verbatim, prima della pulizia editoriale. SHA-256: `BE269A535301A8D7F8BF533CA36ABA0F922F725D69044C3B4004AEA43756278F`. Le domande/proposte precedenti sono anche nel checkpoint `9e6b6b5`.

## Q01 — Barca della sessione e indisponibilità del corso

**DECISO · CREW-06 · P08/P14/P15.** La richiesta è **deselezionare la barca dall'uscita della sessione aperta**. L'equipaggio conserva persone e identità e torna senza barca; le altre sessioni non cambiano.

Se invece la barca diventa indisponibile per il corso, mantenere le assegnazioni esistenti. Warning massimo/rosso vicino alla barca in Equipaggi o nel pannello Barche/Equipaggi. Un'avaria irrisolta produce un segnale meno grave/giallo; non rende automaticamente la barca inutilizzabile. Un'avaria risolta non produce questo warning.

“Barca rimossa” nella risposta è interpretato nel contesto come barca rimossa dalle disponibili del corso, non eliminazione del record storico. La cancellazione di una barca già referenziata resta distinta e protetta.

## Q02 — Duplicato nelle Comandate

**DECISO · CMD-07 · P11/P13.** Proposta accettata: duplicati **rossi**, su persona e giorni coinvolti; giallo per raccomandazioni. Il rosso resta visibile anche se intenzionale. Assegnare più turni rimane consentito. Resa grafica da verificare nel mock.

## Q03 — Giorni con più persone

**SUPERATO DALLA REVISIONE r1 · CMD-03 · P12.** Etichetta da usare: **Giorni con più persone**.

Per N persone e D giorni rimanenti: assegnare a ogni giorno la quota base `floor(N/D)`. L'utente seleziona i `N mod D` giorni che ricevono una persona in più. Con 23/7 e sabato/domenica selezionati: `4,4,3,3,3,3,3`.

La revisione r2 conferma che il mock richiede esattamente il numero di giorni necessario e disabilita “Genera proposta” finché la selezione non è completa. Se N < D, la quota base è zero e l'utente sceglie N giorni con una persona. Nessun nuovo solver. “Da metà settimana” usa persone ancora eleggibili e giorni rimanenti; completati fuori dal ricalcolo. Priorità venerdì/minori/sesso e tie-break restano applicate.

## Q04 — Viewport e densità

**ACCETTATO PER I MOCK · P03/P11/P14/P17.** Usare la proposta iniziale: 430 × 820 CSS px come target grande, 390 × 664 come piccolo, 412 × 760 come intermedio; 21/23 allievi. Aggiungere stress a larghezza 320 e testo ingrandito senza pretendere zero scroll.

Esaminare i due estremi e il caso medio prima di valutare adattamenti più aggressivi basati su pixel/proporzioni. Per ora niente sistema complesso di resizing. Portrait, tocco e nomi leggibili precedono il traguardo zero scroll; eventuali deroghe si decidono sui risultati visivi.

## Q05 — Geometria Valutazioni

**SUPERATO DALLA REVISIONE r8 · EVAL-01 · P17.** Nome e cinque valori `++`, `+`, `=`, `-`, `--` condividono una riga; il nome apre la nota. Nessun controllo `~`: nessuna selezione è lo stato iniziale e il secondo tap sul voto attivo lo annulla. Voti sempre diretti, senza dialog, con icone e area di tocco da 40 px.

## Q06 — OCR: metrica e acquisizione guidata

**DECISO · OCR-001 · P06.** La percentuale di campi corretti associati alla persona giusta, sui campi leggibili nel corpus, è la metrica pratica principale. Riportare anche righe complete, mancanti, associazioni errate e falsi allievi. **Non dedicare lavoro a un confronto cronometrato con l'inserimento manuale.** Puntare a risultati vicini al 90% nella maggior parte dei casi; corpus e risultati definiranno quanto l'obiettivo sia raggiunto, senza prometterlo prima delle prove.

- Guidare l'utente a inquadrare **nome, cognome e data di nascita**, evitando il resto del foglio ove possibile. Esplorare rettangolo di guida in camera e/o crop e rotazione dopo lo scatto; file e screenshot restano utilizzabili.
- Non penalizzare come “dato mancato” un telefono intenzionalmente escluso dall'inquadratura. Se presente e affidabile, continua a essere recuperabile; non inventare dati assenti. Il sesso suggerito resta separato dalla lettura OCR.
- Nomi/campi affidabili parziali restano nella revisione; obbligatori da completare prima del commit, senza cambiare implicitamente il modello anagrafico.
- ADV/IS/AT/CT non diventano allievi; nessuna creazione automatica di volontari.
- Nessuna conservazione della foto umana originale nel repository. Fixture sintetica o versione completamente anonimizzata concordata.
- Confine locale confermato per il ciclo; confronto limitato di motori locali ammesso. Online-first rimane successivo.

## Q07 — Voce: piattaforme e permessi

**REQUISITI DECISI · STT-001 · P05/P09/P17.** Deve funzionare da browser PC, Android e iPhone. Richiedere il permesso microfono al **primo tentativo di registrazione**, non all'apertura dell'app; gestire poi lo stato di permesso già concesso/negato dal browser. La revisione r1 elimina P20: dettatura, permesso, registrazione, retry e testo correggibile restano nello stesso pannello in cui la nota o l'avaria viene scritta.

L'autore svolgerà il collaudo finale fisico. Preparare un percorso breve e ripetibile con piattaforma/browser, esito microfono, caricamento, testo, retry e tempi osservati. Le prove automatiche con fixture e gli errori simulati restano responsabilità dell'implementazione e non sostituiscono quel collaudo.

La soglia “10 secondi per una nota di 15 secondi” era una proposta: **non è stata esplicitamente approvata**. Misurare prima di fissarla. Il modello locale, cache, testo correggibile, audio scartato e feedback primo uso restano la direzione esistente; nessuna nuova scelta di motore è implicita nella risposta.

## Q08 — Riferimenti visivi

**RIFERIMENTI RICEVUTI · BRAND-01/02.** L'autore indica:

- [Centro Velico Caprera](https://www.centrovelicocaprera.it/)
- [Instagram CVC](https://www.instagram.com/cvcaprera/?hl=it)
- [YouTube CVC](https://www.youtube.com/user/CentroVelicoCaprera)
- [Fondazione CVC](https://www.fondazionecvc.org/)

Usarli per palette, tipografia e marchio. Il nome definitivo dell'app e un eventuale logo derivato **non sono ancora scelte approvate**. La revisione r2 chiede sulla Home il simbolo CVC intero, tagliando soltanto la dicitura Fondazione. L'immagine RS Quest fornita era già tagliata a destra: dalla r3 la galleria conserva l'originale e usa una ricostruzione grafica completa come proposta, da non confondere con un nuovo asset ufficiale. Il codice corso è dinamico nel formato `D2 - 35 | 2026`. Le immagini Instagram restano un upgrade futuro.

## Q09 — Modifica immediata del profilo

**ACCETTATO · STUD-01/02/03 · P04/P05.** Record esistente: selezioni salvate subito, testo valido dopo breve pausa; campo obbligatorio temporaneamente vuoto come bozza con errore, senza corrompere il dato salvato. Gestire scritture pendenti prima della navigazione. Fine chiude il form senza nuova approvazione di ogni edit. Creazione e cancellazione con conferma esplicita.

Scorciatoia iniziale: form aperto e focalizzato sul campo; inline successivo solo con beneficio concreto. Long press negli Equipaggi continua ad aprire il profilo, non a modificare un campo.

## Cosa resta da decidere guardando i mock

P12 è confermata. Q10–Q13 fissano P13 centrata sul giorno, P15 su due righe senza scroll orizzontale, P19 con riepilogo in alto e P04 con due note recenti. La revisione r8 porta P13 a due allievi per riga e P17 a nome + cinque valutazioni sulla stessa riga; la r9 rende le azioni di P13 più discrete, senza pulsanti blu pieni; la r10 rimuove anche il bannerino azzurro e introduce i loghi barca uniformati nel mock. P19 resta approvata; P04 conserva l'approvazione r5 ma la nuova integrazione va rivista; la struttura visiva P15 resta approvata. I tempi voce si stabiliscono con misure; nome/marchio definitivo si concordano nella revisione grafica.

## Decisioni operative aggiunte nella r6

- P08: “Da controllare” usa il giallo; “Disponibile” resta neutro.
- P11: card di altezze diverse allineano il contenuto in alto.
- P13: il warning è una vera icona vettoriale; il testo elenca tutti i giorni coinvolti, per esempio “Sabato, Mercoledì”. Il bannerino introduttivo è rimosso; i bottoni nome non mostrano “Assegna”; la X resta compatta con area attiva 40 × 40 px.
- P04: l'azione nell'header è “Modifica”.
- P14: destinazione reale e numero equipaggio sono campi separati, senza etichetta ridondante “Destinazione”. Il doppio click/tap su un allievo inserito lo riporta fra i Disponibili; serve anche un comando esplicito accessibile nell'app.
- P15: grigio = non disponibile, verde = assegnata, blu = disponibile non assegnata. Selezionare un equipaggio senza barca e poi una barca blu crea e persiste l'associazione della sessione.
- P18: “Ordinamento” compare sopra Alfabetico/Valutazione; i bottoni sono più bassi ma restano da 40 px.

## Decisioni operative aggiunte nella r7

- P04: la card Valutazioni include la stessa griglia settimanale di P18/P19.
- P13: ogni allievo occupa una sola riga a tutta larghezza; i giorni diventano Lun/Mar/Mer/Gio/Ven/Sab/Dom per lasciare spazio ai nomi lunghi.
- P14: il popup destinazione ordina le barche per numero e usa gli stessi stati grigio/verde/blu di P15.
- P16: il logo della barca aumenta leggermente, senza alzare le card.
- P17: i cinque valori sono icone SVG dedicate e allineate; anche `--` condivide la stessa linea di base.
- P18: la riga nome viene compattata fino al target minimo di 40 px. Il trattamento r6 è stato approvato e questa è una rifinitura puntuale.

## Decisioni operative aggiunte nella r8

- P13: due allievi per riga. Le card con una sola assegnazione restano affiancate; un duplicato con più giorni può occupare entrambe le colonne per non separare giorni e azioni.
- P17: nome e cinque valutazioni sulla stessa riga. Il nome apre la nota; le cinque aree di voto restano da 40 px anche a 320 px.

## Decisioni operative aggiunte nella r9

- P13: eliminati i pulsanti blu pieni dalle card. Le righe sono superfici neutre di lista raggruppata, con divisori tenui; l'assegnazione usa un `+` blu discreto. A 320 px il `+` lascia posto a testo blu e sottile inset blu, per lasciare più spazio ai nomi mantenendo l'azione riconoscibile.

## Decisioni operative aggiunte nella r10

- P13: rimosso il bannerino azzurro “Tocca un nome…”; il contesto resta nei titoli dei tre gruppi e nell'azione sul nome.
- P07–P16: il mock usa tavole PNG trasparenti uniformate a 256 × 72 px per RS 500, Laser Vago, RS Tera, J/80, First 25.7 e First 27; RS Quest conserva l'asset già presente.
