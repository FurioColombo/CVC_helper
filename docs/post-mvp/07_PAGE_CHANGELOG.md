# 07 — Changelist per pagina e brief dei mock

**Stato:** revisione umana r2 del 5 settembre recepita; galleria r3 disponibile con 19 viste principali. P03 e P10/P12 hanno approvazioni o conferme parziali registrate in `11`; P13/P15/P19 e il limite note P04 restano aperti in [12](12_R2_REVIEW_QUESTIONS.md). Nessuna pagina è implementata nell'app.

Le pagine includono viste, form e pannelli rilevanti anche quando oggi condividono lo stesso componente. Si possono raggruppare per discussione, ma vanno verificate singolarmente. Le note sull'attuale app derivano da lettura del codice e del registro M15, non da una nuova ispezione browser.

## 1. Regole comuni del confronto

Applicare R01–R15 a tutte le pagine. Ogni target avrà: revisione, richieste coperte, viewport/dati, stato iniziale, azione principale, risultato visibile, eccezioni, approvazione. Le prove useranno la stessa fixture prima/dopo; i numeri di densità vanno misurati, non inventati.

Il set minimo di stati è: vuoto, normale, contenuto lungo/affollato, selezione quando prevista, salvataggio/errore quando previsto. Per viste dense aggiungere minori, omonimi, warning e disabilitati. Nessun test nuovo solo per verificare che una classe CSS sia stata rinominata.

## P01 — Home e navigazione comune

**Richieste:** BRAND-01/02, UX-G03/05; R02/R12/R13. **Natura:** grafica. **Dipendenza:** Q08 per branding definitivo.

- Home senza riga inferiore “Corso Deriva/Cabinato · Livello #”. Identità dinamica su una riga: per esempio `D2 - 35` grande/blu e `| 2026` piccolo/grigio.
- Usare il simbolo CVC intero nell'header, ritagliando soltanto la dicitura Fondazione. Allievi/Equipaggi/Valutazioni hanno accento arancione; Barche/Comandate/Volontari blu proposto. Immagini Instagram restano upgrade futuro.
- Conservare le sei destinazioni Allievi, Barche, Comandate, Equipaggi, Valutazioni, Volontari e Impostazioni separato.
- Navigazione persistente esattamente Avarie / Home / Equipaggi, Home centrale. Nessun nuovo dashboard widget.
- Proporre un set minimo coerente di icone esistenti prima di ICON-01.

**Mock:** Home con corso, titolo lungo, viewport stretto; shell con pagina scorsa e safe area. **Accettazione:** tutti gli ingressi trovabili, testo leggibile e nessuna copertura dell'ultima riga; back/focus coerenti. **Baseline da acquisire:** `src/App.tsx`, `src/styles.css`.

## P02 — Creazione corso e Impostazioni

**Richieste:** UX-G02/03, BRAND-01. **Natura:** coerenza visiva, nessuna nuova funzione.

- Riutilizzare tipografia/header/controlli definiti in P01.
- Mantenere famiglia, livello, etichetta e date derivate secondo `01`; non aggiungere archivio o conclusione corso.
- Mostrare “Il tuo corso” nel formato `D2 - 35 | 2026`; D/C e livello cambiano con famiglia/livello, settimana ISO e anno derivano automaticamente dal calendario. Nascondere la navigazione inferiore durante la creazione.
- Impostazioni mantiene i controlli esistenti; eventuale versione visibile è facoltativa e non richiede una nuova pagina.

**Mock:** primo avvio, form selezionato/errore, Impostazioni. **Accettazione:** creazione e riapertura non regrediscono; tastiera e focus non coperti. **Baseline:** `src/App.tsx`.

## P03 — Elenco Allievi

**Richieste:** STUD-05/06/07/08, UX-G01/03/04/05. **Natura:** grafica + tie-break ordinamento.

