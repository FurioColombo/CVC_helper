# 11 — Revisione dei mock UX r1

**Stato:** pronto per il confronto umano. Galleria: [mockups/index.html](mockups/index.html). Nessuna riga sotto equivale ad approvazione finché non viene registrata una decisione.

## Prima lettura consigliata

Cominciare dalle viste che determinano maggiormente la densità comune:

1. **P11–P13 Comandate:** settimana completa, warning e anteprima.
2. **P14–P15 Equipaggi:** pool, slot, contatore e barche.
3. **P17 Valutazioni:** una/due righe.
4. **P03 Allievi:** card persona a due colonne.
5. **P08–P09 Barche/Avarie:** linguaggio di stato condiviso.
6. P01/P02/P10/P16/P18/P19/P20 e le altre viste.

Per ogni gruppo confrontare almeno grande, medio e piccolo con stato “Con avvisi / nomi lunghi”. Poi controllare vuoto ed errore dove hanno significato.

## Decisioni globali

| Punto                            | Decisione / commento |
| -------------------------------- | -------------------- |
| Direzione visiva e densità       | _Da compilare_       |
| Marchio/nome “CVC Helper”        | _Da compilare_       |
| Tipografia e dimensione dei nomi | _Da compilare_       |
| Blu funzionale e arancione CVC   | _Da compilare_       |
| Card a due colonne               | _Da compilare_       |
| Comportamento sul piccolo        | _Da compilare_       |

## Registro pagina per pagina

Usare `APPROVATO`, `DA RIVEDERE` o `RINVIATO`, aggiungendo il cambiamento concreto.

| Pagina                    | Stato       | Commenti |
| ------------------------- | ----------- | -------- |
| P01 Home                  | DA RIVEDERE |          |
| P02 Crea corso            | DA RIVEDERE |          |
| P03 Allievi               | DA RIVEDERE |          |
| P04 Profilo allievo       | DA RIVEDERE |          |
| P05 Conoscenza            | DA RIVEDERE |          |
| P06 Scan allievi          | DA RIVEDERE |          |
| P07 Configura barche      | DA RIVEDERE |          |
| P08 Barche                | DA RIVEDERE |          |
| P09 Avarie                | DA RIVEDERE |          |
| P10 Volontari             | DA RIVEDERE |          |
| P11 Comandate             | DA RIVEDERE |          |
| P12 Proposta Comandate    | DA RIVEDERE |          |
| P13 Persone Comandata     | DA RIVEDERE |          |
| P14 Equipaggi             | DA RIVEDERE |          |
| P15 Barche della sessione | DA RIVEDERE |          |
| P16 Leggi equipaggi       | DA RIVEDERE |          |
| P17 Valutazioni           | DA RIVEDERE |          |
| P18 Riepilogo             | DA RIVEDERE |          |
| P19 Storia allievo        | DA RIVEDERE |          |
| P20 Dettatura             | DA RIVEDERE |          |

## Risultato della revisione

- **Revisione successiva:** _r2 / non necessaria / parziale_.
- **Pagine che possono diventare target:** _da compilare_.
- **Pagine da ridisegnare:** _da compilare_.
- **Decisioni ancora aperte:** _da compilare_.

Una riga `APPROVATO` deve indicare anche il viewport o la deroga pertinente. L'approvazione della geometria non chiude le future prove di accessibilità, persistenza o correttezza del comportamento.

## Punti emersi dal primo controllo

- **Comandate:** sette gruppi visibili insieme su grande e medio; sul piccolo servono 49 px di scroll normale o 107 px con avvisi/nomi lunghi, con 23 allievi. Decidere se questa deroga è accettabile.
- **Equipaggi:** il pool resta visibile durante lo scroll. Il contatore ha una fascia riservata sotto la lista; valutare se lo spazio occupato è giustificato. Lo zero-scroll non è raggiunto nemmeno sul grande nel caso da 23.
- **Valutazioni:** il passaggio a due righe preserva i controlli ma aumenta lo scroll. Verificare il compromesso sul caso medio.
- **Conoscenza:** taglia diretta e preview di due righe per le note presenti; controllare soprattutto nomi lunghi e note frequenti.
- **Stati ancora mancanti:** la prima galleria copre le viste principali, non l'intera matrice di `07`. Approvare una vista non approva automaticamente i suoi stati mancanti.

Le [misure della galleria](mockups/review-checks.json) riguardano soltanto il mock. Nessun gate MVP o post-MVP è stato eseguito.
