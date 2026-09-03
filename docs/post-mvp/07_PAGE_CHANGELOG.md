# 07 — Changelist per pagina e brief dei mock

**Stato:** risposte del 4 settembre recepite; prima galleria C disponibile con 20 viste principali. I mock r1 sono DA RIVEDERE, nessuno è approvato o implementato nell'app. Leggere [05](../../05_POST_MVP_UX_CHANGE_REQUESTS.md), [regole](06_DESIGN_RULEBOOK.md) e [decisioni riviste](08_QUESTIONS.md).

Le pagine includono viste, form e pannelli rilevanti anche quando oggi condividono lo stesso componente. Si possono raggruppare per discussione, ma vanno verificate singolarmente. Le note sull'attuale app derivano da lettura del codice e del registro M15, non da una nuova ispezione browser.

## 1. Regole comuni del confronto

Applicare R01–R15 a tutte le pagine. Ogni target avrà: revisione, richieste coperte, viewport/dati, stato iniziale, azione principale, risultato visibile, eccezioni, approvazione. Le prove useranno la stessa fixture prima/dopo; i numeri di densità vanno misurati, non inventati.

Il set minimo di stati è: vuoto, normale, contenuto lungo/affollato, selezione quando prevista, salvataggio/errore quando previsto. Per viste dense aggiungere minori, omonimi, warning e disabilitati. Nessun test nuovo solo per verificare che una classe CSS sia stata rinominata.

## P01 — Home e navigazione comune

**Richieste:** BRAND-01/02, UX-G03/05; R02/R12/R13. **Natura:** grafica. **Dipendenza:** Q08 per branding definitivo.

- Header compatto con identità corso e marchio; ridurre spazio ornamentale, mantenendo riconoscibilità della Home.
- Conservare le sei destinazioni Allievi, Barche, Comandate, Equipaggi, Valutazioni, Volontari e Impostazioni separato.
- Navigazione persistente esattamente Avarie / Home / Equipaggi, Home centrale. Nessun nuovo dashboard widget.
- Proporre un set minimo coerente di icone esistenti prima di ICON-01.

**Mock:** Home con corso, titolo lungo, viewport stretto; shell con pagina scorsa e safe area. **Accettazione:** tutti gli ingressi trovabili, testo leggibile e nessuna copertura dell'ultima riga; back/focus coerenti. **Baseline da acquisire:** `src/App.tsx`, `src/styles.css`.

## P02 — Creazione corso e Impostazioni

**Richieste:** UX-G02/03, BRAND-01. **Natura:** coerenza visiva, nessuna nuova funzione.

- Riutilizzare tipografia/header/controlli definiti in P01.
- Mantenere famiglia, livello, etichetta e date derivate secondo `01`; non aggiungere archivio o conclusione corso.
- Impostazioni mantiene i controlli esistenti; eventuale versione visibile è facoltativa e non richiede una nuova pagina.

**Mock:** primo avvio, form selezionato/errore, Impostazioni. **Accettazione:** creazione e riapertura non regrediscono; tastiera e focus non coperti. **Baseline:** `src/App.tsx`.

## P03 — Elenco Allievi

**Richieste:** STUD-05/06/07/08, UX-G01/03/04/05. **Natura:** grafica + tie-break ordinamento.

- Due colonne come prima proposta; card con nome identificabile, età, indicatore sesso e M minore. Dati personali di dettaglio non entrano nella lista.
- Ridurre l'icona generica; evitare tre M ambigue per sesso/taglia/minore. Disabilitati ancora visibili e distinguibili.
- Aggiungi persistente, preferibilmente nell'header sticky prima di introdurre un FAB separato. Menu secondario mantiene Scan e Conoscenza.
- Ordinamento già in parte presente: attivi prima, cognome; proposta conservare questo raggruppamento e usare nome visualizzato come tie-break. Selettore avanzato fuori dal nucleo.

**Mock:** zero, 21/23 persone, omonimi, nome lungo, minorenne, disabilitato, scroll con Aggiungi. **Accettazione:** lista più densa sulla stessa fixture, nessuna identità troncata in modo ambiguo, tap apre profilo; Conoscenza disabilitata a zero. **Baseline:** `src/features/students/StudentManagement.tsx`, `src/persistence/students.ts`.