- Due colonne come prima proposta; card con nome identificabile, età, indicatore sesso e M minore. Dati personali di dettaglio non entrano nella lista.
- Ridurre l'icona generica; evitare tre M ambigue per sesso/taglia/minore. Disabilitati ancora visibili e distinguibili.
- Aggiungi come pulsante flottante blu in basso a destra, sopra safe area/navigazione e senza coprire l'ultima persona. Menu secondario mantiene Scan e Conoscenza.
- Ordinamento già in parte presente: attivi prima, cognome; proposta conservare questo raggruppamento e usare nome visualizzato come tie-break. Selettore avanzato fuori dal nucleo.

**Mock:** zero, 21/23 persone, omonimi, nome lungo, minorenne, disabilitato, scroll con Aggiungi. **Accettazione:** lista più densa sulla stessa fixture, nessuna identità troncata in modo ambiguo, tap apre profilo; Conoscenza disabilitata a zero. **Baseline:** `src/features/students/StudentManagement.tsx`, `src/persistence/students.ts`.

## P04 — Profilo, aggiunta e modifica allievo

**Richieste:** STUD-01/02/03/04, UX-G06. **Natura:** funzionale e integrità dati. **Decisione:** Q09 accettata; autosave e form focalizzato.

- Stesso form con anagrafica, nickname, telefono, taglia, nota iniziale e accesso alle valutazioni. Sesso come tre pulsanti diretti. La vista principale deve entrare sul 430/412/390 senza scroll inutile.
- Percorso esplicito Modifica; scorciatoia desktop/long press nel profilo sul campo. Prima proposta: apre il form e focalizza il campo; inline soltanto se semplice e coerente.
- Mostrare Salvataggio/Salvato/errore senza popup per ogni edit. Creazione resta confermata esplicitamente; i record esistenti possono usare il contratto autosave Q09.
- Eliminazione in zona secondaria distinta dalla disattivazione. Mostrare nome dell'allievo, conseguenza e conferma. Se usato, spiegare i legami effettivi con giorni/sessioni; niente cancellazioni a cascata.
- Nota iniziale distinta dalla nota di settimana e dalle note valutazione. “Altre note” compare solo quando esistono, in peso tipografico regolare; Q13 decide quante recenti mostrare prima del link alla storia.

**Mock:** lettura, form, campo focalizzato, errore salvataggio, eliminazione permessa/conferma, eliminazione bloccata con ragioni. **Accettazione:** modifica taglia/nota visibile anche in Conoscenza dopo reload; tutti i tipi di referenza impediscono delete, disattivazione disponibile; note proprie senza referenze non vengono arbitrariamente trattate come uso operativo. **Baseline:** gestione e persistenza studenti; checker invarianti.

## P05 — Conoscenza allievi

**Richieste:** UX-G01/02/03, STUD-01/02; STT-001 per la dettatura. **Natura:** layout/controlli e coerenza dati.

- Taglie XS/S/M/L/XL direttamente selezionabili, controllo compatto da 40 px nella r3 e senza sbordo. A 320 px il gruppo passa sotto il nome.
- Dare priorità orizzontale al nome: evitare che vada su due righe nei casi realistici. Taglia e nota restano sulla stessa card.
- “Detta” apre permesso/registrazione/trascrizione nello stesso pannello di modifica testo; nessuna pagina dedicata.
- Condividere salvataggio e valori con il profilo; nessuna copia separata della nota.

**Mock:** taglia mancante/selezionata, nota breve/lunga, dettatura, errore. **Accettazione:** un tap cambia taglia, testo persistito e condiviso con P04; nessun allievo perso durante navigazione rapida. **Baseline:** `src/features/students/StudentKnowledge.tsx`.

## P06 — Scan allievi: acquisizione e revisione

**Richieste:** OCR-001, UX-G02/04. **Natura:** affidabilità, non solo restyling. **Decisione:** metrica per campo/persona Q06, obiettivo vicino al 90% su casi tipici; nessun confronto cronometrato col manuale.

- Flusso r3: Scan allievi → Scegli dalla galleria oppure Fai una foto → fotocamera a schermo intero → rotazione libera e ritaglio → elaborazione → revisione campi → conferma inserimento.
- Indicare difficoltà recuperabile, proporre altra foto quando utile; non simulare un risultato affidabile se quasi tutte le righe sono inutili.
- Revisione compatta con campi incerti distinguibili, correzione/rimozione riga e fascia sticky live: righe da controllare, campi da completare, allievi inseriti. Nessun auto-commit.
- Personale non deve diventare allievo. Creazione separata volontari non è inclusa senza scelta esplicita.

