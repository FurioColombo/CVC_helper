# 07 — Target 0.2.0 e changelist per pagina

**Stato:** FROZEN per l'implementazione 0.2.0. La galleria r10 al commit
`ee8d4c8` è il target approvato per P01–P19; P20 è integrata nei pannelli testo.
Nessuna pagina di questo ciclo è ancora implementata nell'app.

Le pagine includono viste, form e pannelli rilevanti anche quando oggi condividono lo stesso componente. Si possono raggruppare per discussione, ma vanno verificate singolarmente. Le note sull'attuale app derivano da lettura del codice e del registro M15, non da una nuova ispezione browser.

## 1. Regole comuni del confronto

Applicare R01–R15 a tutte le pagine. Ogni prova registra richieste coperte,
viewport/dati, stato iniziale, azione principale, risultato visibile ed eccezioni.
Usare la stessa fixture prima/dopo; i numeri di densità vanno misurati, non
inventati.

Il set minimo di stati è: vuoto, normale, contenuto lungo/affollato, selezione quando prevista, salvataggio/errore quando previsto. Per viste dense aggiungere minori, omonimi, warning e disabilitati. Nessun test nuovo solo per verificare che una classe CSS sia stata rinominata.

## P01 — Home e navigazione comune

**Richieste:** BRAND-01, UX-G03/05; R02/R12/R13. **Natura:** grafica. Il nome
`CVC Helper` e il simbolo corrente sono provvisori utilizzabili; il marchio
derivato finale è rinviato.

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

**Richieste:** STUD-01/02/03/04/09, UX-G06. **Natura:** funzionale e integrità dati. **Decisione:** autosave e form focalizzato.

- La card Valutazioni contiene la griglia settimanale completa già usata in P18/P19, senza cambiare semantica, colori o ordine delle sessioni.

- Stesso form con anagrafica, nickname, telefono, taglia, nota iniziale e accesso alle valutazioni. Sesso come tre pulsanti diretti. La vista principale deve entrare sul 430/412/390 senza scroll inutile.
- Percorso esplicito Modifica; scorciatoia desktop/long press nel profilo sul campo. Prima proposta: apre il form e focalizza il campo; inline soltanto se semplice e coerente.
- Nell'header del profilo usare l'etichetta breve “Modifica”; il contesto rende superfluo “dati”.
- Mostrare Salvataggio/Salvato/errore senza popup per ogni edit. Creazione resta confermata esplicitamente; i record esistenti possono usare il contratto autosave Q09.
- Eliminazione in zona secondaria distinta dalla disattivazione. Mostrare nome dell'allievo, conseguenza e conferma. Se usato, spiegare i legami effettivi con giorni/sessioni; niente cancellazioni a cascata.
- Nota iniziale distinta dalla nota di settimana e dalle note valutazione. “Note recenti” compare solo quando esistono, in peso tipografico regolare; mostra le ultime due, poi “Altre note” apre il resto su richiesta.

**Mock:** lettura, form, campo focalizzato, errore salvataggio, eliminazione permessa/conferma, eliminazione bloccata con ragioni. **Accettazione:** modifica taglia/nota visibile anche in Conoscenza dopo reload; tutti i tipi di referenza impediscono delete, disattivazione disponibile; note proprie senza referenze non vengono arbitrariamente trattate come uso operativo. **Baseline:** gestione e persistenza studenti; checker invarianti.

## P05 — Conoscenza allievi

**Richieste:** UX-G01/02/03, STUD-01/02; STT-001 per la dettatura. **Natura:** layout/controlli e coerenza dati.

- Taglie XS/S/M/L/XL direttamente selezionabili, controllo compatto da 40 px nella r3 e senza sbordo. A 320 px il gruppo passa sotto il nome.
- Dare priorità orizzontale al nome: evitare che vada su due righe nei casi realistici. Taglia e nota restano sulla stessa card.
- “Detta” apre permesso/registrazione/trascrizione nello stesso pannello di modifica testo; nessuna pagina dedicata.
- Condividere salvataggio e valori con il profilo; nessuna copia separata della nota.

