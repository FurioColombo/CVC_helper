# Post-MVP — richieste UX e decisioni di design

**Stato:** bozza consolidata per discussione; implementazione non autorizzata da questo documento.

**Baseline prodotto:** 0.1.0, checkpoint MVP `c907b19`.

**Revisione editoriale:** 4 settembre 2026; risposte umane di `08` e revisione pagina per pagina dei mock r1 recepite.

## 1. Come usare questo pacchetto

Questo documento integra annotazioni manuali, risposte già date e richieste originarie. Conserva gli ID esistenti e assegna ID alle aggiunte che ne erano prive. Normalizza la forma senza trasformare suggerimenti ed esempi in decisioni definitive.

| Documento                                                                   | Funzione                                                   | Stato                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------- |
| Questo `05`                                                                 | Richieste, decisioni, provenienza e conflitti              | Consolidato, da rivedere insieme |
| [06 — Regole di design](docs/post-mvp/06_DESIGN_RULEBOOK.md)                | Principi da applicare a ogni pagina                        | Proposta verificabile            |
| [07 — Changelist per pagina](docs/post-mvp/07_PAGE_CHANGELOG.md)            | Cambiamenti, stati da disegnare e accettazione             | Bozza avanzata                   |
| [08 — Decisioni della revisione](docs/post-mvp/08_QUESTIONS.md)             | Risposte consolidate e pochi punti visuali residui         | Recepito il 4 settembre          |
| [09 — Guida implementativa](docs/post-mvp/09_IMPLEMENTATION_GUIDE.md)       | Futuro equivalente di `04`, milestone e prove              | Non attiva                       |
| [10 — Specifiche e versioni](docs/post-mvp/10_SPEC_UPDATES_AND_RELEASES.md) | Piano per `01`–`03`, raccordo `AGENTS`/`04`, versionamento | Non applicato                    |

Le risposte in `08` chiariscono Barche, Comandate, densità, Valutazioni, OCR e autosave. La revisione r1 ha prodotto la galleria r2 con 19 viste: la dettatura non è più una pagina autonoma e vive nei pannelli nota/avaria. Nessun target è ancora approvato. `09` resta non attivo finché design e avvio implementativo non sono concordati.

`01`–`04`, codice, test, configurazione e dati applicativi restano invariati. `04` conserva il registro dell'MVP concluso; `05` non sovrascrive implicitamente le specifiche vigenti.

### Provenienza

La [copia originale con tutte le annotazioni](docs/post-mvp/sources/05_original_with_comments.txt) è conservata integralmente, inclusi esempi, marcatori `!!!!`, risposte A/Q e sezione finale Valutazioni. Serve al controllo editoriale, non è una seconda specifica da seguire. SHA-256: `7716611B7B7086E572D3E36925C760770C2BB221A352FC303995B8B6B149F8ED`.

Fotografie e screenshot originali non fanno parte della copia. Le future fixture devono essere sintetiche o anonimizzate secondo una decisione esplicita; non copiare automaticamente immagini personali nel repository.

### Legenda

- **DECISO:** indicazione esplicita nelle annotazioni/risposte; intento post-MVP, non autorizzazione a scrivere codice.
- **MOCK DA RIVEDERE:** obiettivo chiaro, forma/interazione r2 da verificare.
- **APERTO:** decisione di prodotto necessaria.
- **OPZIONALE:** fuori dal nucleo del ciclo salvo inclusione successiva.
- **SEGNALATO:** osservazione umana da riprodurre sulla baseline.

Classi originali: `MVP_DEFECT`, `POST_MVP_QOL`, `NICE_TO_HAVE`, `OPEN`. Priorità originali conservate: P0 = impatto critico dichiarato; P1 = alto impatto operativo; P2 = importante; P3 = rifinitura. Non sono una promessa d'ordine: si controllano prima stato attuale, impatto e dipendenze.

## 2. Principi trasversali