## P04 — Profilo, aggiunta e modifica allievo

**Richieste:** STUD-01/02/03/04, UX-G06. **Natura:** funzionale e integrità dati. **Decisione:** Q09 accettata; autosave e form focalizzato.

- Stesso form con anagrafica, nickname, sesso, telefono, taglia e nota iniziale. Sezioni compatte; campo in sola lettura prima di Modifica ammesso.
- Percorso esplicito Modifica; scorciatoia desktop/long press nel profilo sul campo. Prima proposta: apre il form e focalizza il campo; inline soltanto se semplice e coerente.
- Mostrare Salvataggio/Salvato/errore senza popup per ogni edit. Creazione resta confermata esplicitamente; i record esistenti possono usare il contratto autosave Q09.
- Eliminazione in zona secondaria distinta dalla disattivazione. Mostrare nome dell'allievo, conseguenza e conferma. Se usato, spiegare i legami effettivi con giorni/sessioni; niente cancellazioni a cascata.
- Nota iniziale distinta dalla nota di settimana e dalle note valutazione. Nessuna nuova funzione nota settimana se non già presente/approvata.

**Mock:** lettura, form, campo focalizzato, errore salvataggio, eliminazione permessa/conferma, eliminazione bloccata con ragioni. **Accettazione:** modifica taglia/nota visibile anche in Conoscenza dopo reload; tutti i tipi di referenza impediscono delete, disattivazione disponibile; note proprie senza referenze non vengono arbitrariamente trattate come uso operativo. **Baseline:** gestione e persistenza studenti; checker invarianti.

## P05 — Conoscenza allievi

**Richieste:** UX-G01/02/03, STUD-01/02; STT-001 per la dettatura. **Natura:** layout/controlli e coerenza dati.

- Taglie XS/S/M/L/XL direttamente selezionabili, controllo compatto senza riempire inutilmente la card.
- Nome, taglia e preview nota insieme; testo lungo espandibile. Ridurre card/header mantenendo la nota facilmente editabile.
- Condividere salvataggio e valori con il profilo; nessuna copia separata della nota.

**Mock:** taglia mancante/selezionata, nota breve/lunga, dettatura, errore. **Accettazione:** un tap cambia taglia, testo persistito e condiviso con P04; nessun allievo perso durante navigazione rapida. **Baseline:** `src/features/students/StudentKnowledge.tsx`.

## P06 — Scan allievi: acquisizione e revisione

**Richieste:** OCR-001, UX-G02/04. **Natura:** affidabilità, non solo restyling. **Decisione:** metrica per campo/persona Q06, obiettivo vicino al 90% su casi tipici; nessun confronto cronometrato col manuale.

- Flusso candidato: inquadratura guidata di nome/cognome/nascita → crop/rotazione se necessari → elaborazione → revisione campi → conferma inserimento.
- Indicare difficoltà recuperabile, proporre altra foto quando utile; non simulare un risultato affidabile se quasi tutte le righe sono inutili.
- Revisione compatta con campi incerti distinguibili, correzione/rimozione riga, conteggio di ciò che sarà aggiunto. Nessun auto-commit.
- Personale non deve diventare allievo. Creazione separata volontari non è inclusa senza scelta esplicita.

**Mock:** acquisizione, orientamento/crop, elaborazione, rifiuto, parziali, revisione, conferma. **Accettazione:** corpus anonimo con verità attesa, recupero campi e associazione alla persona misurati, nessuna metrica di tempo rispetto al manuale, no righe false salvate. **Baseline:** `StudentScan.tsx`, `src/capabilities/studentScan.ts` e fixture M4.

## P07 — Configura/Aggiungi barche

**Richieste:** BOAT-01, UX-G02/03. **Natura:** parser + form.

- Campo numeri con hint breve “2 3 7, 8; 11”; accetta virgola/spazi/newline/punto e virgola anche ripetuti.
- Default tipo corso invariato e modificabile. Tastiera adeguata senza impedire i formati già supportati; niente picker complesso per l'operazione iniziale rara.
- Preservare filtro vuoti/deduplicazione già presenti; riepilogo delle barche effettivamente create.

**Mock:** zero barche, input multiplo, duplicati/errore. **Accettazione:** equivalenza fra separatori, nessun record vuoto/duplicato, persistenza. **Baseline:** `BoatManagement.tsx`, `src/domain/boat.ts`.