**Mock:** taglia mancante/selezionata, nota breve/lunga, dettatura, errore. **Accettazione:** un tap cambia taglia, testo persistito e condiviso con P04; nessun allievo perso durante navigazione rapida. **Baseline:** `src/features/students/StudentKnowledge.tsx`.

## P06 — Scan allievi: acquisizione e revisione

**Richieste:** OCR-001, UX-G02/04. **Natura:** affidabilità, non solo restyling. **Decisione:** metrica per campo/persona, obiettivo vicino al 90% su casi tipici; nessun confronto cronometrato col manuale.

- Flusso r3: Scan allievi → Scegli dalla galleria oppure Fai una foto → fotocamera a schermo intero → rotazione libera e ritaglio → elaborazione → revisione campi → conferma inserimento.
- Indicare difficoltà recuperabile, proporre altra foto quando utile; non simulare un risultato affidabile se quasi tutte le righe sono inutili.
- Revisione compatta con campi incerti distinguibili, correzione/rimozione riga e fascia sticky live: righe da controllare, campi da completare, allievi inseriti. Nessun auto-commit.
- Personale non deve diventare allievo. Creazione separata volontari non è inclusa senza scelta esplicita.

**Mock:** acquisizione, orientamento/crop, elaborazione, rifiuto, parziali, revisione, conferma. **Accettazione:** corpus anonimo con verità attesa, recupero campi e associazione alla persona misurati, nessuna metrica di tempo rispetto al manuale, no righe false salvate. **Baseline:** `StudentScan.tsx`, `src/capabilities/studentScan.ts` e fixture M4.

## P07 — Configura/Aggiungi barche

**Richieste:** BOAT-01, UX-G02/03. **Natura:** parser + form.

- Campo numeri con hint breve “2 3 7, 8; 11”; accetta virgola/spazi/newline/punto e virgola anche ripetuti.
- Default tipo corso invariato e modificabile. Per il ciclo corrente il selettore include RS Quest, RS 500, Laser Vago, RS Toura, J/80, First 25.7 e First 27, coerenti con `01`. Tastiera adeguata senza impedire i formati già supportati.
- Preservare filtro vuoti/deduplicazione già presenti; riepilogo delle barche effettivamente create.
- Mostrare questa configurazione soprattutto al primo inserimento. Gli inserimenti successivi partono dalla lista P08 e aggiungono una barca senza ripresentare la procedura iniziale; se P07 è comunque raggiungibile, mostrare le barche esistenti.

**Mock:** zero barche, input multiplo, duplicati/errore. **Accettazione:** equivalenza fra separatori, nessun record vuoto/duplicato, persistenza. **Baseline:** `BoatManagement.tsx`, `src/domain/boat.ts`.

## P08 — Elenco e dettaglio Barca

**Richieste:** BOAT-02, FAULT-02, CREW-06. **Natura:** grafica; indisponibilità corso e deselezione sessione sono azioni distinte.

- Identificativo condiviso con logo del modello completo quando disponibile e numero subito a destra, senza ripetere il nome in testo; disponibilità e numero avarie distinti. Ogni logo è ritagliato sul proprio disegno e non su una tavola condivisa: `object-fit: contain` deve normalizzare i marchi fra loro, non i margini vuoti. Il riquadro del marchio è misurato in pixel, così al 200 % del testo crescono numero ed etichetta e non la decorazione.
- Il marchio sta sulla scheda senza pastiglia grigia attorno. Un modello senza artwork corretto ricade sulla sigla scritta: l'immagine fornita per First 27 riporta `27.7`, che è un'altra barca, e resta esclusa finché non arriva quella giusta.
- A 320 px il trattamento dell'identità si compatta per lasciare interamente visibili anche i numeri a due cifre (11, 14, 15).
- Rendere “Da controllare” giallo; mantenere “Disponibile” leggibile e senza confonderlo con l'assegnazione verde usata in P15. Dal 2026-09-19 un filo colorato a sinistra porta lo stato anche a colpo d'occhio: blu disponibile — lo stesso blu che in P15 vuol dire disponibile —, ambra da controllare, grigio non disponibile. Icona ed etichetta restano: il colore non è mai da solo.
- Elenco compatto; dettaglio con guasti aperti in evidenza, risolti secondari.
- Separare Elimina inserimento errato, disponibilità corso e selezione uscita della sessione. Lo scollegamento è limitato alla sessione aperta e non produce una cascata implicita.

