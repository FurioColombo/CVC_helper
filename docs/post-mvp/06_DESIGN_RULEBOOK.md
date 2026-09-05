# 06 — Regole di design per il ciclo post-MVP

**Stato:** aggiornato alle revisioni umane fino al 5 settembre 2026; geometria r6 da valutare nei mock. Da usare con [05](../../05_POST_MVP_UX_CHANGE_REQUESTS.md), [07](07_PAGE_CHANGELOG.md) e [12](12_R2_REVIEW_QUESTIONS.md). I valori di progetto sotto non sono già un mock complessivamente approvato.

## 1. Ordine delle decisioni

Prima correttezza dei dati, riconoscibilità delle persone e precisione dei tocchi; poi informazioni simultanee; poi riduzione dello scroll; infine rifinitura estetica. Se gli obiettivi confliggono, mostrare il compromesso nel mock e registrarlo. Non ottenere “zero scroll” nascondendo nomi essenziali o riducendo indiscriminatamente i controlli.

Ogni pagina dichiara la decisione che aiuta a prendere. Composizione/verifica possono essere dense; annuncio/lettura devono rimanere molto puliti. L'estetica cercata è quella essenziale e leggibile della comunicazione CVC: pochi colori, font ordinari, gerarchia netta e nessuna animazione ornamentale. Nessuna nuova dashboard o area funzionale deriva dal solo restyling.

## 2. Regole operative

| ID  | Regola                                                                                                                                                                                                              | Come verificare                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R01 | Informazioni da confrontare insieme nello stesso campo visivo. Dettagli secondari a un tap, senza cambiare area.                                                                                                    | Indicare nel mock quali informazioni sono simultanee; percorrere il compito con 21/23 allievi.                                             |
| R02 | Ridurre prima padding, header ripetuti, testi permanenti e icone vuote.                                                                                                                                             | Confronto prima/dopo sullo stesso viewport e sugli stessi dati; niente conteggi di densità con fixture diverse.                            |
| R03 | Due colonne come prima ipotesi per persone; terza solo con beneficio misurato. Disposizione stabile fra dispositivi.                                                                                                | Nomi lunghi, omonimi, minorenni, persona selezionata e disabilitata; stessa sequenza di lettura.                                           |
| R04 | Bersagli di tocco almeno 40 × 40 CSS px nei gruppi densi e ripetuti; preferire 44 px in generale e 48 px per azioni frequenti se lo spazio consente. Icona visibile anche più piccola, area attiva non sovrapposta. | Misura del rettangolo effettivamente cliccabile, non soltanto dell'SVG. Spaziatura e prova su telefono obbligatorie.                       |
| R05 | Tipografia leggibile, nomi prima dei dettagli. Proposta: testo principale/input 16 px, secondario 14 px, titoli 20–24 px. Badge brevi 12–13 px solo se non portano da soli informazione essenziale.                 | Niente perdita di identità; testo al 200%, nomi su due righe quando necessario. Non trattare questi numeri come standard universale.       |
| R06 | Contrasto sufficiente e significato mai affidato al solo colore.                                                                                                                                                    | Testo ordinario almeno 4,5:1; testo grande secondo definizione WCAG almeno 3:1. Simbolo/etichetta per ogni stato.                          |
| R07 | Poche scelte frequenti: selezione diretta, senza menu aggiuntivo.                                                                                                                                                   | Taglia e voto con un tap dal contesto di modifica; preview/save state visibili.                                                            |
| R08 | Stato nel punto interessato, dettagli su richiesta.                                                                                                                                                                 | Giorno e persona coinvolti riconoscibili senza aprire Avvisi; più problemi accessibili dal segnale sintetico.                              |
| R09 | Gesti avanzati solo come scorciatoie. Percorso esplicito con tastiera e touch sempre disponibile.                                                                                                                   | Profilo editabile senza conoscere il long press; nessun gesto nascosto come unico accesso.                                                 |
| R10 | Modifiche ordinarie rapide e autosalvate quando previsto; stato di salvataggio e recupero errore chiari.                                                                                                            | Modifica → navigazione/reload; nessun “salvato” prima della persistenza. Non perdere l'ultimo carattere.                                   |
| R11 | Conferma per eliminazione definitiva; nessuna conferma per ogni normale spostamento/scambio.                                                                                                                        | Cancellazione con identità e conseguenza; spostamento correggibile con la stessa interazione. Nessun Undo generico.                        |
| R12 | Sticky e flottanti non coprono elementi o focus. Un solo livello di azioni persistenti oltre alla navigazione, salvo prova di necessità.                                                                            | Ultima riga, tastiera aperta, safe area, dialog aperto e ritorno del focus.                                                                |
| R13 | Un lessico e uno stile coerenti per stessi concetti.                                                                                                                                                                | Stessi componenti per persona, stato, barca, sessione; microcopy italiana.                                                                 |
| R14 | Stati vuoto, caricamento, errore e indisponibilità sono parte del design.                                                                                                                                           | Mock degli stati pertinenti; azioni di recupero reali senza tecnicismi inutili.                                                            |
| R15 | Una pagina per volta: target discusso → implementazione → verifica → checkpoint.                                                                                                                                    | Nessuna chiusura basata solo su codice o screenshot statico.                                                                               |
| R16 | Costruire la gerarchia con spaziatura, raggruppamento, allineamento e tipografia; aggiungere bordi, fondi e ombre soltanto quando chiariscono davvero una relazione o uno stato.                                    | Togliere un trattamento decorativo alla volta: la struttura deve restare leggibile. Niente card annidate come impaginazione predefinita.   |
| R17 | Evitare l'aspetto da template generico: niente collezioni arbitrarie di pill, gradienti, eyebrow, frecce decorative o card identiche. Il linguaggio visivo deve derivare da barche, persone, turni e avvisi reali.  | Ogni componente decorativo deve corrispondere a contenuto, azione o stato del dominio; audit su screenshot aggiornati dopo ogni revisione. |
| R18 | Nessuno scroll orizzontale nell'interfaccia operativa, compresi selettori di oggetti e riepiloghi. Usare griglie che vanno a capo, gerarchie verticali e contenuti compatti.                                        | Misurare pagina e contenitori interni nei viewport 430/412/390/320 px; `scrollWidth` non deve superare `clientWidth`.                      |
| R19 | In una griglia, card con quantità diverse di contenuto partono dalla stessa quota in alto; non centrare verticalmente il contenuto della card più corta.                                                            | Confrontare righe con due e cinque nomi, soprattutto in P11; titolo e divisore devono risultare allineati.                                 |
| R20 | Le icone di stato sono asset vettoriali coerenti, non caratteri Unicode usati come sostituti grafici. La loro etichetta accessibile esprime il significato.                                                         | Ispezionare SVG/asset e nome accessibile; provare ingrandimento e font fallback senza cambiare il simbolo.                                 |
| R21 | I colori operativi sono stabili per contesto. In P15: grigio non disponibile, verde assegnata, blu disponibile non assegnata; testo o legenda accompagna sempre il colore.                                          | Verificare i tre stati simultanei, selezione equipaggio → barca blu e aggiornamento persistito dopo reload.                                |