| ID     | Classe / priorità originaria | Requisito consolidato                                                                                                                                      | Stato                   |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| UX-G01 | POST_MVP_QOL / P1            | Informazioni della stessa decisione visibili insieme. Ridurre scroll e passaggi; dettaglio secondario raggiungibile con un tap.                            | DECISO                  |
| UX-G02 | POST_MVP_QOL / P1            | Poche opzioni: selezioni dirette, prima di tutto taglia XS–XL compatta. Proporre altri casi utili.                                                         | DECISO                  |
| UX-G03 | POST_MVP_QOL / P1            | Ridurre header, padding, testo ridondante, card e icone sproporzionate. Considerarlo insieme a UX-G01 per ogni pagina.                                     | DECISO                  |
| UX-G04 | POST_MVP_QOL / P1            | Stato e avvisi su giorno/persona/barca coinvolti. Triangolo della severità corretta; M bianca su rosso per minore; C bianca su blu per comandata corrente. | DECISO; duplicati rossi |
| UX-G05 | POST_MVP_QOL / P2            | Icone piccole e informative: sesso/ruolo, barca, eventuale parte guasta; fallback chiaro. Icone personalizzate in ICON-01.                                 | MOCK DA RIVEDERE        |
| UX-G06 | POST_MVP_QOL / P2            | Modifica esplicita sempre disponibile; doppio click/pressione prolungata come scorciatoie, specialmente sul campo del profilo.                             | DECISO nell'intento     |
| UX-G07 | OPEN / P2                    | Regole riutilizzabili e verificabili, senza teoria fine a sé stessa.                                                                                       | Prima proposta in `06`  |

**Annotazioni integrate:** ogni area (Allievi, Comandate, Barche, Avarie, Equipaggi, Valutazioni) ha un intervento distinto, implementato e verificato **in sequenza**, riutilizzando l'harness. Il design va discusso prima del codice. Densità e disposizione delle informazioni sono un unico problema.

**Compromessi già espressi:** portrait è la modalità di lavoro. Non richiedere di girare il telefono; l'annotazione che ripete “verticale” è interpretata come un'eventuale eccezione landscape solo con beneficio enorme, non come requisito da sviluppare. Quasi zero scroll su un telefono grande tipo iPhone Max è il primo obiettivo; breve scroll accettabile. Conta soprattutto vedere insieme ciò che va confrontato. Due colonne come prima ipotesi; tre solo con beneficio dimostrato e verifica severa. Font secondari moderatamente riducibili; tocco e leggibilità motivati con fonti in `06`.

## 3. Identità visiva

| ID       | Classe / priorità | Richiesta                                                                                                                                                        | Stato                 |
| -------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| BRAND-01 | POST_MVP_QOL / P2 | Palette, blu, logo e tipografia riconoscibili come CVC/Caprera. Font originale se disponibile, altrimenti simile. Identità operativa senza aspetto promozionale. | MOCK DA RIVEDERE, Q08 |
| BRAND-02 | POST_MVP_QOL / P2 | Variante logo: CVC/scuola, eventuale contesto EXE, sottotitolo HELPER o VOLONTARI. Versioni header, PWA e favicon.                                               | APERTO, Q08           |
| ICON-01  | NICE_TO_HAVE / P3 | Co-design coerente di icone barche, equipaggi, Comandate, avarie, persone/ruoli e parti della barca.                                                             | OPZIONALE             |

L'autore desidera logo e stile della scuola nel contesto personale e ristretto dei volontari. Preferenza acquisita; file, font e denominazione da definire. Il blu attuale dell'app non è presentato come blu ufficiale verificato.

## 4. Funzioni di input: difetti segnalati

### STT-001 — Trascrizione reale non affidabile

**MVP_DEFECT / P0 · SEGNALATO.** Nel test umano da browser desktop la registrazione non produceva testo. La diagnosi raccolta riferisce motore funzionante in isolamento, test con risultato simulato, primo download di circa 40–45 MB poco visibile, tentativo fallito potenzialmente bloccato fino al reload ed errori poco distinguibili. Le cause vanno riconfermate; non sono state riprodotte in questa revisione documentale.