## P08 — Elenco e dettaglio Barca

**Richieste:** BOAT-02, FAULT-02, CREW-06. **Natura:** grafica; Q01 distingue indisponibilità corso e deselezione sessione.

- Identificativo condiviso: numero più evidente, tipo sempre leggibile; disponibilità e guasti distinti.
- Elenco compatto; dettaglio con guasti aperti in evidenza, risolti secondari.
- Separare Elimina inserimento errato, disponibilità corso e selezione uscita della sessione. La nuova azione di scollegamento usa la decisione Q01, non una cascata implicita.

**Mock:** barca sana, più avarie, indisponibile con assegnazione esistente, riattivazione, storico guasti. **Accettazione:** risolvere una sola avaria non dà verde se ne resta un'altra; storico preservato; effetto di indisponibilità conforme a Q01. **Baseline:** `BoatManagement.tsx`.

## P09 — Avarie: elenco, inserimento e stato

**Richieste:** FAULT-01/02/04, BOAT-02; FAULT-03 opzionale, STT-001 per voce. **Natura:** principalmente grafica.

- Card compatta con tipo/numero, preview proposta fino a tre righe e apertura del testo completo. Testare descrizioni che contengono il dettaglio utile alla terza riga.
- Segmento Aperta/Comunicata/Risolta diretto, una riga dedicata se necessaria ai target. Non comprimere tre etichette fino a renderle illeggibili.
- Modifica stato rapida, salvata; ordine/errori coerenti durante tap ripetuti.
- Icona parte guasta opzionale; default neutro e nessuna classificazione automatica che alteri il testo.

**Mock:** nessuna avaria, descrizione lunga, più guasti sulla stessa barca, tutti e tre gli stati, errore/retry, form/dettatura. **Accettazione:** più contenuto utile a parità viewport, testo completo raggiungibile in un tap, cambi stato e disponibilità indipendenti dopo reload. **Baseline:** `FaultManagement.tsx`, `FaultCard.tsx`, `FaultForm.tsx`.

## P10 — Volontari: lista e form

**Richieste:** VOL-01/02/03, UX-G03/04. **Natura:** ruolo dominio + grafica.

- Nome e scelta diretta ADV/IS/CT. Nessun altro ruolo.
- Togliere testo permanente sulle regole allievi; lista compatta con ruolo visibile.
- Stesso lessico e stile del pool Equipaggi; modifica dati già presenti compatibile.

**Mock:** vuoto, tre ruoli, aggiunta/modifica, nome lungo. **Accettazione:** CT salvato/riaperto, imbarcabile, escluso da Comandate/Valutazioni/conteggio allievi. **Baseline:** `VolunteerManagement.tsx`, enum e persistenza volontari.

## P11 — Comandate: settimana e avvisi

**Richieste:** CMD-04/07/08, UX-G01/03/04. **Natura:** layout e visibilità warning. **Decisioni:** Q02/Q04 recepite; duplicati rossi e tre viewport iniziali.

- Mostrare i sette gruppi con nomi, non solo titoli. Prima ipotesi: griglia a due colonne, sette card compatte; confronto possibile con righe compatte senza preapprovare la soluzione.
- M accanto ai minori. Warning su giorno e persona, secondo severità canonica concordata; eventuali warning globali restano distinguibili dai problemi localizzati.
- Tap sul segnale apre le ragioni, Avvisi resta secondario. Segnale rosso persistente e accettazione gialli secondo `01` e Q02 accettata.
- Rotazioni completate riconoscibili; ricalcolo non modifica lo storico.

**Mock:** 21 e 23 allievi, sette giorni, duplicato sabato/mercoledì, disabilitato futuro, warning globale, giorno completato, giorno volutamente sovraffollato/vuoto. **Accettazione:** target viewport concordato; ogni occorrenza del duplicato evidenziata; nessuna nuova rigida limitazione agli override; warning storico non introdotto per sola disattivazione successiva. **Baseline:** `DutyManagement.tsx`, `src/domain/duties.ts`.

## P12 — Proposta/Ricalcola Comandate

**Richieste:** CMD-01/02/03. **Natura:** anteprima + regole deterministiche. **Decisione:** Q03 accettata; “Giorni con meno persone”.