### Fonti e limiti delle raccomandazioni

Il riferimento web per R04 è [W3C Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced): 44 × 44 CSS px, criterio AAA con eccezioni. Il criterio [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) è AA e usa 24 × 24 CSS px o specifiche eccezioni/spaziature. Dopo la revisione sul campo, il rulebook ammette 40 px per selettori densi e ripetuti come taglie e voti, mantenendo 44 px come preferenza generale. È una decisione del progetto, non una soglia attribuita a WCAG AA.

[Apple Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) raccomanda area attiva almeno 44 × 44 **punti** e spazio sufficiente: è un riferimento nativo coerente nella direzione, non una conversione tra punti, dp e CSS px. Il valore 48 px qui è una preferenza progettuale, non una soglia attribuita a quella fonte.

R05/R06 si appoggiano a [W3C Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) e [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). La scala 16/14/12–13 è una proposta dell'app da verificare, non un minimo tipografico WCAG. [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) guida la prova a larghezza equivalente 320 CSS px e l'assenza di perdita di contenuto: la densità deve degradare in modo leggibile.

Non esiste in queste fonti una prova che basso-destra sia universalmente il punto migliore per il contatore. La preferenza dell'autore va confrontata con un header sticky, provando mano destra/sinistra e coperture. Non attribuire alla letteratura un risultato di ergonomia non misurato.

## 3. Dizionario visivo proposto

| Concetto                     | Resa                                                  | Vincolo                                                                                                        |
| ---------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Minore                       | M bianca su rosso, quadrato arrotondato               | Nome accessibile “Minorenne”; non confondere con sesso M o taglia M. Nel dettaglio parola completa.            |
| Comandata corrente           | C bianca su blu                                       | Etichetta accessibile; mapping alla sessione invariato.                                                        |
| Smontante                    | SM distinto da C                                      | Mostrare quando pertinente alla sessione; non inventare nuovi significati.                                     |
| Avviso                       | Icona triangolo SVG gialla/rossa e dettaglio testuale | Severità derivata dalle regole; nessuna declassificazione per motivi estetici.                                 |
| Selezione                    | Bordo/fondo e stato selezionato esplicito             | Distinta da warning e indisponibilità; contrasto preservato.                                                   |
| Disabilitato/non disponibile | Resa attenuata più testo/stato                        | Storico leggibile; non sola opacità indistinguibile.                                                           |
| Volontario                   | Ruolo ADV/IS/CT e trattamento distinto                | Non allievo; non parte dei conteggi allievi.                                                                   |
| Anteprima                    | Etichetta Anteprima, bordo tratteggiato/fondo tenue   | Proposta: evitare rosso per il solo fatto che non è confermata.                                                |
| Valutazione                  | ++/+ verdi; -/-- rossi; = neutro; assenza vuota       | Cinque icone dirette; nessuna selezione è il default e un secondo tap annulla; nessuna media numerica esposta. |
| Barca                        | Numero prominente, tipo più piccolo                   | Disponibilità e avarie separati, anche se compresenti.                                                         |
| Barca nella sessione         | Grigia non disponibile; verde assegnata; blu libera   | Legenda/testo obbligatori; la selezione di una barca blu segue quella dell'equipaggio e crea un'associazione.  |

