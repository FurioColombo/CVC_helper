# 10 — Aggiornamento delle specifiche e versioni

**Stato:** piano di modifica, non applicato. `01`–`04`, `AGENTS.md`, package e configurazione sono invariati nella fase documentale. Le nuove regole si trasferiscono nelle fonti autorevoli dopo le decisioni e prima dell'implementazione pertinente.

## 1. Gerarchia per il prossimo ciclo

Proposta: istruzione umana corrente → `01` comportamento/dominio → `02` perimetro approvato → `03` architettura → `09` ordine/prove. `06` e i target approvati di `07` guidano design e accettazione visuale senza contraddire le regole di prodotto. `05` conserva motivazioni e tracciabilità; `08` le risposte recepite il 4 settembre e i pochi punti visuali residui.

Non obbligare un futuro agente a scegliere fra paragrafi incompatibili: consolidare i punti toccati nei documenti autorevoli, rimuovendo le formulazioni obsolete invece di aggiungere un'altra appendice contraddittoria. Git conserva la storia. Non leggere o promuovere `archive/` come fonte normativa.

## 2. Modifiche pianificate a 01_PRODUCT_SPEC.md

| Area attuale                          | Aggiornamento futuro                                                                                                                                                                                         | Fonte / condizione                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| §2 UX e Field-use UX                  | Informazioni simultanee, compattezza, portrait, feedback locale; rimando al rulebook per misure e accettazione visuale.                                                                                      | UX-G01–07; target concordati          |
| §4 Home e Primary navigation          | Consolidare sei card e nav Avarie/Home/Equipaggi; identità secondo asset/target, senza dashboard.                                                                                                            | BRAND-01/02; Q08                      |
| §5.1 elenco Allievi                   | Consentire griglia compatta, stessi dati essenziali, nomi distinguibili, M minore, Aggiungi raggiungibile; cognome e tie-break nome visualizzato.                                                            | STUD-05–08                            |
| §5.6/5.7 conoscenza e profilo         | Taglia/nota iniziale nello stesso form, stessa informazione persistita; scorciatoia e contratto salvataggio.                                                                                                 | STUD-01/02/03; Q09                    |
| Lifecycle allievo / invarianti        | Eliminazione solo per mai-usati; elenco completo referenze operative/storiche, conferma, ragioni del blocco, disattivazione; nessuna cascata.                                                                | STUD-04                               |
| §6 configurazione barche              | Separatori multipli inclusi spazi, vuoti ignorati e deduplicazione.                                                                                                                                          | BOAT-01                               |
| Boat lifecycle / §8.7 barche sessione | Deselezione nella sola sessione aperta: equipaggio senza barca, persone conservate. Indisponibilità corso: assegnazioni conservate, rosso; avarie irrisolte gialle.                                          | CREW-06; Q01 risolta                  |
| §6/avarie                             | Identità barca comune, preview utile, stato diretto compatto; disponibilità e fault restano distinti.                                                                                                        | BOAT-02, FAULT-01/02/04               |
| §7 Comandate                          | Conteggio eleggibili, Ma/Me, preview non mutante, quota base `floor(N/D)` e scelta “Giorni con più persone”; warning su giorni/persone, già usati in fondo, M.                                               | CMD-01–08; revisione r1/Q03           |
| §8.4 staff e enum                     | ADV/IS/CT, CT imbarcabile ed escluso da regole allievi; nome “Volontari disponibili”.                                                                                                                        | VOL-01/03                             |
| §8.6/8.10/8.11 Equipaggi              | Header compatto, pool = mancanti, nessun dialog mancanti; contatore allievi collocati include A terra/esclude staff; pannello barche; annuncio pulito.                                                       | CREW-01–05                            |
| §9 Valutazioni                        | Layout compatto, sessione affiancata, segni cromatici, sei valori e nota preservati; togliere testo ridondante.                                                                                              | EVAL-01–05; Q05                       |
| §5.4 scan / §11 voce                  | OCR: campi/persona, vicino al 90% tipico, fotocamera intera, rotazione libera/crop, niente cronometro manuale. Voce PC/Android/iPhone integrata nel pannello testo, permesso al tap Detta e collaudo autore. | OCR-001/STT-001; Q06/Q07/revisione r1 |

Nel consolidamento preservare: maggiorenne/minore calcolato alla data di riferimento, nomi univoci, valori mancanti distinti da neutri, media interna su voti presenti, A terra individuale, Mezzi vero equipaggio, nessuna doppia barca simultanea, completati Comandate immutabili nel ricalcolo, manual override e audio transitorio.

Pulizia circoscritta utile: `01` contiene decisioni successive che superano esempi iniziali (warning, layout cronologia) e un rimando a `01_UX_SPEC.md`. Ricondurre i rimandi alla regola normativa presente in `01`, senza cercare razionale storico in archive e senza cambiare soglie per sola uniformità editoriale.

## 3. Modifiche pianificate a 02_MVP_SCOPE.md

Conservare il confine dell'MVP 0.1.0 come baseline conclusa, poi aggiungere un perimetro chiaramente separato “Ciclo UX post-MVP”. Non riscrivere retroattivamente cosa significava COMPLETE in M15.