**Mock:** barca sana, più avarie, indisponibile con assegnazione esistente, riattivazione, storico guasti. **Accettazione:** risolvere una sola avaria non dà verde se ne resta un'altra; storico preservato; effetto di indisponibilità conforme a `01`. **Baseline:** `BoatManagement.tsx`.

## P09 — Avarie: elenco, inserimento e stato

**Richieste:** FAULT-01/02/04, BOAT-02; FAULT-03 opzionale, STT-001 per voce. **Natura:** principalmente grafica.

- Card compatta con tipo/numero, preview proposta fino a tre righe e apertura del testo completo. Testare descrizioni che contengono il dettaglio utile alla terza riga.
- Segmento Aperta/Comunicata/Risolta diretto, una riga dedicata se necessaria ai target. Non comprimere tre etichette fino a renderle illeggibili.
- Modifica stato rapida, salvata; ordine/errori coerenti durante tap ripetuti.
- Icona parte guasta opzionale; default neutro e nessuna classificazione automatica che alteri il testo.
- Riutilizzare logo barca, numero e accento di stato di P08 per dare una gerarchia riconoscibile anche all'elenco avarie; il mapping del mock copre RS 500, Laser Vago, RS Toura, J/80, First 25.7 e First 27 oltre a RS Quest.

**Mock:** nessuna avaria, descrizione lunga, più guasti sulla stessa barca, tutti e tre gli stati, errore/retry, form/dettatura. **Accettazione:** più contenuto utile a parità viewport, testo completo raggiungibile in un tap, cambi stato e disponibilità indipendenti dopo reload. **Baseline:** `FaultManagement.tsx`, `FaultCard.tsx`, `FaultForm.tsx`.

## P10 — Volontari: lista e form

**Richieste:** VOL-01/02/03, UX-G03/04. **Natura:** ruolo dominio + grafica.

- Nome e scelta diretta ADV/IS/CT. Nessun altro ruolo.
- Usare una piccola identità visiva coerente con le persone, senza aggiungere decorazione generica.
- Togliere testo permanente sulle regole allievi; lista compatta con ruolo visibile.
- Stesso lessico e stile del pool Equipaggi; modifica dati già presenti compatibile.

**Mock:** vuoto, tre ruoli, aggiunta/modifica, nome lungo. **Accettazione:** CT salvato/riaperto, imbarcabile, escluso da Comandate/Valutazioni/conteggio allievi. **Baseline:** `VolunteerManagement.tsx`, enum e persistenza volontari.

## P11 — Comandate: settimana e avvisi

**Richieste:** CMD-04/07/08, UX-G01/03/04. **Natura:** layout e visibilità warning. **Decisioni:** duplicati rossi e tre viewport di contratto.

- Mostrare i sette gruppi con nomi, non solo titoli. Prima ipotesi: griglia a due colonne, sette card compatte; confronto possibile con righe compatte senza preapprovare la soluzione.
- M accanto ai minori. Warning su giorno e persona, secondo severità canonica concordata; eventuali warning globali restano distinguibili dai problemi localizzati.
- Tap sul segnale apre le ragioni, Avvisi resta secondario. Segnale rosso persistente e accettazione gialli secondo `01`.
- Rotazioni completate riconoscibili; ricalcolo non modifica lo storico.
- Un feedback sticky mostra persone uniche assegnate/totale: neutro quando uguali, giallo quando manca qualcuno. Una riga separa il nome del giorno dai nomi.
- Le card sulla stessa riga allineano titolo e contenuto in alto anche con quantità diverse di nomi; la card più corta non centra verticalmente il proprio contenuto.

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

