# 11 — Revisione dei mock UX

**Stato:** feedback umano r2 del 5 settembre 2026 recepito; [galleria r3](mockups/index.html) pronta. P13, P15, P19 e il limite delle note P04 richiedono le scelte raccolte in [12 — Domande residue](12_R2_REVIEW_QUESTIONS.md). Nessun mock autorizza ancora l'implementazione.

## Revisione umana r1 — 4 settembre 2026

| Pagina  | Indicazione ricevuta                                                                                | Risposta r2                                                      |
| ------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| P01     | Pulire la Home; togliere riga corso/livello; `D2 - 35 &#124; 2026` su una riga; solo simbolo CVC.   | Recepita. Immagini Instagram restano upgrade futuro.             |
| P02     | Formato corso con separatori; niente barra inferiore durante Crea corso.                            | Recepita.                                                        |
| P03     | Aggiungi flottante blu in basso a destra.                                                           | Recepita.                                                        |
| P04     | Tre pulsanti sesso; recuperare impatto grafico; note/valutazioni visibili; niente scroll inutile.   | Ridisegnata.                                                     |
| P05     | Più spazio al nome; Detta nello stesso popup del testo.                                             | Recepita.                                                        |
| P06     | Scelta galleria/foto, camera intera, rotazione libera e crop.                                       | Recepita.                                                        |
| P07     | Base giudicata buona; usarla la prima volta e prevenire duplicati successivi.                       | Conservata come primo setup; aggiunte successive partono da P08. |
| P08–P10 | Più identità visiva senza perdere semplicità.                                                       | Recepita.                                                        |
| P11     | Due colonne confermate; resa più curata e avviso visibile.                                          | Recepita con stato “Con avvisi / nomi lunghi”.                   |
| P12     | `floor(N/D)`, scegliere giorni con più persone; switch compatti; tutti selezionabili per stay-over. | Recepita.                                                        |
| P13–P16 | Compattare, chiarire rimozione/destinazioni e mantenere A terra/Volontari raggiungibili.            | Recepita in r2, poi ulteriormente rivista in r3.                 |
| P17–P19 | Rendere valutazioni e cronologia allineate, leggibili e cromatiche.                                 | Ridisegnate in r2, poi corrette in r3.                           |
| P20     | Non deve esistere come pagina.                                                                      | Rimossa; dettatura integrata in P05/P09/P17.                     |

## Revisione umana r2 — 5 settembre 2026

| Pagina | Indicazione ricevuta                                                                                          | Risposta r3                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| P01    | Logo CVC intero; arancione Allievi/Equipaggi/Valutazioni; possibile simmetria blu sulle altre card.           | Simbolo non tagliato; tre card arancioni e tre blu.                                                   |
| P02    | Codice corso dinamico per famiglia, livello, settimana e anno.                                                | Famiglia/livello aggiornano subito D/C e livello; settimana ISO/anno restano derivati dal calendario. |
| P03    | Nessuna modifica.                                                                                             | Conservata; approvazione r2 registrata.                                                               |
| P04    | Testi note più leggeri, altre note previste solo se esistono, maggiore compattezza.                           | Font alleggerito e sezione condizionale dimostrata; quantità massima aperta in Q13.                   |
| P05    | I cinque pulsanti taglia non devono sbordare.                                                                 | Portati a 40 px e disposti sotto il nome solo nel profilo stress da 320 px.                           |
| P06    | Review più compatta; sticky live per righe, campi mancanti e allievi inseriti.                                | Recepita; i tre valori cambiano mentre si corregge o elimina una riga.                                |
| P07    | Aggiungere RS 500, J/80, First 25.7 e First 27.                                                               | Elenco allineato alla mappatura normativa di `01`.                                                    |
| P08    | Logo Quest intero, nessun testo duplicato, numero subito dopo il logo.                                        | Recepita; sette barche mostrano anche il caso oltre cinque.                                           |
| P09    | Come P08; testo più leggero; pulsanti stato un poco più bassi.                                                | Recepita; accento giallo sinistro conservato.                                                         |
| P10    | Aggiunta volontario deve aprire un nome vuoto.                                                                | Recepita e provata.                                                                                   |
| P11    | Divisore giorno/persone e feedback sticky assegnati/totale, giallo se incompleto.                             | Recepita; lo scenario warning mostra 20/21.                                                           |
| P12    | Riepilogo numerico in una card; testo più piccolo; chiarire metà settimana.                                   | Recepita. “Da metà settimana” è comportamento reale già previsto da CMD-01.                           |
| P13    | Modello ancora poco chiaro.                                                                                   | Non dichiarata approvata; Q10 chiede di scegliere fra vista del giorno e storia per persona.          |
| P14    | Warning equipaggio anche per due XL; tre puntini; selettore sessione meno simile a una card.                  | Recepita; il warning XL/XL è indipendente da avaria/indisponibilità della barca.                      |
| P15    | Fascia barche più bassa, logo, sticky e capace di gestire più di cinque barche.                               | Proposta una riga sticky scorribile con sette barche; scelta aperta in Q11.                           |
| P16    | Tre aree distinte: numero equipaggio, logo/numero barca, persone; card più basse.                             | Recepita.                                                                                             |
| P17    | Togliere `~`; nessuna selezione come default; secondo tap annulla; nome completo sopra e cinque scelte sotto. | Recepita con icone e card compatte verticali.                                                         |
| P18    | Assenza vuota; segni sempre verdi/rossi; nessuno scroll orizzontale.                                          | Recepita. `=` resta neutro/blu.                                                                       |
| P19    | Card vuote più basse; riepilogo in fondo non tagliato; assenza vuota e colori coerenti.                       | Recepita con griglia finale completa; significato della tabella aperto in Q12.                        |