**Mock:** acquisizione, orientamento/crop, elaborazione, rifiuto, parziali, revisione, conferma. **Accettazione:** corpus anonimo con verità attesa, recupero campi e associazione alla persona misurati, nessuna metrica di tempo rispetto al manuale, no righe false salvate. **Baseline:** `StudentScan.tsx`, `src/capabilities/studentScan.ts` e fixture M4.

## P07 — Configura/Aggiungi barche

**Richieste:** BOAT-01, UX-G02/03. **Natura:** parser + form.

- Campo numeri con hint breve “2 3 7, 8; 11”; accetta virgola/spazi/newline/punto e virgola anche ripetuti.
- Default tipo corso invariato e modificabile. Per il ciclo corrente il selettore include RS Quest, RS 500, J/80, First 25.7 e First 27, coerenti con `01`. Tastiera adeguata senza impedire i formati già supportati.
- Preservare filtro vuoti/deduplicazione già presenti; riepilogo delle barche effettivamente create.
- Mostrare questa configurazione soprattutto al primo inserimento. Gli inserimenti successivi partono dalla lista P08 e aggiungono una barca senza ripresentare la procedura iniziale; se P07 è comunque raggiungibile, mostrare le barche esistenti.

**Mock:** zero barche, input multiplo, duplicati/errore. **Accettazione:** equivalenza fra separatori, nessun record vuoto/duplicato, persistenza. **Baseline:** `BoatManagement.tsx`, `src/domain/boat.ts`.

## P08 — Elenco e dettaglio Barca

**Richieste:** BOAT-02, FAULT-02, CREW-06. **Natura:** grafica; Q01 distingue indisponibilità corso e deselezione sessione.

- Identificativo condiviso con logo del modello completo quando disponibile e numero subito a destra, senza ripetere il nome in testo; disponibilità e numero avarie distinti.
- Elenco compatto; dettaglio con guasti aperti in evidenza, risolti secondari.
- Separare Elimina inserimento errato, disponibilità corso e selezione uscita della sessione. La nuova azione di scollegamento usa la decisione Q01, non una cascata implicita.

**Mock:** barca sana, più avarie, indisponibile con assegnazione esistente, riattivazione, storico guasti. **Accettazione:** risolvere una sola avaria non dà verde se ne resta un'altra; storico preservato; effetto di indisponibilità conforme a Q01. **Baseline:** `BoatManagement.tsx`.

## P09 — Avarie: elenco, inserimento e stato

**Richieste:** FAULT-01/02/04, BOAT-02; FAULT-03 opzionale, STT-001 per voce. **Natura:** principalmente grafica.

- Card compatta con tipo/numero, preview proposta fino a tre righe e apertura del testo completo. Testare descrizioni che contengono il dettaglio utile alla terza riga.
- Segmento Aperta/Comunicata/Risolta diretto, una riga dedicata se necessaria ai target. Non comprimere tre etichette fino a renderle illeggibili.
- Modifica stato rapida, salvata; ordine/errori coerenti durante tap ripetuti.
- Icona parte guasta opzionale; default neutro e nessuna classificazione automatica che alteri il testo.
- Riutilizzare logo barca, numero e accento di stato di P08 per dare una gerarchia riconoscibile anche all'elenco avarie.

**Mock:** nessuna avaria, descrizione lunga, più guasti sulla stessa barca, tutti e tre gli stati, errore/retry, form/dettatura. **Accettazione:** più contenuto utile a parità viewport, testo completo raggiungibile in un tap, cambi stato e disponibilità indipendenti dopo reload. **Baseline:** `FaultManagement.tsx`, `FaultCard.tsx`, `FaultForm.tsx`.

## P10 — Volontari: lista e form

**Richieste:** VOL-01/02/03, UX-G03/04. **Natura:** ruolo dominio + grafica.