Badge informativi piccoli non devono diventare pulsanti minuscoli: il dettaglio può essere aperto dall'intera riga/card o da un controllo di 44 px. Evitare pulsanti annidati dentro una card già cliccabile.

## 4. Poche opzioni: dove applicare UX-G02

| Contesto                         | Proposta                                 | Limite                                                                                |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Conoscenza e profilo in modifica | Cinque scelte XS/S/M/L/XL                | Riutilizzare lo stesso componente; taglia mancante resta rappresentabile.             |
| Volontari                        | Tre ruoli ADV/IS/CT                      | Scelta singola, compatta.                                                             |
| Avaria                           | Segmento Aperta/Comunicata/Risolta       | Non ridurre target; scritte complete ove possibile.                                   |
| Giorni con più persone           | S D L Ma Me G V                          | Scegliere esattamente il resto `N mod D`; preview distinta dalle assegnazioni reali.  |
| Barca nella sessione             | Tre stati espliciti con legenda          | Grigio non disponibile, verde assegnata, blu disponibile non assegnata; vedi CREW-08. |
| Valutazioni                      | Cinque valori direttamente selezionabili | Nome completo sopra, valori sotto; nessun controllo separato per “assenza”.           |
| Sessione                         | Titolo compatto + selettore contestuale  | Tredici opzioni: non forzare tredici pulsanti permanenti nell'header.                 |
| Tipo barca                       | Selettore esistente                      | Scelta rara con più opzioni: non sostituirla automaticamente con una griglia enorme.  |

## 5. Contratto di viewport accettato per i mock

Misurare in CSS px del **viewport disponibile**, distinguendo finestra browser, schermo del dispositivo e modalità PWA. Non dichiarare successo usando solo screenshot full-page che nascondono lo scroll.

| Profilo proposto                     | Uso                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 430 × 820 portrait                   | Primo target di design “telefono grande”; non attribuito a un modello specifico come concordato per la prova Q04. |
| 390 × 664 portrait                   | Viewport browser stretto già citato nelle prove MVP.                                                              |
| 412 × 760 portrait                   | Controllo intermedio Android proposto; le dimensioni reali del progetto Playwright vanno registrate al run.       |
| 320 CSS px di larghezza e testo 200% | Stress di accessibilità, con scroll ammesso e contenuto conservato.                                               |

Fixture condivisa: settimana D2 con 21 e 23 allievi, omonimi, nomi lunghi, minori, taglie, tre volontari, avarie e una barca indisponibile. Scenari aggiuntivi: zero allievi e gruppo sovradimensionato a 30 per misurare il degrado, senza promettere zero scroll per qualunque numerosità.

Metriche per pagina: dati visibili alla prima apertura; altezza totale e porzione da scorrere; tocchi per compito; dimensione dei controlli; contenuti coperti. In Comandate distinguere “sette titoli visibili” da “sette gruppi con nomi leggibili”: il primo da solo non soddisfa CMD-04.

I tre profili principali sono la prova accettata in Q04: estremo piccolo, intermedio, estremo grande. Non introdurre resizing aggressivo in base a pixel/proporzioni prima di averli confrontati. La revisione r2 fissa per P17 il nome completo sopra e cinque voti sotto; i controlli restano almeno 40 × 40 CSS px nel mock e vanno riesaminati sul dispositivo. Q01 fissa avaria gialla e indisponibilità corso rossa vicino alla barca; Q02 mantiene i duplicati Comandate rossi.

## 6. Design da approvare per ogni pagina

La [changelist](07_PAGE_CHANGELOG.md) definisce gli stati. Per ognuno registrare: ID pagina, revisione del mock, ID richieste, viewport, fixture, interazioni, cosa resta secondario, eccezioni e decisione umana. Preferire mock HTML/CSS isolati con dati fittizi per griglie e interazioni; bitmap utili per sola esplorazione del marchio, non per provare touch target o persistenza.