## Percorso breve per rivedere r3

1. **P01 → P02:** verificare logo/colori, poi scegliere Cabinato e livello 4; deve comparire `C4 - 35 | 2026` e la barra inferiore deve restare nascosta.
2. **P04 → P05:** controllare peso tipografico delle note, limite Q13 e cinque taglie a 430/390/320 px.
3. **P06:** arrivare alla review, completare la data mancante e osservare `1 → 0` campi e `2 → 3` allievi inseriti.
4. **P11** nello stato con avvisi: osservare il feedback sticky `20/21` e i divisori.
5. **P13:** rispondere Q10 prima di dichiarare un target.
6. **P14:** nello stato con avvisi, aprire il triangolo del primo equipaggio XL/XL.
7. **P15 → P16:** valutare Q11, poi verificare le tre colonne della lettura.
8. **P17:** assegnare un voto e toccarlo di nuovo; **P18** non deve mostrare `~` né scroll orizzontale.
9. **P19:** scorrere fino alla griglia completa e rispondere Q12.

## Registro r3

| Pagina                    | Stato                 | Motivo                                           |
| ------------------------- | --------------------- | ------------------------------------------------ |
| P01 Home                  | R3 DA RIVEDERE        | Logo e schema 3 arancioni/3 blu corretti.        |
| P02 Crea corso            | R3 DA RIVEDERE        | Dinamica D/C e livello aggiunta.                 |
| P03 Allievi               | APPROVATO R2          | Nessun nuovo cambiamento richiesto.              |
| P04 Profilo allievo       | R3 DA RIVEDERE        | Q13 aperta sul numero di note recenti.           |
| P05 Conoscenza            | R3 DA RIVEDERE        | Geometria corretta su quattro larghezze.         |
| P06 Scan allievi          | R3 DA RIVEDERE        | Indicatori sticky e live aggiunti.               |
| P07 Configura barche      | R3 DA RIVEDERE        | Tipi barca aggiornati.                           |
| P08 Barche                | R3 DA RIVEDERE        | Logo ricostruito e identità inline.              |
| P09 Avarie                | R3 DA RIVEDERE        | Logo/testo/pulsanti corretti.                    |
| P10 Volontari             | APPROVATO R2 + FIX R3 | Nuovo nome vuoto.                                |
| P11 Comandate             | R3 DA RIVEDERE        | Copertura sticky aggiunta.                       |
| P12 Proposta Comandate    | APPROVATO R2          | Ritocco card eseguito; logica confermata.        |
| P13 Persone Comandata     | APERTO Q10            | Modello d'interazione da scegliere.              |
| P14 Equipaggi             | R3 DA RIVEDERE        | Esempio XL/XL e header corretti.                 |
| P15 Barche della sessione | APERTO Q11            | Scegliere fascia scorribile o due righe.         |
| P16 Leggi equipaggi       | R3 DA RIVEDERE        | Tre aree esplicite.                              |
| P17 Valutazioni           | R3 DA RIVEDERE        | Nuovo modello a cinque pulsanti deselezionabili. |
| P18 Riepilogo             | R3 DA RIVEDERE        | Assenze vuote e colori coerenti.                 |
| P19 Storia allievo        | APERTO Q12            | Griglia finale proposta da confermare.           |
| P20 Dettatura             | RIMOSSA               | Integrata nei pannelli testo.                    |

## Esito tecnico del mock

La scansione r3 copre 152 combinazioni: 19 viste × quattro larghezze × stato normale/avvisi, con 23 persone. Nessuna pagina produce overflow orizzontale. Il selettore di P15 ha uno scroll interno intenzionale e resta l'oggetto della Q11. Le verifiche riguardano il prototipo isolato, non accessibilità certificata, persistenza o comportamento dell'app.