**Risultato richiesto:** percorso reale microfono → audio → testo sul telefono target; caricamento comprensibile; Riprova avvia un nuovo tentativo; errori utili per permessi, decodifica, download, memoria/modello e testo vuoto; testo correggibile; audio scartato. Test con media reali o fixture equivalente, più prova fisica del microfono. Non basta verificare il pulsante o simulare il testo.

Superfici: nota iniziale, nota valutazione e avaria. Q07 richiede browser PC, Android e iPhone; permesso al primo tentativo di registrazione, mai al lancio dell'app. Collaudo fisico finale dell'autore, oltre alle prove automatiche. Tempi da misurare: il precedente esempio di 10 secondi non è una soglia approvata.

### OCR-001 — Estrazione non utile su fotografia realistica difficile

**MVP_DEFECT / P1 · SEGNALATO.** Il resoconto riporta 20 allievi, 24 candidati inclusi volontari/personale, zero candidati completi e salvabili, 16 date lette, zero telefoni associati correttamente, zero sessi inferiti, confidenza globale 65/100 e immagine accettata nonostante l'esito inutilizzabile. Rotazione poco risolutiva; problema principale segnalato: associare righe e colonne.

**Risultato richiesto (Q06):** recuperare campi affidabili associati alla persona giusta, rapportati ai campi leggibili nel corpus; mostrare anche mancanti, associazioni errate e falsi candidati. Puntare vicino al 90% nella maggior parte dei casi. Non investire in confronti cronometrati con inserimento manuale. Guidare l'inquadratura su nome, cognome e nascita con rettangolo camera e/o crop/rotazione; telefoni fuori inquadratura non contano come errori di recupero.

**Opzioni di spike:** orientamento/quattro rotazioni controllate, crop e rotazione guidati per isolare allievi, rettifica prospettica, tabella per coordinate, riconoscimento colonne, esclusione/classificazione ADV/IS/AT/CT, idoneità basata sulla coerenza dei record, confronto con altri motori. Nessun nuovo motore selezionato. Fixture sintetica o anonimizzata; revisione umana prima del salvataggio sempre obbligatoria. Q06 conferma revisione di record parziali, esclusione personale e confine locale. Nessuna foto umana originale conservata; solo fixture sintetica o versione completamente anonimizzata concordata.

## 5. Allievi

| ID      | Classe / priorità | Requisito consolidato                                                                                                                                                                                                                                    | Stato                            |
| ------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| STUD-01 | POST_MVP_QOL / P0 | Taglia XS–XL modificabile nello stesso form Modifica del profilo; sola lettura fino all'avvio della modifica ammessa.                                                                                                                                    | DECISO                           |
| STUD-02 | POST_MVP_QOL / P0 | Nota iniziale/conoscenza nello stesso form. Distinta da nota settimana e nota valutazione.                                                                                                                                                               | DECISO                           |
| STUD-03 | POST_MVP_QOL / P2 | Doppio click desktop/pressione prolungata touch per il campo; form focalizzato ammesso se meno costoso. Modifica immediata, senza conferma aggiuntiva per modifiche ordinarie.                                                                           | DECISO; forma nel mock           |
| STUD-04 | POST_MVP_QOL / P0 | Eliminazione definitiva solo se mai usato. Qualunque legame operativo/storico blocca: Comandate, Equipaggi, A terra, valutazioni/note sessione, altre referenze persistite. Spiegare i legami e offrire disattivazione. Conferma esplicita, nessun Undo. | DECISO                           |
| STUD-05 | POST_MVP_QOL / P3 | Cognome come ordinamento iniziale; a parità nome visualizzato. Possibile selettore nome/cognome/età/sesso e direzione ascendente/discendente.                                                                                                            | Base DECISA; selettore OPZIONALE |
| STUD-06 | POST_MVP_QOL / P1 | Lista compatta a due colonne come prima proposta; tre solo se leggibili. Nomi lunghi/duplicati distinguibili, stati preservati.                                                                                                                          | MOCK DA RIVEDERE                 |
| STUD-07 | POST_MVP_QOL / P2 | Icona piccola e informativa per sesso, senza ripetizione nel testo principale; rispettosa e comprensibile senza colore.                                                                                                                                  | MOCK DA RIVEDERE                 |
| STUD-08 | POST_MVP_QOL / P1 | Aggiungi sempre raggiungibile anche dopo scroll; sticky/flottante senza copertura dei contenuti.                                                                                                                                                         | MOCK DA RIVEDERE                 |