| Perimetro proposto                      | Contenuto                                                                                                                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Affidabilità da riconfermare/correggere | STT reale e OCR utile con review, fixture e prova sul target.                                                                                                                                      |
| Nucleo UX                               | Compattezza e informazioni simultanee per tutte le pagine elencate; modifica taglia/nota, eliminazione sicura allievi, CT, parser barche, Comandate preview/stato locale, Equipaggi e Valutazioni. |
| Condizionato                            | Regole Q01–Q06/Q09 recepite. Restano verifica dei mock sui tre viewport, trattamento grafico/nome finale e tempi voce misurati.                                                                    |
| Facoltativo                             | Ordinamenti avanzati, editing inline oltre al form focalizzato, set custom icone, icone parti guaste.                                                                                              |
| Fuori da questo ciclo                   | Sync, backend/Auth, nuovi documenti/archivi/dashboard, auto-equipaggi, bande valutazione, brightness nativa, export immagini salvo nuovo scope esplicito.                                          |

Rendere ogni rinvio visibile in `09`; non rinviare tacitamente una richiesta confermata solo perché meno grafica. Separare difetto segnalato, riprodotto, già risolto e limitazione accettata.

## 4. Modifiche pianificate a 03_TECHNICAL_DECISIONS.md

- Registrare come decisione già presa PowerSync locale dopo spike riuscito; non riaprire automaticamente lo spike o attivare Dexie senza nuovo motivo. Stack attuale React/TypeScript/Vite, Base UI/shadcn/Tailwind preservato.
- Aggiungere la piccola convenzione per token e componenti condivisi: persona/badge, identificativo barca, sessione e selezione compatta; nessun grande design system.
- Formalizzare autosave/errore e scritture coerenti dove necessario, controllo referenze al delete, CT additivo e compatibilità dati 0.1.0; eventuale transazione per CREW-06 secondo Q01.
- OCR/STT restano dietro confini provider indipendenti. Applicare Q06/Q07 e uno spike limitato; nessuna selezione di motore o backend nella fase di design. Non cambiare schema anagrafico per facilitare le percentuali OCR.
- Estendere l'harness secondo `09`: piano milestone esplicito, prove collegate a revisione/target, dati sintetici, misure visuali, browser matrix e test fisici separati.
- Confermare Node 24 e prerequisiti ambiente. La versione nel PATH di questa sessione non giustifica l'abbassamento del requisito.
- Specificare dove vivono i mock: file isolati di progettazione, nessun import nella build e nessun accesso al database dell'app.

## 5. Raccordo minimo AGENTS e 04

`AGENTS.md` oggi ordina di leggere `01`–`04` e iniziare il primo milestone incompleto. Quando il ciclo è approvato, aggiungere un'indicazione inequivoca che `04` è concluso e `09` è il piano attivo post-MVP; includere rulebook/target approvati nella lettura. Conservare harness-first, gerarchia e policy reviewer; precisare sequenzialità richiesta per le aree UX.

In `04` basta un link al nuovo ciclo approvato. Non riaprire M0–M15 né riscriverne evidenze/checkpoint. Manifest, script e CI vengono adeguati soltanto nell'attivazione del ciclo, non in questa pianificazione.

## 6. Versionamento leggero

**Baseline concordata:** chiamare l'attuale prodotto **0.1.0** e associarlo a `c907b19`. Questa è un'etichetta documentale: oggi package/lock dichiarano 0.0.0 e non è stato creato alcun tag di release.

Proposta a basso costo:

| Versione      | Quando usarla                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1.1, 0.1.2… | Eventuale rilascio separato di correzioni sul comportamento esistente. Nessun obbligo di pubblicare ogni milestone.                              |
| 0.2.0         | Primo ciclo UX approvato e verificato, incluso CT e le interazioni concordate. Numero proposto, non release annunciata.                          |
| 0.3.0…        | Successivi pacchetti riconoscibili di funzioni/cambiamenti.                                                                                      |
| 1.0.0         | Traguardo stabile deciso esplicitamente; in seguito major per incompatibilità sostanziali. Nessun automatismo “grande modifica grafica = major”. |

Un solo `CHANGELOG.md`, da creare al primo rilascio: versione/data, 3–6 punti di cambiamenti visibili, eventuali limiti o migrazioni. Un tag Git e allineamento package/lock per ogni release effettiva; nessun numero per ogni card o fix interno, nessun generatore/servizio/changelog per-feature.

Se utile, al primo checkpoint di attivazione allineare package e lock a 0.1.0 e registrare il riferimento alla baseline; poi aggiornare al rilascio 0.2.0. Una tag della baseline e una release preparatoria sono operazioni distinte: non chiamare “0.1.0 già pubblicata” questa nota. Lo schema del database ha una sua compatibilità e non va confuso con la versione dell'app.

Le vecchie intestazioni v0.4/v0.5/v0.6 nelle specifiche sono revisioni delle decisioni, **non** release dell'app: rinominarle/ricollocarle nel consolidamento per evitare ambiguità.

## 7. Cose da non dimenticare

Queste aggiunte hanno utilità concreta e sono già considerate in `06`–`09`:

- compatibilità dei dati esistenti e confine temporale delle modifiche barca;
- stati vuoti, errori, salvataggi, tastiera, focus e safe area, oltre alla schermata ideale;
- metrica di densità su stessi dati/viewport e prova su telefono, senza comprimere i touch target;
- distinzione fra prova reale OCR/STT e test con risposta simulata;
- approvazione del target con revisione precisa e perimetro dei rinvii;
- limiti M15 noti (completeness storica dopo riattivazione, note non confermate, validazione completa database, controlli assistivi fisici) valutati come backlog, senza gonfiare il restyling.

Nessuna nuova infrastruttura di rilascio o gestione progetto è necessaria per ottenere questi vantaggi.