Una bella immagine non dimostra il funzionamento. Un target approvato richiede leggibilità dei nomi realistica, stati problematici e un modo chiaro di compiere l'azione. Poi l'implementazione dovrà produrre prova browser e persistenza secondo `09`.

## 7. Riferimenti CVC e prima applicazione

La revisione Q08 indica i siti CVC/Fondazione e i canali social. Nella [home CVC](https://www.centrovelicocaprera.it/) osservata il 4 settembre 2026 il testo usa Roboto, alcune intestazioni arancione `#db7637`, e il logo rosso/blu è disponibile come asset della pagina. Sono osservazioni della pagina, non una palette normativa del marchio.

La [galleria r6](mockups/index.html) ritaglia soltanto la scritta dell'asset CVC e conserva il simbolo intero. Usa una ricostruzione grafica del logo RS Quest fornito dall'autore perché l'immagine originale era già tagliata sul lato destro; l'asset originale resta conservato. Propone tre accenti arancioni e tre blu sulla Home, un blu funzionale con superfici chiare e indicatori sticky soltanto quando devono restare visibili durante lo scroll. Il nome CVC Helper e la scelta finale del font restano da discutere. Immagini Instagram come sfondi o card sono un possibile upgrade futuro, non parte del target r6.

### Regole aggiunte dalle revisioni r2–r6

- Un elemento sticky deve conservare un contesto operativo necessario durante lo scroll: avanzamento OCR, copertura Comandate, barche della sessione o identità dell'allievo nella sua storia. Non rendere sticky un titolo puramente decorativo.
- Logo/modello e numero barca formano un solo identificativo; non ripetere il nome in testo se è già leggibile nel logo. Possono stare affiancati nelle righe larghe o sovrapposti nei selettori stretti. Numero equipaggio e numero barca restano campi distinti.
- Un warning dell'equipaggio può esistere senza warning della barca. Il dettaglio elenca separatamente composizione/taglie, indisponibilità e avarie. Il triangolo è una vera icona vettoriale, non un carattere del font.
- L'assenza di valutazione è spazio vuoto con etichetta accessibile, non un sesto valore visibile.
- Le sezioni condizionali, come “Note recenti”, non occupano spazio quando sono vuote. Nel profilo mostrare al massimo due note recenti e aprire le altre su richiesta, mantenendo distinti tipo e provenienza.
- Le card di una stessa riga restano allineate in alto anche se hanno numeri diversi di persone: nessun contenuto va centrato verticalmente per riempire il vuoto.
- La modifica di una Comandata è centrata sul giorno scelto in P11 e si apre senza popup intermedio. Ordine: assegnati correnti, mai assegnati, assegnati altrove. I nomi stanno in due colonne e il bottone si riconosce dalla superficie, senza ripetere “Assegna a…”; tutti i giorni coinvolti sono scritti per esteso e una X rossa compatta rimuove dal giorno indicato.
- I selettori di barche vanno a capo in due righe e non scorrono lateralmente; logo sopra e numero sotto quando la larghezza è stretta. In P15 i tre stati hanno colori e legenda fissi; si seleziona prima l'equipaggio senza barca e poi una barca blu libera.
- Il doppio tap su una persona nell'equipaggio la riporta fra i Disponibili; come ogni gesto avanzato, deve esistere anche un comando esplicito raggiungibile con tastiera e tecnologie assistive.
- In P18 una piccola etichetta nomina l'ordinamento; la riduzione visiva dei bottoni conserva il target minimo del progetto.
- Nella storia allievo il riepilogo settimanale precede la cronologia senza restare sticky; nome e contesto dell'allievo restano visibili durante lo scroll.

## 8. Metodo di progettazione adottato

Il rulebook incorpora pratiche selezionate da skill pubbliche, adattate a un'app operativa sul campo:

- [OpenAI Product Design — Ideate](https://github.com/openai/role-specific-plugins/blob/main/plugins/product-design/skills/ideate/SKILL.md): risolvere prima spaziatura, raggruppamento, allineamento e tipografia; usare decorazione dopo.
- [OpenAI Product Design — Audit](https://github.com/openai/role-specific-plugins/blob/main/plugins/product-design/skills/audit/SKILL.md): giudicare screenshot freschi e dichiarare i limiti delle prove.
- [OpenAI Frontend App Builder](https://github.com/openai/plugins/blob/main/plugins/build-web-apps/skills/frontend-app-builder/SKILL.md): coprire l'intera superficie, usare un piccolo sistema coerente di componenti e verificare nel browser.
- [Anthropic Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md?plain=1): radicare il linguaggio visivo nel soggetto ed eliminare i segnali ricorrenti dei template generici.

Queste fonti guidano il processo, non sostituiscono le decisioni del prodotto. Il relativo skill personale Codex è `field-operations-ui`; il repository conserva qui tutte le regole necessarie, quindi l'implementazione non dipende dalla presenza del skill su un altro computer.