**Controllo statico baseline:** taglia/nota presenti nel profilo, assenti dal form anagrafico. Lista a colonna singola. Ordinamento già per attivi, cognome e nome anagrafico: STUD-05 parzialmente presente; tie-break da adeguare. Queste letture non equivalgono a test browser.

## 6. Barche e disponibilità

| ID      | Classe / priorità                            | Requisito consolidato                                                                                               | Stato            |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------- |
| BOAT-01 | POST_MVP_QOL / P2                            | Numeri multipli separati da virgola, spazi, newline o punto e virgola; separatori ripetuti non creano barche vuote. | DECISO           |
| BOAT-02 | POST_MVP_QOL / P2                            | Linguaggio comune Barche/Avarie: tipo, numero, disponibilità, avarie, preview/dettaglio, icone e colori.            | MOCK DA RIVEDERE |
| CREW-06 | Nuovo ID da commento in CREW-01; P1 proposto | Deselezionare dall'uscita della sessione aperta: equipaggio senza barca, persone conservate.                        | DECISO, Q01      |

BOAT-01 è parzialmente presente: parser con virgola, punto e virgola e newline, filtro vuoti/duplicati; mancano spazi interni come separatori. Preservare deduplicazione.

CREW-06 riguarda solo la deselezione dall'uscita della sessione aperta: rimuove la barca dal set uscita e dall'equipaggio interessato, conservando persone e altre sessioni. L'indisponibilità nel corso conserva invece assegnazioni esistenti con warning rosso vicino alla barca; avaria irrisolta gialla. Nessuna cancellazione del record storico è implicita.

## 7. Volontari

| ID     | Classe / priorità | Requisito consolidato                                                                                                 | Stato  |
| ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| VOL-01 | POST_MVP_QOL / P1 | CT = Capoturno/capo del corso. Imbarcabile; escluso da Comandate e Valutazioni allievi. Ruoli richiesti: ADV, IS, CT. | DECISO |
| VOL-02 | POST_MVP_QOL / P2 | Togliere spiegazioni permanenti sulle esclusioni; regole sempre applicate.                                            | DECISO |
| VOL-03 | POST_MVP_QOL / P2 | “Volontari disponibili” al posto di “ADV / IS disponibili” negli Equipaggi.                                           | DECISO |

AT nel foglio OCR è personale da riconoscere/escludere, non un nuovo ruolo richiesto nell'app.

## 8. Comandate

| ID     | Classe / priorità | Requisito consolidato                                                                                                                     | Stato                   |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| CMD-01 | POST_MVP_QOL / P1 | Numero effettivamente disponibile nella proposta, coerente con inizio/metà settimana.                                                     | DECISO                  |
| CMD-02 | POST_MVP_QOL / P2 | S, D, L, Ma, Me, G, V; nome completo accessibile.                                                                                         | DECISO                  |
| CMD-03 | POST_MVP_QOL / P1 | Quota base `floor(N/D)` uguale per ogni giorno; selezione esplicita dei “Giorni con più persone” per distribuire il resto.                 | DECISO, revisione r1/Q03 |
| CMD-04 | POST_MVP_QOL / P1 | Settimana fino a venerdì visibile insieme. Quasi zero scroll sul telefono grande; deroghe misurate sugli altri viewport.                  | MOCK DA RIVEDERE, Q04   |
| CMD-05 | POST_MVP_QOL / P1 | Selettore persone compatto, due colonne come base; tre solo se realmente leggibili.                                                       | MOCK DA RIVEDERE        |
| CMD-06 | POST_MVP_QOL / P1 | Mai usato, una volta = corretto, più volte = warning. Già usati in fondo e sempre selezionabili. Non ripetere i giorni nel selettore.     | DECISO                  |
| CMD-07 | POST_MVP_QOL / P1 | Warning sul giorno e persona; dettaglio breve al tap; Avvisi generale secondario. Distinguere informazione/giallo/rosso.                  | DECISO; duplicati rossi |
| CMD-08 | POST_MVP_QOL / P1 | M bianca in quadrato rosso arrotondato accanto al nome, in lista e card; significato accessibile oltre al colore.                         | DECISO                  |

