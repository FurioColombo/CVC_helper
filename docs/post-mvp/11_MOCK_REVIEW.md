# 11 — Revisione dei mock UX

**Stato:** revisione umana r1 recepita; [galleria r2](mockups/index.html) pronta per il confronto. Nessuna pagina diventa target finché non viene registrata un'approvazione esplicita.

## Revisione umana r1 — 4 settembre 2026

| Pagina | Indicazione ricevuta                                                                                            | Risposta r2                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| P01    | Pulire la Home; togliere riga corso/livello; `D2 - 35                                                           | 2026` su una riga; solo simbolo CVC.                                                         | Recepita. Immagini Instagram restano upgrade futuro. |
| P02    | Formato corso con separatori; niente barra inferiore durante Crea corso.                                        | Recepita.                                                                                    |
| P03    | Aggiungi flottante blu in basso a destra.                                                                       | Recepita.                                                                                    |
| P04    | Tre pulsanti sesso; recuperare impatto grafico; note/valutazioni visibili; niente scroll inutile.               | Ridisegnata. Il contenuto principale entra a 430/412/390 px.                                 |
| P05    | Più spazio al nome; Detta nello stesso popup del testo.                                                         | Recepita.                                                                                    |
| P06    | Scelta galleria/foto, camera intera, rotazione libera e crop.                                                   | Recepita come flusso r2.                                                                     |
| P07    | Base giudicata buona; usarla la prima volta e prevenire duplicati successivi.                                   | Conservata come primo setup; aggiunte successive partono da P08.                             |
| P08    | Più identità visiva, logo ufficiale Quest e numero avarie.                                                      | Recepita con asset fornito dall'autore.                                                      |
| P09    | Stessa qualità visiva di P08.                                                                                   | Recepita.                                                                                    |
| P10    | Funzione corretta, resa troppo spoglia.                                                                         | Migliorata con identità persona/ruolo.                                                       |
| P11    | Due colonne confermate; resa più curata e avviso visibile.                                                      | Recepita; usare lo stato “Con avvisi / nomi lunghi”.                                         |
| P12    | Base `floor(N/D)` uguale; scegliere giorni con più persone; switch compatti; tutti selezionabili per stay-over. | Recepita. Resta da confermare il blocco finché non sono scelti esattamente `N mod D` giorni. |
| P13    | Spunta e giorni sulla stessa riga; risparmiare verticale; rimozione chiara.                                     | Recepita con chip giorno `×` e `+` per aggiungere.                                           |
| P14    | Destinazione e due persone su tre righe; tap barca/triangolo; A terra/Volontari ai due lati in basso.           | Recepita.                                                                                    |
| P15    | Fascia barche più piccola e logo per barca.                                                                     | Recepita.                                                                                    |
| P16    | Pulita ma poco gradevole.                                                                                       | Ridisegnata con gerarchia più netta e senza controlli superflui.                             |
| P17    | `~` per assente; nome e simboli sulla stessa riga; icone al posto di `+`/`-`.                                   | Recepita con SVG e target espliciti.                                                         |
| P18    | Eliminare completamente lo scroll orizzontale; allineare e usare colori leggibili.                              | Ridisegnata come griglia settimanale AM/PM per persona.                                      |
| P19    | Raggruppare gerarchicamente giorni e sessioni.                                                                  | Recepita con card giorno e sottocard AM/PM.                                                  |
| P20    | Non deve esistere come pagina.                                                                                  | Rimossa; la dettatura vive nei pannelli testo P05/P09/P17.                                   |

## Percorso breve per rivedere r2

Non serve ricontrollare subito ogni stato. Per validare le decisioni più importanti, guardare:

1. **P01** per la lingua visiva e il marchio.
2. **P04** per densità e completezza del profilo.
3. **P06** provando `Fai una foto` fino a rotazione/crop.
4. **P11** nello stato `Con avvisi / nomi lunghi`.
5. **P12** per la nuova logica “Giorni con più persone”.
6. **P14** toccando destinazione e triangolo.
7. **P17–P19** per valutazione, riepilogo e storia.

## Registro r2

Usare `APPROVATO`, `DA RIVEDERE` o `RINVIATO`, aggiungendo il cambiamento concreto.

| Pagina                    | Stato r2                        | Commenti                                     |
| ------------------------- | ------------------------------- | -------------------------------------------- |
| P01 Home                  | DA RIVEDERE                     |                                              |
| P02 Crea corso            | DA RIVEDERE                     |                                              |
| P03 Allievi               | DA RIVEDERE                     |                                              |
| P04 Profilo allievo       | DA RIVEDERE                     |                                              |
| P05 Conoscenza            | DA RIVEDERE                     |                                              |
| P06 Scan allievi          | DA RIVEDERE                     |                                              |
| P07 Configura barche      | BASE r1 ACCOLTA; R2 DA RIVEDERE | Confermare accesso solo al primo setup.      |
| P08 Barche                | DA RIVEDERE                     |                                              |
| P09 Avarie                | DA RIVEDERE                     |                                              |
| P10 Volontari             | DA RIVEDERE                     |                                              |
| P11 Comandate             | DA RIVEDERE                     |                                              |
| P12 Proposta Comandate    | DA RIVEDERE                     | Confermare selezione obbligatoria del resto. |
| P13 Persone Comandata     | DA RIVEDERE                     |                                              |
| P14 Equipaggi             | DA RIVEDERE                     |                                              |
| P15 Barche della sessione | DA RIVEDERE                     |                                              |
| P16 Leggi equipaggi       | DA RIVEDERE                     |                                              |
| P17 Valutazioni           | DA RIVEDERE                     |                                              |
| P18 Riepilogo             | DA RIVEDERE                     |                                              |
| P19 Storia allievo        | DA RIVEDERE                     |                                              |
| P20 Dettatura             | RIMOSSA                         | Integrata in P05/P09/P17.                    |

## Esito da registrare

- **Pagine che possono diventare target:** _da compilare_.
- **Pagine da ridisegnare:** _da compilare_.
- **Decisione P12:** _confermata / da cambiare_.
- **Decisioni visuali ancora aperte:** _da compilare_.

Una riga `APPROVATO` deve indicare anche viewport o deroga pertinente. L'approvazione della geometria non chiude le future prove di accessibilità, persistenza o correttezza del comportamento. Le [misure r2](mockups/review-checks.json) riguardano soltanto il mock; nessun gate MVP o post-MVP è stato eseguito.
