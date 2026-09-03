# 09 — Piano e harness del ciclo post-MVP UX

**Stato: NON ATTIVO.** Documento preparatorio equivalente a `04` per il prossimo ciclo. Non eseguire milestone, cambiare codice o aggiornare automaticamente le specifiche sulla sola base di questa bozza. Tutte le milestone sotto sono proposte; nessuna è iniziata.

**Baseline:** prodotto chiamato 0.1.0 dall'autore; commit `c907b19`. `04` registra M15 COMPLETE, con 235 test unit/domain/component e 45 browser journey, uno skip intenzionale; sono risultati storici, non un run attuale. Il pacchetto dichiara ancora 0.0.0: allineamento futuro in [10](10_SPEC_UPDATES_AND_RELEASES.md).

## 1. Attivazione del piano

Prerequisiti prima del codice:

1. Chiudere le domande che influenzano la milestone, mantenendo espliciti i rinvii. Q06/Q07 non impediscono il design delle altre pagine.
2. Approvare regole comuni e perimetro del ciclo; completare i target interessati in `07`, con file e revisione precisi.
3. Applicare gli aggiornamenti autorevoli pianificati in `10` e il raccordo `AGENTS`/`04`. Le decisioni nuove non devono restare in contraddizione con `01`.
4. Registrare baseline verificata e dati di prova compatibili con 0.1.0. Se un difetto segnalato è già risolto, documentarlo con prova ripetibile e non riscrivere la funzione.
5. Abilitare il nuovo registro milestone nell'harness esistente, senza riaprire o riscrivere i completamenti MVP.

La fase di design precede l'implementazione. Dopo l'avvio, ogni pagina segue target → implementazione → prove → review → checkpoint, **in sequenza**, come richiesto nelle annotazioni UX-G01. Non implementare contemporaneamente più aree.

## 2. Adeguamento minimo dell'harness esistente

La base già comprende lint, Prettier, TypeScript, Vitest/RTL, Playwright, build PWA, invarianti, scenario settimanale, CI, manifest ed evidenze. Riutilizzarla, evitando un secondo framework.