- Nome e scelta diretta ADV/IS/CT. Nessun altro ruolo.
- Usare una piccola identità visiva coerente con le persone, senza aggiungere decorazione generica.
- Togliere testo permanente sulle regole allievi; lista compatta con ruolo visibile.
- Stesso lessico e stile del pool Equipaggi; modifica dati già presenti compatibile.

**Mock:** vuoto, tre ruoli, aggiunta/modifica, nome lungo. **Accettazione:** CT salvato/riaperto, imbarcabile, escluso da Comandate/Valutazioni/conteggio allievi. **Baseline:** `VolunteerManagement.tsx`, enum e persistenza volontari.

## P11 — Comandate: settimana e avvisi

**Richieste:** CMD-04/07/08, UX-G01/03/04. **Natura:** layout e visibilità warning. **Decisioni:** Q02/Q04 recepite; duplicati rossi e tre viewport iniziali.

- Mostrare i sette gruppi con nomi, non solo titoli. Prima ipotesi: griglia a due colonne, sette card compatte; confronto possibile con righe compatte senza preapprovare la soluzione.
- M accanto ai minori. Warning su giorno e persona, secondo severità canonica concordata; eventuali warning globali restano distinguibili dai problemi localizzati.
- Tap sul segnale apre le ragioni, Avvisi resta secondario. Segnale rosso persistente e accettazione gialli secondo `01` e Q02 accettata.
- Rotazioni completate riconoscibili; ricalcolo non modifica lo storico.
- Un feedback sticky mostra persone uniche assegnate/totale: neutro quando uguali, giallo quando manca qualcuno. Una riga separa il nome del giorno dai nomi.

**Mock:** 21 e 23 allievi, sette giorni, duplicato sabato/mercoledì, disabilitato futuro, warning globale, giorno completato, giorno volutamente sovraffollato/vuoto. **Accettazione:** target viewport concordato; ogni occorrenza del duplicato evidenziata; nessuna nuova rigida limitazione agli override; warning storico non introdotto per sola disattivazione successiva. **Baseline:** `DutyManagement.tsx`, `src/domain/duties.ts`.

Il target r3 mostra esplicitamente un esempio con avviso e copertura 20/21; mantenere le due colonne e rendere il dettaglio raggiungibile senza cambiare pagina.

## P12 — Proposta/Ricalcola Comandate

**Richieste:** CMD-01/02/03. **Natura:** anteprima + regole deterministiche. **Decisione aggiornata:** “Giorni con più persone”.

- Conteggio disponibili pertinente alla porzione di settimana da pianificare.
- S D L Ma Me G V, conteggio live sotto ciascun giorno, selezione diretta “Giorni con più persone”. Quota base `floor(N/D)` uguale per tutti; i giorni scelti ricevono il resto.
- Anteprima graficamente provvisoria, proposta senza rosso semantico. Preferenze ed effetto nello stesso campo visivo; conferma raggiungibile senza attraversare un lungo roster.
- Nessuna modifica delle assegnazioni persistite finché non si conferma. La revisione r2 conferma esattamente `N mod D` giorni e abilita la generazione quando la selezione è completa. Se N < D la base è zero e vanno scelti N giorni. “Da metà settimana” ricalcola persone eleggibili e giorni rimanenti; non è solo testo del mock.
- Preferenze con switch compatti. “Restano la prossima settimana” deve consentire la selezione fra tutti gli allievi, non un sottoinsieme arbitrario.

**Mock:** 23 allievi, sabato/domenica con più persone, metà settimana con completati, nessuno da assegnare. **Accettazione:** preview e risultato concordano; somma e capacità coerenti; tutte le persone selezionabili per stay-over; storico e priorità venerdì/minori/sesso preservati. **Baseline:** `DutyManagement.tsx`, funzioni capacità/generazione.

## P13 — Selezione persone Comandata

**Richieste:** CMD-05/06/08, UX-G02/04/05. **Natura:** layout e ordine.

- **Aperto Q10:** scegliere fra vista centrata sul giorno (raccomandata: assegnati poi disponibili, tap aggiunge/rimuove) e vista centrata sulla persona con storia settimanale.
- In entrambi i casi, già usati restano selezionabili; una volta è corretto, più volte produce warning e dettaglio. Rimozione e aggiunta devono essere reversibili senza gesto nascosto.
- Giorno modificato e persone attualmente assegnate riconoscibili durante la scelta.