- Conteggio disponibili pertinente alla porzione di settimana da pianificare.
- S D L Ma Me G V, conteggio live sotto ciascun giorno, selezione diretta “Giorni con meno persone”.
- Anteprima graficamente provvisoria, proposta senza rosso semantico. Preferenze ed effetto nello stesso campo visivo; conferma raggiungibile senza attraversare un lungo roster.
- Nessuna modifica delle assegnazioni persistite finché non si conferma. Gli extra vanno prima ai giorni non selezionati, poi ai selezionati, cronologicamente; tutti selezionati equivale a nessuna preferenza. Se N < D mostrare gli zero e consentire correzione manuale.

**Mock:** 23 allievi e sabato con meno persone, più/tutti giorni selezionati, metà settimana con completati, nessuno da assegnare. **Accettazione:** esempi `05` riprodotti; preview e risultato concordano; somma e capacità coerenti; storico e priorità venerdì/minori/sesso preservati. **Baseline:** `DutyManagement.tsx`, funzioni capacità/generazione.

## P13 — Selezione persone Comandata

**Richieste:** CMD-05/06/08, UX-G02/04/05. **Natura:** layout e ordine.

- Due colonne compatte, mai usati prima, già usati in fondo; una volta corretto, più volte warning.
- Già usati restano selezionabili; stato chiaro anche senza colore. Non aggiungere testo con elenco dei giorni per ogni persona.
- Giorno modificato e persone attualmente assegnate riconoscibili durante la scelta.

**Mock:** mai usato/una volta/più volte, minorenne, omonimi, nessuno libero. **Accettazione:** assegnazione ripetuta permessa e warning coerente in P11/P13; ordine non salta in modo da causare un tap involontario durante salvataggio. **Baseline:** sottovista di `DutyManagement.tsx`.

## P14 — Equipaggi: setup, composizione e verifica

**Richieste:** CREW-01/02/03/04/05, VOL-03, UX-G01/03/04/05. **Natura:** interazione e layout. **Decisioni:** Q04 viewport e Q01 barche recepite.

- Header con titolo e sessione affiancati. Setup conserva numero equipaggi distinto da persone/barche; non introduce creazione automatica.
- Workspace con pool allievi e card equipaggi consultabili insieme; prima ipotesi di due colonne, evitando di impilare altri pannelli lunghi.
- Disponibili = mancanti azionabili. Niente dialog mancanti. Contatore tiene conto di allievi in equipaggio **o A terra**; volontari esclusi. Etichetta breve proposta “Collocati 18/21” da confrontare con “Inseriti”.
- Contatore basso-destra sopra navigazione come prima prova, con spazio riservato; alternativa header sticky. Non copre slot o selezione.
- Pool volontari separato, meno prioritario; breve scroll ammesso. A terra sempre distinto da equipaggio. Una destinazione compatta per card; barche in P15.
- Conservare selezione/move/swap, long press profilo, C/SM, taglia, informazioni utili già disponibili e un solo triangolo peggiore per equipaggio. Nessun nuovo indicatore di fascia valutazioni post-MVP implicito.

**Mock:** setup, 21 allievi, selezione, scambio, pool vuoto, A terra, staff CT, gap dopo copia, warning taglia/ripetizione, errore salvataggio, corso a equipaggi flessibili. **Accettazione:** persona compare una volta, pool si aggiorna, contatore corretto, dati per decidere simultanei secondo target; reload conserva sessione e collocazioni. **Baseline:** `CrewManagement.tsx`, dominio/persistenza equipaggi.

## P15 — Barche della sessione e destinazione equipaggio

**Richieste:** CREW-01/06, BOAT-02. **Natura:** pannello grafico e deselezione sessione secondo Q01 accettata.

- Selettore barche in pannello breve contestuale alla sessione, con numero/tipo/stato.
- Rendere distinti barche che escono, associazione esatta all'equipaggio, Mezzi, Non assegnato.
- Deselezionare una barca dall'uscita scollega l'equipaggio nella sola sessione aperta; mantiene persone e altre sessioni. Indisponibilità corso conserva invece l'assegnazione e mostra rosso vicino alla barca; avaria aperta gialla, senza blocco automatico.
- Copia barche precedente resta preview → modifica → conferma, separata dalla copia equipaggi.