**Regola aggiornata dopo la revisione r1:** quota base `floor(N/D)` per tutti i giorni, poi `N mod D` persone extra. L'utente sceglie esattamente `N mod D` **Giorni con più persone**; 23/7 con sabato e domenica scelti → `4,4,3,3,3,3,3`. La proposta r2 resta disabilitata finché non è scelto il numero necessario di giorni: questo dettaglio d'interazione va confermato guardando il mock. N < D: quota base zero, il numero di giorni da selezionare coincide con N. Priorità venerdì/stay-over, minori, sesso e tie-break conservate; nessun nuovo solver.

**Decisione Q02:** duplicati rossi su persona e giorni, anche se accettati intenzionalmente; gialli per raccomandazioni. Per la sola anteprima resta la proposta di etichetta/tratteggio, senza usare rosso come stato temporaneo.

## 9. Equipaggi

| ID      | Classe / priorità | Requisito consolidato                                                                                                                                                           | Stato            |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| CREW-01 | POST_MVP_QOL / P1 | Persone disponibili/inserite, equipaggi, destinazioni, warning, volontari e sessione consultabili insieme. Barca compatta; elenco barche candidato a pannello/dialog collegato. | MOCK DA RIVEDERE |
| CREW-02 | POST_MVP_QOL / P1 | Esplorare due/tre colonne senza perdere selezione e stati.                                                                                                                      | MOCK DA RIVEDERE |
| CREW-03 | POST_MVP_QOL / P1 | Selettore sessione accanto al titolo; intestazione piccola, senza lunghi testi.                                                                                                 | DECISO           |
| CREW-04 | POST_MVP_QOL / P1 | Contatore inseriti/totale piccolo, sticky/flottante; preferenza basso-destra da verificare.                                                                                     | MOCK DA RIVEDERE |
| CREW-05 | POST_MVP_QOL / P1 | La lista disponibile rappresenta i mancanti ed è subito azionabile. Niente wall of text e **nessun dialog separato dei mancanti**.                                              | DECISO           |
| CREW-06 | Vedi §6           | Scollegamento barca mantenendo equipaggio.                                                                                                                                      | DECISO, Q01      |

A21 sostituisce il vecchio suggerimento del dialog al tap sul contatore. Proposta: contatore informativo oppure accesso al pool già presente. Volontari preferibilmente separati; breve scroll accettabile perché usati raramente, dialog solo con beneficio dimostrato.

Preservare tap persona → destinazione, tap persona → scambio, long press → profilo, selezione visibile, A terra individuale, Mezzi come destinazione di un vero equipaggio e annunci senza obbligo di barca. STUD-03 riguarda il profilo: non cambia il long press negli Equipaggi.

## 10. Avarie

| ID       | Classe / priorità | Requisito consolidato                                                                                       | Stato            |
| -------- | ----------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| FAULT-01 | POST_MVP_QOL / P1 | Card basse ma preview significativa e relativamente lunga; non nascondere il guasto per guadagnare densità. | MOCK DA RIVEDERE |
| FAULT-02 | POST_MVP_QOL / P2 | Identificativo compatto: tipo/nome piccolo, numero evidente, coerente con Barche.                           | MOCK DA RIVEDERE |
| FAULT-03 | NICE_TO_HAVE / P3 | Eventuale icona randa, scotta, timone, deriva, fiocco/rollafiocco ecc.; testo integro e fallback neutro.    | OPZIONALE        |
| FAULT-04 | POST_MVP_QOL / P2 | Aperta/Comunicata/Risolta compatti con selezione diretta e chiara.                                          | MOCK DA RIVEDERE |