**Mock:** mai usato/una volta/più volte, minorenne, omonimi, nessuno libero. **Accettazione:** assegnazione ripetuta permessa e warning coerente in P11/P13; ordine non salta in modo da causare un tap involontario durante salvataggio. **Baseline:** sottovista di `DutyManagement.tsx`.

## P14 — Equipaggi: setup, composizione e verifica

**Richieste:** CREW-01/02/03/04/05, VOL-03, UX-G01/03/04/05. **Natura:** interazione e layout. **Decisioni:** Q04 viewport e Q01 barche recepite.

- Header con titolo e sessione affiancati. Setup conserva numero equipaggi distinto da persone/barche; non introduce creazione automatica.
- Workspace con pool allievi e card equipaggi consultabili insieme. Ogni equipaggio è una card larga su tre righe: destinazione, primo membro, secondo membro; così i nomi lunghi non competono fra loro.
- Disponibili = mancanti azionabili. Niente dialog mancanti. Contatore tiene conto di allievi in equipaggio **o A terra**; volontari esclusi. Etichetta breve proposta “Collocati 18/21” da confrontare con “Inseriti”.
- `A terra` e `Volontari` restano flottanti rispettivamente in basso a sinistra e destra, con contatore fra loro; non coprono slot o navigazione.
- Pool volontari separato, meno prioritario; breve scroll ammesso. A terra sempre distinto da equipaggio. Una destinazione compatta per card; barche in P15.
- Toccando la barca/destinazione si apre il selettore di destinazione; toccando il triangolo si leggono tutte le ragioni. Conservare selezione/move/swap, long press profilo, C/SM e taglia.
- Il warning equipaggio è distinto da quello barca: la r3 mostra due XL insieme anche su una barca disponibile. “Altre azioni” usa tre puntini; il selettore sessione è un controllo piatto e contestuale.

**Mock:** setup, 21 allievi, selezione, scambio, pool vuoto, A terra, staff CT, gap dopo copia, warning taglia/ripetizione, errore salvataggio, corso a equipaggi flessibili. **Accettazione:** persona compare una volta, pool si aggiorna, contatore corretto, dati per decidere simultanei secondo target; reload conserva sessione e collocazioni. **Baseline:** `CrewManagement.tsx`, dominio/persistenza equipaggi.

## P15 — Barche della sessione e destinazione equipaggio

**Richieste:** CREW-01/06, BOAT-02. **Natura:** pannello grafico e deselezione sessione secondo Q01 accettata.

- Selettore barche sticky in una fascia breve contestuale alla sessione; ogni barca usa logo modello, numero e stato. La r3 propone una riga scorribile con sette elementi; Q11 decide se mantenerla o usare due righe.
- Rendere distinti barche che escono, associazione esatta all'equipaggio, Mezzi, Non assegnato.
- Deselezionare una barca dall'uscita scollega l'equipaggio nella sola sessione aperta; mantiene persone e altre sessioni. Indisponibilità corso conserva invece l'assegnazione e mostra rosso vicino alla barca; avaria aperta gialla, senza blocco automatico.
- Copia barche precedente resta preview → modifica → conferma, separata dalla copia equipaggi.

**Mock:** barca libera/assegnata/indisponibile/con avaria, cambio destinazione, Mezzi, copia e rimozione assegnazione. **Accettazione:** una barca al massimo per equipaggio simultaneo; persone e storico integri; ritorno al workspace senza perdere selezione/sessione. **Baseline:** `CrewManagement.tsx`, `src/domain/crews.ts`.

## P16 — Lettura/annuncio Equipaggi

**Richieste:** UX-G01/03, BRAND-01; presidio regressione CREW-01. **Natura:** coerenza visiva.

- Ogni card ha tre campi distinti: numero equipaggio, logo modello + numero barca o “Senza barca”, persone. Nomi grandi e puliti; card basse.
- Nessun pannello decisionale, taglia, telefono o controlli di composizione. Mezzi conserva il suo significato operativo.
- Copia e quick edit restano percorsi secondari coerenti; ritorno alla sessione mantenuto.