**Mock:** barca libera/assegnata/indisponibile/con avaria, cambio destinazione, Mezzi, copia e rimozione assegnazione. **Accettazione:** una barca al massimo per equipaggio simultaneo; persone e storico integri; ritorno al workspace senza perdere selezione/sessione. **Baseline:** `CrewManagement.tsx`, `src/domain/crews.ts`.

## P16 — Lettura/annuncio Equipaggi

**Richieste:** UX-G01/03, BRAND-01; presidio regressione CREW-01. **Natura:** coerenza visiva.

- Nomi grandi e puliti; barca esatta, solo tipo o nessuna barca secondo dati disponibili.
- Nessun pannello decisionale, taglia, telefono o controlli di composizione. Mezzi conserva il suo significato operativo.
- Copia e quick edit restano percorsi secondari coerenti; ritorno alla sessione mantenuto.

**Mock:** Quest 7, solo Quest, nomi senza barca, Mezzi, nomi lunghi. **Accettazione:** leggibile con tre stati di assegnazione e ritorno rapido; nessuna barca richiesta per leggere. Wake lock non entra automaticamente nello scope.

## P17 — Valutazioni: inserimento per Allievi/Equipaggi

**Richieste:** EVAL-01/02/03/04/05. **Natura:** layout e controlli. **Decisione:** Q05 accettata; una riga dove entra, due righe compatte negli altri casi.

- Titolo e sessione affiancati; selettore Allievi/Equipaggi/Riepilogo più basso in altezza; eliminare la frase indicata in EVAL-05.
- Prima esplorazione: riga compatta con nome, valori e nota. Sei valori × 44 px = 264 px; a questi si aggiungono nome, nota e margini. Su viewport stretti non promettere una riga senza prova.
- Variante da confrontare: due righe basse, nome/nota sopra e sei controlli sotto. Evitare di passare automaticamente a voto tramite dialog, perché aggiungerebbe un tap.
- Positivi verdi, negativi rossi, neutro/assenza distinti, selezione visibile. A terra resta presente ed evaluabile; nota legata alla sessione esatta.

**Mock:** due viste, nome lungo, tutti i valori, assenza, A terra, nota, save/error, tastiera. **Accettazione:** un tap per valore nella vista operativa; nessuna perdita di note; stessa valutazione nelle due viste; sessione non si confonde dopo scroll/reload. **Baseline:** `EvaluationManagement.tsx`.

## P18 — Riepilogo Valutazioni

**Richieste:** UX-G01/03; coerenza EVAL-02. **Natura:** compattezza, senza nuovi analytics.

- Nome e sequenza simbolica compatta; conteggio voti reali; ordine alfabetico/valutazione già previsto.
- Note riconoscibili e apribili, nome verso storia allievo. Cronologia invariata e nessuna media numerica visibile.
- Migliorare solo se semplice l'indizio di contenuto orizzontale oltre il bordo. Scroll sincronizzato e ricerca restano backlog separato, non requisiti impliciti.

**Mock:** tredici sessioni, valori mancanti, note, conteggi diversi, nome lungo. **Accettazione:** nessun overflow dell'intera pagina; timeline completa accessibile; media interna e ordinamento invariati. **Baseline:** `EvaluationOverview.tsx`.

## P19 — Storia valutazioni nel profilo

**Richieste:** UX-G03; presidio STUD-02/EVAL-02. **Natura:** coerenza e regressione.

- Storia cronologica leggibile, sessione identificata e note raggiungibili; non forzare una geometria tabellare.
- Ingresso dal Riepilogo focalizzato sulla storia secondo comportamento MVP; ritorno prevedibile.
- Storia in sola lettura; modifica nella vista Valutazioni. Non confondere note iniziali e note sessione.

**Mock:** storia vuota/completa, nota lunga, gap `—`, ingresso da riepilogo. **Accettazione:** note e sessioni esatte, focus/ritorno conservati. **Baseline:** `StudentEvaluationHistory.tsx` e profilo.

## P20 — Dettatura condivisa

**Richieste:** STT-001, UX-G04. **Natura:** affidabilità e feedback. **Decisione:** Q07 richiede browser PC/Android/iPhone e permesso solo al primo tentativo di registrazione.