- Il tap sulla card di un giorno in P11 apre direttamente P13, senza popup intermedio. Il giorno scelto rimane titolo e contesto della modifica; non aggiungere un bannerino informativo sopra la lista.
- Ordine fisso: persone nel giorno corrente, “Mai assegnati”, “Assegnati ad altri giorni”. La griglia mostra due allievi per riga; ogni card mantiene nome, giorni e rimozioni associati. Toccando il nome nelle ultime due sezioni si assegna la persona anche al giorno corrente.
- Il bottone nome deve essere evidente dalla superficie cliccabile e mostrare soltanto il nome, senza ripetere “Assegna a/anche a [giorno]”. La card resta una superficie neutra di lista raggruppata con divisori tenui: un `+` blu discreto rende l'assegnazione riconoscibile, senza pulsante blu pieno. A 320 px il `+` passa a testo blu con sottile inset blu per preservare lo spazio del nome. Il giorno corrente resta già nel titolo della pagina e delle sezioni; non compare un bannerino introduttivo.
- Nelle card i giorni sono abbreviati in Lun/Mar/Mer/Gio/Ven/Sab/Dom; il nome completo resta nel titolo e nelle etichette accessibili. In caso di doppia assegnazione la card può occupare entrambe le colonne, il warning usa un'icona vettoriale e mostra tutti i giorni coinvolti in forma breve, per esempio “Sab, Mer”. Una X rossa compatta rimuove la persona dal giorno indicato.
- Già usati restano selezionabili; una volta è corretto, più volte produce warning e dettaglio. Aggiunta e rimozione restano reversibili senza gesto nascosto.

**Mock:** giorno aperto direttamente da P11, mai usato/una volta/più volte, rimozione verso mai assegnati, minorenne, omonimi, nessuno libero. **Accettazione:** assegnazione ripetuta permessa e warning coerente in P11/P13; tap sul testo del giorno non modifica dati; ordine non salta in modo da causare un tap involontario durante salvataggio. **Baseline:** sottovista di `DutyManagement.tsx`.

## P14 — Equipaggi: setup, composizione e verifica

**Richieste:** CREW-01/02/03/04/05/07/09, VOL-03, UX-G01/03/04/05/06. **Natura:** interazione e layout. **Decisioni:** viewport e semantica barche definite in `01`.

- Il popup semplificato di destinazione elenca le barche per numero crescente e usa la stessa legenda di P15: grigio non disponibile, verde assegnata, blu disponibile non assegnata.

- Header con titolo e sessione affiancati. Setup conserva numero equipaggi distinto da persone/barche; non introduce creazione automatica.
- Workspace con pool allievi e card equipaggi consultabili insieme. Ogni equipaggio è una card larga su tre righe: destinazione reale o “Senza barca”, numero equipaggio separato, primo e secondo membro; così nomi lunghi, numero barca e numero equipaggio non competono fra loro. Non ripetere l'etichetta generica “Destinazione”.
- Disponibili = mancanti azionabili. Niente dialog mancanti. Contatore tiene conto di allievi in equipaggio **o A terra**; volontari esclusi. Etichetta breve proposta “Collocati 18/21” da confrontare con “Inseriti”.
- `A terra` e `Volontari` restano flottanti rispettivamente in basso a sinistra e destra, con contatore fra loro; non coprono slot o navigazione.
- Pool volontari separato, meno prioritario; breve scroll ammesso. A terra sempre distinto da equipaggio. Una destinazione compatta per card; barche in P15.
- Toccando la barca/destinazione si apre il selettore di destinazione; toccando il triangolo si leggono tutte le ragioni. Conservare selezione/move/swap, long press profilo, C/SM e taglia.
- Doppio click desktop o doppio tap touch su un allievo già inserito lo riporta fra i Disponibili e lascia lo slot libero. L'implementazione offre anche un comando esplicito equivalente e accessibile.
- Il warning equipaggio è distinto da quello barca: la r3 mostra due XL insieme anche su una barca disponibile. “Altre azioni” usa tre puntini; il selettore sessione è un controllo piatto e contestuale.

**Mock:** setup, 21 allievi, selezione, scambio, pool vuoto, A terra, staff CT, gap dopo copia, warning taglia/ripetizione, errore salvataggio, corso a equipaggi flessibili. **Accettazione:** persona compare una volta, pool si aggiorna, contatore corretto, dati per decidere simultanei secondo target; reload conserva sessione e collocazioni. **Baseline:** `CrewManagement.tsx`, dominio/persistenza equipaggi.