**Mock:** Quest 7, solo Quest, nomi senza barca, Mezzi, nomi lunghi. **Accettazione:** leggibile con tre stati di assegnazione e ritorno rapido; nessuna barca richiesta per leggere. Wake lock non entra automaticamente nello scope.

## P17 — Valutazioni: inserimento per Allievi/Equipaggi

**Richieste:** EVAL-01/02/03/04/05. **Natura:** layout e controlli. **Decisione r2:** nome completo sopra, nota vicina e cinque icone sotto; nessun sesto valore per l'assenza.

- Titolo e sessione affiancati; selettore Allievi/Equipaggi/Riepilogo più basso in altezza; eliminare la frase indicata in EVAL-05.
- Nome completo e nota occupano la prima riga corta; ++, +, =, -, -- la seconda. Icone con area di tocco chiara al posto dei caratteri grezzi.
- Nessuna selezione è il default; toccare di nuovo il valore selezionato annulla il voto. Nessun pulsante `~`.
- Positivi verdi, negativi rossi, neutro distinto e assenza vuota nei riepiloghi. A terra resta presente e valutabile; nota legata alla sessione esatta.

**Mock:** due viste, nome lungo, tutti i valori, assenza, A terra, nota, save/error, tastiera. **Accettazione:** un tap per valore nella vista operativa; nessuna perdita di note; stessa valutazione nelle due viste; sessione non si confonde dopo scroll/reload. **Baseline:** `EvaluationManagement.tsx`.

## P18 — Riepilogo Valutazioni

**Richieste:** UX-G01/03; coerenza EVAL-02. **Natura:** compattezza, senza nuovi analytics.

- Una card per persona con griglia settimanale allineata: sette colonne giorno e due celle AM/PM, colori coerenti e simboli leggibili. Valori mancanti sono celle vuote, non `~`. Conteggio voti reali e ordine alfabetico/valutazione restano previsti.
- Note riconoscibili e apribili, nome verso storia allievo. Cronologia invariata e nessuna media numerica visibile.
- Nessuno scroll orizzontale: la settimana completa deve entrare nella larghezza disponibile. La lista può scorrere verticalmente.

**Mock:** tredici sessioni, valori mancanti, note, conteggi diversi, nome lungo. **Accettazione:** nessun overflow dell'intera pagina; timeline completa accessibile; media interna e ordinamento invariati. **Baseline:** `EvaluationOverview.tsx`.

## P19 — Storia valutazioni nel profilo

**Richieste:** UX-G03; presidio STUD-02/EVAL-02. **Natura:** coerenza e regressione.

- Raggruppare gerarchicamente per giorno; dentro ogni giorno mostrare sottocard AM e PM con voto e nota.
- Ridurre le sottocard senza nota/valutazione. La r3 aggiunge una griglia settimanale completa in fondo, mai tagliata e senza scroll orizzontale; Q12 conferma se è il riepilogo desiderato.
- Ingresso dal Riepilogo focalizzato sulla storia secondo comportamento MVP; ritorno prevedibile.
- Storia in sola lettura; modifica nella vista Valutazioni. Non confondere note iniziali e note sessione.

**Mock:** storia vuota/completa, nota lunga, valore assente vuoto, ingresso da riepilogo. **Accettazione:** note e sessioni esatte, griglia finale completa, focus/ritorno conservati. **Baseline:** `StudentEvaluationHistory.tsx` e profilo.

## P20 — Dettatura condivisa integrata, nessuna pagina

**Richieste:** STT-001, UX-G04. **Natura:** affidabilità e feedback. **Decisione r1:** P20 non esiste più come vista. Il comportamento vive nei pannelli testo P05/P09/P17.