| Punto osservato                                                       | Adeguamento futuro strettamente utile                                                                                                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/milestone.mjs` scrive solo `04_IMPLEMENTATION_PLAN.md`       | Aggiungere al manifest una destinazione piano per le nuove milestone, con default `04` per le vecchie; aggiornare solo la sezione del piano indicata.            |
| Manifest `.milestones/manifest.json` con M0–M15/G1–G5 completi        | Appendere nuovi ID U00…UG1 dopo approvazione, con stato PENDING ed evidenze richieste. Non usare gli ID nel controller prima dell'adeguamento.                   |
| `record-verification.mjs` usa `verify:all` solo per M15               | Dichiarare controlli per categoria/milestone, assicurando `verify:all` al nuovo gate finale. Evitare una copia dello script per pagina.                          |
| Controller verifica presenza file e PASS, non il contenuto dei report | Per nuovi report verificare almeno verdetto e zero blocker, o richiedere riepilogo strutturato minimo; file esistente da solo non equivale a review conclusa.    |
| Evidenza non legata esplicitamente al target di design                | Registrare revisione mock, scenario, viewport, commit di base e stato/diff del codice verificato. Rifiutare l'uso di prove precedenti dopo modifiche pertinenti. |
| `.prettierignore` esclude i vecchi documenti numerati                 | Verifica mirata dei documenti attivi nuovi; copia originale `.txt` resta byte-identica. Non riformattare tutte le specifiche solo per uniformità.                |
| `scripts/check-repository.mjs` codifica vincoli MVP                   | Riesaminare solo i vincoli toccati dal ciclo approvato; backend/sync restano esclusi, quindi non allentare controlli senza bisogno.                              |
| Playwright ha Pixel 7, iPhone viewport Chromium e WebKit core         | Conservare la matrice; aggiungere soltanto viewport/stati concordati per densità, senza moltiplicare ogni test per ogni misura.                                  |

Ambiente rilevato in questa sessione: `node` nel PATH è 18.13.0, mentre repository e CI richiedono Node 24. Prima di attivare il piano usare/verificare Node 24 e dipendenze installate, senza abbassare il vincolo. La revisione documentale non ha tentato di eseguire il gate MVP con runtime incompatibile.

## 3. Superficie di verifica

I comandi esistenti restano i nomi pubblici. Estenderne l'interno solo quanto necessario:

| Quando                   | Controlli                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline avvio ciclo     | `npm run verify:all` con Node 24; registrare fallimenti reali prima delle modifiche.                                                        |
| Prima di ogni milestone  | Stato Git, checkpoint precedente, `npm run verify:quick`; controlli aggiuntivi pertinenti alla dipendenza se cambiata.                      |
| Chiusura grafica/feature | `npm run verify` + journey browser pertinenti e ispezione dei target modificati; persistenza se si scrivono dati.                           |
| Chiusura RULE_HEAVY      | Quanto sopra, test dominio/invarianti su casi limite, reviewer indipendente avversariale.                                                   |
| Gate finale              | `npm run verify:all`, scenario completo, regressioni browser, confronto visuale approvato, reviewer funzionale e UX più verifica integrità. |

`npm run milestone:start -- Uxx`, `milestone:check` e `milestone:complete` saranno utilizzabili **solo dopo U00 e l'adeguamento del controller**. U00 richiede inizializzazione esplicita del piano/manifest prima di poter gestire il proprio stato con lo stesso strumento. Nessun comando nuovo viene presentato come già disponibile oggi.

Test grafici: misurare overflow, bersagli, contenuti coperti, ordine e presenza di informazioni operative; salvare pochi screenshot significativi. Non affidarsi a snapshot pixel fragili come unica accettazione. Un confronto estetico non dimostra persistenza, integrità o accessibilità su dispositivo.

## 4. Fixture e rischi da rendere verificabili

Riutilizzare il D2 deterministico di M15, con varianti leggibili: 21/23 persone, omonimi/nomi lunghi, minori, taglie estreme, tre ruoli staff, sette Comandate, tredici sessioni, A terra, Mezzi, più avarie e indisponibilità. Aggiungere zero e 30 persone solo per gli stress visivi rilevanti; un caso a equipaggi flessibili per evitare layout valido solo per coppie.

- **Persistenza da 0.1.0:** aprire una fixture anonima precedente dopo gli aggiornamenti; conservare persone, storico, sessioni, voti, note e barche. CT è additivo; eventuali cambi di schema devono avere migrazione verificata.
- **Eliminazione allievi:** test separati per ogni tipo di referenza, inclusi A terra, valutazione senza voto ma con nota, sessioni passate e turni completati. Controllo al momento della scrittura, non solo pulsante nascosto. Nessuna cancellazione parziale.
- **Barca scollegata:** test della decisione Q01, con passato/presente/futuro e ricaricamento. Nessuna persona persa, nessun doppio uso della barca.
- **Comandate:** preview non mutante; capacità/somma e priorità rispettate; warning localizzati derivati dalla stessa fonte delle spiegazioni; ricalcolo preserva completati.
- **Voce:** fixture audio sul percorso reale di decodifica/inferenza e prova fisica separata. Test doppi deterministici utili agli errori UI, insufficienti per chiudere STT-001.
- **OCR:** corpus con verità attesa, punteggio per campo/persona, falsi candidati e costo di correzione. Soglie solo dopo Q06; niente successo basato sulla sola confidence globale.
- **Rapidità e errori:** tap ripetuti, selezione/sessione cambiata durante salvataggio, nota con tastiera aperta, errore e retry; nessuna UI bloccata indefinitamente.

Non confondere il conteggio storico noto 20/21 dopo riattivazione con una regressione introdotta dal restyling: M15 lo documenta. Correggerne la semantica richiede un item approvato separato; la nuova UI non deve farlo apparire risolto senza prova.

## 5. Milestone proposte e ordine

Tutte **DRAFT / NON AVVIATE**. All'attivazione convertire in sezioni individuali con `Status: PENDING` compatibile col controller; ogni riga indica il minimo da dettagliare, non una chiusura concessa sulla sola tabella. Prima affrontare i difetti riproducibili, poi il ciclo UX; la discussione dei mock può intanto proseguire. Se un difetto non è riproducibile, registrare la prova e decidere il suo stato senza inventare una correzione.

| ID  | Categoria        | Pagine / ambito                                                                    | Evidenza per chiusura                                                                                                            |
| --- | ---------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| U00 | FOUNDATION       | Baseline, piano attivo, raccordo specifiche, manifest/controller, target e fixture | Baseline verificata; controller rifiuta evidenza mancante/FAIL; vecchie milestone integre; self-review.                          |
| U01 | FEATURE          | P20, STT-001 nei tre contesti                                                      | Audio reale/fixture e dispositivo, primo uso/cache, errori/retry, audio non conservato; self-review con limiti misurati.         |
| U02 | FEATURE          | P06, OCR-001                                                                       | Corpus e metriche Q06, review/commit, confronto manuale, telefono; self-review.                                                  |
| U03 | FEATURE          | P01 poi P02, token e shell minima                                                  | Mock approvati, navigazione/creazione/reload, dimensioni/focus; nessun restyling massivo non verificato.                         |
| U04 | FEATURE          | P03, lista Allievi                                                                 | Densità, nomi/stati, Aggiungi, ordinamento/tie-break e navigazione; self-review.                                                 |
| U05 | RULE_HEAVY       | P04, modifica ed eliminazione                                                      | Profilo/Conoscenza coerenti, autosave, matrice referenze, invarianti, reviewer integrità/dominio.                                |
| U06 | FEATURE          | P05, Conoscenza                                                                    | Taglia diretta, note condivise, persistenza e dettatura integrata; self-review.                                                  |
| U07 | RULE_HEAVY       | P07 poi P08, Barche                                                                | Parser e duplicati, disponibilità distinta, Q01 se pertinente, storico; reviewer dominio.                                        |
| U08 | FEATURE          | P09, Avarie                                                                        | Preview utile, stati diretti, rapidità/errori, persistenza e voce; self-review.                                                  |
| U09 | RULE_HEAVY       | P10, CT e Volontari                                                                | Compatibilità dati precedenti, ruolo e esclusioni verificati, integrazione pool; reviewer dominio.                               |
| U10 | RULE_HEAVY       | P11 → P12 → P13, Comandate                                                         | Tutti i target approvati; capacità/preview, regole, warning locali, completati, manual override; reviewer avversariale.          |
| U11 | RULE_HEAVY       | P14 → P15 → P16, Equipaggi                                                         | Move/swap/copia, A terra/Mezzi/CT, Q01, invarianti, layout denso e annuncio; reviewer dominio, poi ispezione UX.                 |
| U12 | FEATURE          | P17 → P18 → P19, Valutazioni                                                       | Target Q05, scelta diretta, note/assenza/conteggi, storia e reload; self-review.                                                 |
| UG1 | INTEGRATION_GATE | Settimana completa e rilascio                                                      | `verify:all`, confronto visuale, compatibilità 0.1.0, funzionale/UX/integrità, nessun blocker, release note e checkpoint pulito. |

Queste milestone sono separate per area. Anche dentro U10/U11/U12 si termina e verifica una sottovista prima di procedere alla successiva. Le review indipendenti si svolgono al livello richiesto da `AGENTS`, senza moltiplicare revisori per piccoli aggiustamenti grafici.

## 6. Scheda di esecuzione per ogni milestone

Prima dello start completare una scheda con:

- ID/categoria/stato, commit precedente e baseline;
- richieste incluse e rinviate, pagine, target approvati con revisione;
- domande chiuse e decisioni autorevoli applicate;
- lavoro limitato alla milestone e supporto necessario;
- controlli richiesti e scenario concreto;
- reviewer richiesti e criteri d'accettazione;
- evidenze e limiti noti;
- checkpoint conclusivo.

Sequenza obbligatoria: baseline → start → modifica → prove → diff/self-review → review richiesta → fix → rerun pertinente → complete → registro → commit. Non carry-over di modifiche inspiegate verso la milestone successiva.

## 7. Evidenze leggere

Percorso futuro `.evidence/Uxx/`: `verification.json`, review quando richiesta, pochi screenshot, nota decisioni/limiti. Registrare almeno comandi/esito/data, ambiente/versione runtime/browser, scenario/viewport, target di design, revisione del codice verificata e prove manuali reali separate da simulazioni.

Reviewer: PASS / PASS_WITH_FINDINGS / FAIL, blocker, importanti, QoL, prove ispezionate. FAIL o blocker impediscono chiusura. PASS_WITH_FINDINGS ammesso solo se accettazione rispettata e limiti espliciti. Non chiamare PASS una prova fisica non disponibile: segnare il gate pertinente in attesa di quella prova.

## 8. Definizione di completamento del ciclo

Tutte le richieste incluse hanno un target, prova e checkpoint; i rinvii sono espliciti. Suite completa e settimana deterministica passano; dati 0.1.0 restano leggibili; reviewer senza blocker; uso fisico richiesto di OCR/STT documentato; visuale confrontata con target e deroghe accettate; versione/nota rilascio aggiornate; working tree pulito.

Non sono automaticamente inclusi: sync/backend, nuovi archivi/documenti, auto-equipaggi, indicatori di fascia valutazioni, set completo di icone, semantica storica 20/21, ricerca/scroll sincronizzato Riepilogo. Una richiesta opzionale entra solo con perimetro, target ed evidenza aggiunti al piano.