## P15 — Barche della sessione e destinazione equipaggio

**Richieste:** CREW-01/06/08, BOAT-02. **Natura:** pannello grafico, associazione equipaggio–barca e deselezione della sola sessione aperta.

- Selettore barche sticky in una fascia breve contestuale alla sessione, su due righe e senza scroll orizzontale. Ogni controllo mostra logo/modello sopra e numero sotto, inclusi i numeri a due cifre.
- Le card riepilogo equipaggio riducono lo spazio sotto i nomi e usano lo stesso logo della barca invece di ripetere “Quest” in testo.
- Rendere distinti barche che escono, associazione esatta all'equipaggio, Mezzi, Non assegnato. Le card barca hanno tre stati con legenda: grigio = non disponibile, verde = assegnata, blu = disponibile non assegnata.
- Per assegnare una barca: selezionare un equipaggio senza barca, poi una card blu. La card diventa verde, il riepilogo equipaggio mostra la barca e l'associazione viene persistita per la sessione aperta.
- Deselezionare una barca dall'uscita scollega l'equipaggio nella sola sessione aperta; mantiene persone e altre sessioni. Indisponibilità corso conserva invece l'assegnazione e mostra rosso vicino alla barca; avaria aperta gialla, senza blocco automatico.
- Copia barche precedente resta preview → modifica → conferma, separata dalla copia equipaggi.

**Mock:** barca libera/assegnata/indisponibile/con avaria, cambio destinazione, Mezzi, copia e rimozione assegnazione. **Accettazione:** una barca al massimo per equipaggio simultaneo; persone e storico integri; ritorno al workspace senza perdere selezione/sessione. **Baseline:** `CrewManagement.tsx`, `src/domain/crews.ts`.

## P16 — Lettura/annuncio Equipaggi

**Richieste:** UX-G01/03, BRAND-01, CREW-10; presidio regressione CREW-01. **Natura:** coerenza visiva.

- Il logo/modello della barca è leggermente più grande e riconoscibile, mantenendo invariate altezza compatta e separazione fra numero equipaggio, barca e persone; usare le tavole normalizzate del mock come riferimento ottico.

- Ogni card ha tre campi distinti: numero equipaggio, logo modello + numero barca o “Senza barca”, persone. Nomi grandi e puliti; card basse.
- Nessun pannello decisionale, taglia, telefono o controlli di composizione. Mezzi conserva il suo significato operativo.
- Copia e quick edit restano percorsi secondari coerenti; ritorno alla sessione mantenuto.

**Mock:** Quest 7, solo Quest, nomi senza barca, Mezzi, nomi lunghi. **Accettazione:** leggibile con tre stati di assegnazione e ritorno rapido; nessuna barca richiesta per leggere. Wake lock non entra automaticamente nello scope.

## P17 — Valutazioni: inserimento per Allievi/Equipaggi

**Richieste:** EVAL-01/02/03/04/05/07. **Natura:** layout e controlli. **Decisione r8:** nome e cinque icone sulla stessa riga; nessun sesto valore per l'assenza.

- Tutti i valori usano icone SVG dedicate; anche i doppi segni condividono la stessa linea di base e non dipendono dai caratteri tipografici `+`, `-`, `=`.

- Titolo e sessione affiancati; selettore Allievi/Equipaggi/Riepilogo più basso in altezza; eliminare la frase indicata in EVAL-05.
- Nome e ++, +, =, -, -- condividono una sola riga. Il nome è un bottone che apre la nota; sullo schermo stress può essere abbreviato visivamente, mantenendo nome completo nell'etichetta accessibile. Icone con area di tocco da 40 px al posto dei caratteri grezzi.
- Nessuna selezione è il default; toccare di nuovo il valore selezionato annulla il voto. Nessun pulsante `~`.
- Positivi verdi, negativi rossi, neutro distinto e assenza vuota nei riepiloghi. A terra resta presente e valutabile; nota legata alla sessione esatta.
- Sotto la riga compare la nota stessa, non la scritta “Nota presente”: due righe con i puntini di sospensione del browser, testo intero nel DOM per lettori di schermo e ricerca. Lo stato di salvataggio conserva la sua area `aria-live`, così una nota non viene mai annunciata come esito di salvataggio.

