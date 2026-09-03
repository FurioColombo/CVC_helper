# Mock UX r1 — guida alla revisione

Questa cartella contiene una galleria separata dall'app. Non importa codice o dati applicativi e non simula persistenza, OCR, fotocamera o microfono reali. Le interazioni servono a discutere geometria, gerarchia e feedback.

## Aprire la galleria

Dalla cartella del repository:

```powershell
python -m http.server 8785 --bind 127.0.0.1 --directory docs/post-mvp/mockups
```

Poi aprire `http://127.0.0.1:8785/`. Il server espone soltanto questa cartella. Le pagine sono raggiungibili anche come `/#P11`, `/#P14`, ecc.

## Cosa confrontare

1. Scegliere una pagina P01–P20.
2. Confrontare 430 × 820, 412 × 760 e 390 × 664; usare 320 × 664 come stress, non come promessa zero-scroll.
3. Provare 21/23 allievi e gli stati normale, avvisi/nomi lunghi, vuoto ed errore quando pertinenti.
4. Controllare informazioni contemporaneamente visibili, identità dei nomi, scroll, coperture, azione primaria e severità.
5. Annotare decisioni in [11_MOCK_REVIEW.md](../11_MOCK_REVIEW.md). Una revisione diventa target solo dopo approvazione esplicita.

Interazioni principali: scelta giorni e metà settimana in P12; warning/giorni P11–P13; selezione persona, slot, A terra e destinazione in P14; rimozione di una barca dall'uscita in P15; voti/note in P17–P19; stati permesso/registrazione in P20.

## Identità provvisoria

Il logo è una copia dell'asset pubblicato nella [home CVC](https://www.centrovelicocaprera.it/), acquisita il 4 settembre 2026 dall'URL `https://www.centrovelicocaprera.it/wp-content/uploads/logo-fcvc.avif`. Il sito osservato usa Roboto e un accento arancione vicino a `#db7637`; queste sono osservazioni della pagina, non un manuale ufficiale.

Il nome “CVC Helper”, il blu funzionale dell'interfaccia e le sigle delle card sono proposte r1. Il logo non è stato ridisegnato. Instagram, YouTube e Fondazione restano riferimenti visivi indicati dall'autore, senza contenuti copiati nella galleria.

## Limiti noti di r1

- Ogni pagina mostra il target principale, non tutti gli stati descritti nella changelist.
- Dati e risultati sono fittizi; i pulsanti aggiornano solo memoria temporanea.
- Font e colori vanno valutati insieme all'autore; nessun font CVC ufficiale è stato identificato.
- La percentuale OCR e i tempi voce non sono rappresentati come risultati raggiunti.
- Su 320 px gli Equipaggi passano a una colonna per preservare i nomi; la decisione definitiva verrà presa dopo il confronto.

## Controlli del primo mock

Formattazione e lint superati sui soli file della galleria. Nel browser sono stati controllati 100 layout: 20 viste × quattro misure in stato normale con 23 allievi, più cinque viste dense × quattro misure con avvisi/nomi lunghi. Nessun overflow orizzontale della pagina e nessun pulsante misurato sotto 44 × 44 CSS px. Non equivale a verifica completa di accessibilità.

Misure utili al confronto, con 23 allievi:

| Schermo   | Comandate normale | Comandate con avvisi | Equipaggi con avvisi |
| --------- | ----------------: | -------------------: | -------------------: |
| 430 × 820 |       0 px scroll |                 0 px |               265 px |
| 412 × 760 |       0 px scroll |                 0 px |               342 px |
| 390 × 664 |      49 px scroll |               107 px |               438 px |
| 320 × 664 |      49 px scroll |               125 px |               936 px |

In Equipaggi il pool resta visibile durante lo scroll e il contatore occupa una fascia separata in basso, per non coprire gli slot. È una proposta da confrontare con il requisito di densità, non una deroga già approvata. P17 usa una riga a 430 e due alle altre misure; lo storico mantiene lo scroll orizzontale interno.

Sono stati provati nel mock: anteprima 23/7 con sabato selezionato, spostamento allievo, deselezione barca con persone conservate, voto condiviso fra viste, nota iniziale condivisa P05/P04 e stati simulati della voce. Dettagli: [review-checks.json](review-checks.json).

Restano da disegnare/verificare stati secondari, testo al 200%, tastiera mobile, corsi con equipaggi flessibili e dispositivi fisici. Creazione, autosave anagrafico, applicazione proposta e cambio sessione mostrano soltanto controlli/feedback dimostrativi: non costituiscono prove di quei comportamenti. La galleria non replica il database o le regole complete dell'app.