- Stati distinti: richiesta permesso al primo tap Registra (non all'apertura app), asset in caricamento, pronto/registrazione, elaborazione, testo da rivedere, errore recuperabile.
- Comunicare primo download e avanzamento reale disponibile; niente percentuale inventata. Riprova e annullamento con effetto reale.
- Conservare testo già digitato se fallisce la dettatura; trascritto editabile e confermabile; audio scartato.

**Mock:** tutti gli stati sopra nelle tre superfici ospitanti. **Accettazione:** percorso reale su browser PC, Android e iPhone, fixture audio automatizzate e collaudo fisico finale dell'autore; errori non lasciano la UI bloccata; assenza di audio persistito. **Baseline:** `src/capabilities/speech.ts` e chiamanti.

## 2. Copertura e ordine del design

Tutti gli ID di `05` hanno un posto: UX-G01–07 nelle regole comuni; BRAND-01/02 e ICON-01 in P01; STT-001 in P20/P05/P09/P17; OCR-001 in P06; STUD-01–08 in P03/P04/P05; BOAT-01/02 in P07/P08/P09/P15; VOL-01–03 in P10/P14; CMD-01–08 in P11/P12/P13; CREW-01–06 in P14/P15/P16; FAULT-01–04 in P09; EVAL-01–05 in P17 con coerenza P18/P19.

Proposta per la discussione dei mock: prima lingua visiva P01 e card persona P03; poi P11/P12/P13 e P14/P15 come pagine più dense; P17 per sciogliere il vincolo della riga; quindi completare tutte le altre viste. Questa è una sequenza di **design**, non autorizzazione a implementare pagine in parallelo.

## 3. Registro dei mock e dei target

Prima galleria r1: [apri i mock](mockups/index.html). Revisione umana in [11_MOCK_REVIEW.md](11_MOCK_REVIEW.md). Ogni link seleziona una pagina; misure e dati si cambiano dai controlli esterni alla schermata.

| Pagine | File / revisione                   | Approvazione |
| ------ | ---------------------------------- | ------------ |
| P01    | [P01 · r1](mockups/index.html#P01) | DA RIVEDERE  |
| P02    | [P02 · r1](mockups/index.html#P02) | DA RIVEDERE  |
| P03    | [P03 · r1](mockups/index.html#P03) | DA RIVEDERE  |
| P04    | [P04 · r1](mockups/index.html#P04) | DA RIVEDERE  |
| P05    | [P05 · r1](mockups/index.html#P05) | DA RIVEDERE  |
| P06    | [P06 · r1](mockups/index.html#P06) | DA RIVEDERE  |
| P07    | [P07 · r1](mockups/index.html#P07) | DA RIVEDERE  |
| P08    | [P08 · r1](mockups/index.html#P08) | DA RIVEDERE  |
| P09    | [P09 · r1](mockups/index.html#P09) | DA RIVEDERE  |
| P10    | [P10 · r1](mockups/index.html#P10) | DA RIVEDERE  |
| P11    | [P11 · r1](mockups/index.html#P11) | DA RIVEDERE  |
| P12    | [P12 · r1](mockups/index.html#P12) | DA RIVEDERE  |
| P13    | [P13 · r1](mockups/index.html#P13) | DA RIVEDERE  |
| P14    | [P14 · r1](mockups/index.html#P14) | DA RIVEDERE  |
| P15    | [P15 · r1](mockups/index.html#P15) | DA RIVEDERE  |
| P16    | [P16 · r1](mockups/index.html#P16) | DA RIVEDERE  |
| P17    | [P17 · r1](mockups/index.html#P17) | DA RIVEDERE  |
| P18    | [P18 · r1](mockups/index.html#P18) | DA RIVEDERE  |
| P19    | [P19 · r1](mockups/index.html#P19) | DA RIVEDERE  |
| P20    | [P20 · r1](mockups/index.html#P20) | DA RIVEDERE  |

Questa prima passata copre la vista principale di ogni brief. Stati secondari, dialog e varianti sono parzialmente esplorabili; non dichiarare completati tutti gli stati richiesti dall'harness. Le interazioni sono dimostrative, senza dati dell'app, microfono, fotocamera o persistenza. Approvare file/revisione/viewport e deroghe prima di promuovere una pagina a target.