**Mock:** due viste, nome lungo, tutti i valori, assenza, A terra, nota, save/error, tastiera. **Accettazione:** un tap per valore nella vista operativa; nessuna perdita di note; stessa valutazione nelle due viste; sessione non si confonde dopo scroll/reload. **Baseline:** `EvaluationManagement.tsx`.

## P18 — Riepilogo Valutazioni

**Richieste:** UX-G01/03; coerenza EVAL-02/06/08. **Natura:** compattezza, senza nuovi analytics.

- Ridurre la riga intestazione/nome di ogni allievo fino a 40 px, mantenendo intero il nome e l'area attiva.

- Una card per persona con griglia settimanale allineata: sette colonne giorno e due celle AM/PM, colori coerenti e simboli leggibili. Valori mancanti sono celle vuote, non `~`. Conteggio voti reali e ordine alfabetico/valutazione restano previsti.
- Mostrare la piccola etichetta “Ordinamento” sopra Alfabetico/Valutazione. Ridurre l'altezza visiva dei due bottoni mantenendo 40 px di area attiva.
- Note riconoscibili e apribili, nome verso storia allievo. Cronologia invariata e nessuna media numerica visibile.
- Nessuno scroll orizzontale: la settimana completa deve entrare nella larghezza disponibile. La lista può scorrere verticalmente.

**Mock:** tredici sessioni, valori mancanti, note, conteggi diversi, nome lungo. **Accettazione:** nessun overflow dell'intera pagina; timeline completa accessibile; media interna e ordinamento invariati. **Baseline:** `EvaluationOverview.tsx`.

## P19 — Storia valutazioni nel profilo

**Richieste:** UX-G03; presidio STUD-02/EVAL-02. **Natura:** coerenza e regressione.

- Raggruppare gerarchicamente per giorno; dentro ogni giorno mostrare sottocard AM e PM con voto e nota.
- Il nome completo dell'allievo è il titolo principale, con “Storia del corso” secondario; questo contesto resta sticky durante lo scroll.
- La griglia settimanale completa di P18 è in alto, non sticky, mai tagliata e senza scroll orizzontale.
- Ridurre leggermente le card giorno/sessione e in particolare quelle senza nota o valutazione.
- Ingresso dal Riepilogo focalizzato sulla storia secondo comportamento MVP; ritorno prevedibile.
- Storia in sola lettura; modifica nella vista Valutazioni. Non confondere note iniziali e note sessione.

**Mock:** storia vuota/completa, nota lunga, valore assente vuoto, ingresso da riepilogo. **Accettazione:** note e sessioni esatte, griglia iniziale completa, soggetto sticky e focus/ritorno conservati. **Baseline:** `StudentEvaluationHistory.tsx` e profilo.

## P20 — Dettatura condivisa integrata, nessuna pagina

**Richieste:** STT-001, UX-G04. **Natura:** affidabilità e feedback. **Decisione r1:** P20 non esiste più come vista. Il comportamento vive nei pannelli testo P05/P09/P17.