Preview, gerarchia tipo/numero e controllo stato hanno proposte reversibili in `07`; non serve una domanda per ogni dettaglio grafico.

## 11. Valutazioni — annotazione finale integrata

Richieste originariamente senza ID/priorità. Classe proposta POST_MVP_QOL; P1 proposto per EVAL-01/03, P2 per EVAL-02/04/05.

| Nuovo ID | Requisito                                                                                                      | Stato                |
| -------- | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| EVAL-01  | Nome, nota e sei valori sulla stessa riga; icone chiare, `~` per assente, voti diretti e touch target preservati. | DECISO, revisione r1 |
| EVAL-02  | Positivi verdi, negativi rossi; simboli più curati e leggibili, mantenendo ++, +, =, -, -- e assenza.          | DECISO nell'intento  |
| EVAL-03  | Selettore sessione a destra del titolo.                                                                        | DECISO               |
| EVAL-04  | Selettore vista meno alto; non implica spostarlo in fondo alla pagina.                                         | DECISO nell'intento  |
| EVAL-05  | Eliminare “Una valutazione per allievo e sessione”.                                                            | DECISO               |

Colore = segno della valutazione, non nuova severità o etichetta della persona. `—` resta distinto da `=`; medie numeriche invisibili, conteggi reali e note di sessione conservati.

## 12. Risposte già integrate

| Risposte originali           | Collocazione                                                       |
| ---------------------------- | ------------------------------------------------------------------ |
| A1–A5                        | §2 e `06`: densità, portrait, responsività cauta, font/tocco       |
| A6–A8                        | STUD-01/02/03: stesso form, scorciatoia campo, modifica immediata  |
| A9–A10                       | STUD-04: dipendenze, spiegazione, conferma, nessun Undo            |
| A11                          | STUD-05: nome visualizzato a parità di cognome                     |
| A12–A14                      | CMD-02/03: Ma/Me, extra prima, giorni leggeri                      |
| A15–A18 (alcune marcate Q)   | CMD-06/07/08: usi, già usati in fondo, severità, M                 |
| A19–A22 (alcune marcate Q)   | CREW-01/04/05: design, basso-destra, nessun dialog mancanti, staff |
| A23–A25                      | VOL-01: CT imbarcabile, fuori regole allievi, nessun altro ruolo   |
| Domande 26–31 originali      | Q06 in `08`: OCR                                                   |
| Domande 32–34 originali      | Q07 in `08`: voce                                                  |
| Domande 35–38 originali      | Q08 in `08`: identità; icone custom opzionali                      |
| Domande 39–42 senza risposta | Proposte P08/P09 in `07`; FAULT-03 opzionale                       |

## 13. Limiti e prossima revisione

Nessun nuovo test dell'app o prova reale microfono/OCR eseguiti in questa fase. Le misure di scroll riguardano soltanto i mock separati, registrate nella galleria. M15 è prova storica del checkpoint, non verifica della prossima release.

Le decisioni Q01–Q06/Q09 sono recepite; Q07 fissa piattaforme, permessi e collaudo dell'autore, lasciando da misurare i tempi. Q08 fornisce riferimenti ufficiali; nome e logo derivato restano provvisori. Prossimo confronto sui mock: due viewport limite e uno medio, senza resizing aggressivo prematuro.

## 14. Prima galleria di design

[Mock r2 — 19 viste principali](docs/post-mvp/mockups/index.html), separati dall'app. Usare [11 — Revisione mock](docs/post-mvp/11_MOCK_REVIEW.md) per il prossimo giro di commenti. La revisione r1 è recepita; questi disegni non sono ancora target approvati e non attivano 09. La futura possibilità di usare immagini del canale Instagram come sfondo o immagine delle card resta un upgrade grafico separato, soggetto a scelta e diritti sugli asset.