- Stati distinti nello stesso pannello: richiesta permesso al primo tap Detta (non all'apertura app), asset in caricamento, pronto/registrazione, elaborazione, testo da rivedere, errore recuperabile.
- Comunicare primo download e avanzamento reale disponibile; niente percentuale inventata. Riprova e annullamento con effetto reale.
- Conservare testo già digitato se fallisce la dettatura; trascritto editabile e confermabile; audio scartato.

**Mock:** tutti gli stati sopra dentro le tre superfici ospitanti; nessuna voce P20 nel selettore. **Accettazione:** percorso reale su browser PC, Android e iPhone, fixture audio automatizzate e collaudo fisico finale dell'autore; errori non lasciano la UI bloccata; assenza di audio persistito. **Baseline:** `src/capabilities/speech.ts` e chiamanti.

## 2. Copertura e ordine del design

Tutti gli ID di `05` hanno un posto: UX-G01–07 nelle regole comuni; BRAND-01/02 e ICON-01 in P01; STT-001 in P05/P09/P17 (P20 integrata); OCR-001 in P06; STUD-01–08 in P03/P04/P05; BOAT-01/02 in P07/P08/P09/P15; VOL-01–03 in P10/P14; CMD-01–08 in P11/P12/P13; CREW-01–06 in P14/P15/P16; FAULT-01–04 in P09; EVAL-01–05 in P17 con coerenza P18/P19.

Proposta per la discussione dei mock: prima lingua visiva P01 e card persona P03; poi P11/P12/P13 e P14/P15 come pagine più dense; P17 per sciogliere il vincolo della riga; quindi completare tutte le altre viste. Questa è una sequenza di **design**, non autorizzazione a implementare pagine in parallelo.

## 3. Registro dei mock e dei target

Galleria r3: [apri i mock](mockups/index.html). Revisione umana r2 e registro in [11_MOCK_REVIEW.md](11_MOCK_REVIEW.md); scelte residue in [12](12_R2_REVIEW_QUESTIONS.md). Ogni link seleziona una pagina; misure e dati si cambiano dai controlli esterni alla schermata.

| Pagine | File / revisione                   | Approvazione          |
| ------ | ---------------------------------- | --------------------- |
| P01    | [P01 · r3](mockups/index.html#P01) | DA RIVEDERE           |
| P02    | [P02 · r3](mockups/index.html#P02) | DA RIVEDERE           |
| P03    | [P03 · r3](mockups/index.html#P03) | APPROVATO R2          |
| P04    | [P04 · r3](mockups/index.html#P04) | APERTO Q13            |
| P05    | [P05 · r3](mockups/index.html#P05) | DA RIVEDERE           |
| P06    | [P06 · r3](mockups/index.html#P06) | DA RIVEDERE           |
| P07    | [P07 · r3](mockups/index.html#P07) | DA RIVEDERE           |
| P08    | [P08 · r3](mockups/index.html#P08) | DA RIVEDERE           |
| P09    | [P09 · r3](mockups/index.html#P09) | DA RIVEDERE           |
| P10    | [P10 · r3](mockups/index.html#P10) | APPROVATO R2 + FIX R3 |
| P11    | [P11 · r3](mockups/index.html#P11) | DA RIVEDERE           |
| P12    | [P12 · r3](mockups/index.html#P12) | APPROVATO R2          |
| P13    | [P13 · r3](mockups/index.html#P13) | APERTO Q10            |
| P14    | [P14 · r3](mockups/index.html#P14) | DA RIVEDERE           |
| P15    | [P15 · r3](mockups/index.html#P15) | APERTO Q11            |
| P16    | [P16 · r3](mockups/index.html#P16) | DA RIVEDERE           |
| P17    | [P17 · r3](mockups/index.html#P17) | DA RIVEDERE           |
| P18    | [P18 · r3](mockups/index.html#P18) | DA RIVEDERE           |
| P19    | [P19 · r3](mockups/index.html#P19) | APERTO Q12            |
| P20    | Integrata in P05/P09/P17           | NESSUNA PAGINA        |

La r3 copre la vista principale di ogni brief e le interazioni richieste dalla revisione r2. Stati secondari e varianti sono ancora parziali; non dichiarare completata l'intera matrice dell'harness. Le interazioni sono dimostrative, senza dati dell'app, microfono, fotocamera o persistenza. Approvare file/revisione/viewport e deroghe prima di promuovere una pagina a target.