- Stati distinti nello stesso pannello: richiesta permesso al primo tap Detta (non all'apertura app), asset in caricamento, pronto/registrazione, elaborazione, testo da rivedere, errore recuperabile.
- Comunicare primo download e avanzamento reale disponibile; niente percentuale inventata. Riprova e annullamento con effetto reale.
- Conservare testo già digitato se fallisce la dettatura; trascritto editabile e confermabile; audio scartato.
- Dal 2026-09-19 il comportamento non vive più solo in P05/P09/P17: ogni campo nota dell'app lo espone, comprese le due note della scheda allievo e la descrizione di un'avaria già aperta. Un solo `DictationTrigger`, un solo `DictationPanels` e un `DictatedNoteField` per le note etichettate, invece di una copia per schermata. Il salvataggio resta bloccato finché una trascrizione non è accettata o scartata.

**Mock:** tutti gli stati sopra dentro le tre superfici ospitanti; nessuna voce P20 nel selettore. **Accettazione:** percorso reale su browser PC, Android e iPhone, fixture audio automatizzate e collaudo fisico finale dell'autore; errori non lasciano la UI bloccata; assenza di audio persistito. **Baseline:** `src/capabilities/speech.ts` e chiamanti.

## 2. Copertura e ordine del design

Tutti gli ID di `05` hanno un posto: UX-G01–07 nelle regole comuni; BRAND-01/02 e ICON-01 in P01; STT-001 in P05/P09/P17 (P20 integrata); OCR-001 in P06; STUD-01–09 in P03/P04/P05; BOAT-01/02 in P07/P08/P09/P15; VOL-01–03 in P10/P14; CMD-01–08 in P11/P12/P13; CREW-01–10 in P14/P15/P16; FAULT-01–04 in P09; EVAL-01–08 in P17/P18 con coerenza P04/P19.

Proposta per la discussione dei mock: prima lingua visiva P01 e card persona P03; poi P11/P12/P13 e P14/P15 come pagine più dense; P17 per sciogliere il vincolo della riga; quindi completare tutte le altre viste. Questa è una sequenza di **design**, non autorizzazione a implementare pagine in parallelo.

## 3. Registro dei mock e dei target

Galleria r10 congelata: [apri i mock](mockups/index.html). Ogni link seleziona una
pagina; misure e dati si cambiano dai controlli esterni alla schermata. L'evidenza
di implementazione deve registrare target commit `ee8d4c8`, viewport e differenze
intenzionali.

| Pagine | Target                                   | Stato 0.2.0                 |
| ------ | ---------------------------------------- | --------------------------- |
| P01    | [P01 · r10](mockups/index.html?r=10#P01) | FROZEN                      |
| P02    | [P02 · r10](mockups/index.html?r=10#P02) | FROZEN                      |
| P03    | [P03 · r10](mockups/index.html?r=10#P03) | FROZEN                      |
| P04    | [P04 · r10](mockups/index.html?r=10#P04) | FROZEN                      |
| P05    | [P05 · r10](mockups/index.html?r=10#P05) | FROZEN                      |
| P06    | [P06 · r10](mockups/index.html?r=10#P06) | FROZEN                      |
| P07    | [P07 · r10](mockups/index.html?r=10#P07) | FROZEN                      |
| P08    | [P08 · r10](mockups/index.html?r=10#P08) | FROZEN; stress fix included |
| P09    | [P09 · r10](mockups/index.html?r=10#P09) | FROZEN                      |
| P10    | [P10 · r10](mockups/index.html?r=10#P10) | FROZEN                      |
| P11    | [P11 · r10](mockups/index.html?r=10#P11) | FROZEN                      |
| P12    | [P12 · r10](mockups/index.html?r=10#P12) | FROZEN                      |
| P13    | [P13 · r10](mockups/index.html?r=10#P13) | FROZEN                      |
| P14    | [P14 · r10](mockups/index.html?r=10#P14) | FROZEN                      |
| P15    | [P15 · r10](mockups/index.html?r=10#P15) | FROZEN                      |
| P16    | [P16 · r10](mockups/index.html?r=10#P16) | FROZEN                      |
| P17    | [P17 · r10](mockups/index.html?r=10#P17) | FROZEN                      |
| P18    | [P18 · r10](mockups/index.html?r=10#P18) | FROZEN                      |
| P19    | [P19 · r10](mockups/index.html?r=10#P19) | FROZEN                      |
| P20    | Integrated in P05/P09/P17                | NO SEPARATE PAGE            |

La r10 copre la vista principale e le interazioni decise per ogni brief. Stati
secondari e varianti sono specificati nei paragrafi `Mock`/`Accettazione` e vanno
realizzati e provati nell'app. Le interazioni del prototipo sono dimostrative,
senza dati reali, microfono, fotocamera o persistenza; il target congelato non
costituisce prova di implementazione.
