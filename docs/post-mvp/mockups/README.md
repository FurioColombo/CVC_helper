# Mock UX r2 — guida alla revisione

Questa galleria è separata dall'app. Non importa codice o dati applicativi e non simula persistenza, OCR, fotocamera o microfono reali. Le interazioni servono a discutere geometria, gerarchia e feedback.

## Aprire la galleria

Dalla cartella del repository:

```powershell
python -m http.server 8785 --bind 127.0.0.1 --directory docs/post-mvp/mockups
```

Poi aprire `http://127.0.0.1:8785/#P01`. Il server espone soltanto questa cartella.

## Percorso consigliato

1. P01 per direzione visiva e marchio.
2. P04 per il profilo su una schermata.
3. P06: `Fai una foto` → scatto → rotazione libera/crop.
4. P11 con stato `Con avvisi / nomi lunghi`.
5. P12 per “Giorni con più persone” e selezione stay-over fra tutti.
6. P14: toccare destinazione e triangolo; osservare A terra/Volontari in basso.
7. P17, P18 e P19 per inserimento, riepilogo e storia delle valutazioni.

Sono disponibili P01–P19. P20 è stata eliminata: `Detta` gestisce permesso, registrazione, retry e trascrizione nello stesso pannello di testo di P05/P09/P17.

## Identità r2

L'header usa soltanto il simbolo dell'asset pubblicato nella [home CVC](https://www.centrovelicocaprera.it/), acquisito il 4 settembre 2026. Il file non è stato ridisegnato; la resa è ottenuta ritagliando visivamente la copia locale `assets/logo-fcvc.avif`.

Il logo RS Quest in `assets/rs-quest.png` è la copia non modificata fornita dall'autore nella revisione r1. SHA-256: `F7B5DC1A95C233A3805AC5AE361ECA4D5BF9508D206AD9B5B62CA11CF5D181AB`.

Il nome “CVC Helper” e il blu funzionale restano proposte. Le immagini Instagram come sfondo o card sono un upgrade futuro e non sono state copiate nella galleria.

## Decisione da confermare

P12 applica `floor(N/D)` a ogni giorno e chiede di selezionare esattamente `N mod D` “Giorni con più persone”. “Genera proposta” resta disabilitato finché la selezione non è completa. Questa è un'inferenza d'interazione da confermare guardando il mock.

## Controlli r2

Nel browser sono stati controllati 152 layout: 19 viste × quattro misure × stati normale e avvisi, con 23 allievi. Non sono emersi overflow orizzontali o controlli sotto 40 × 40 CSS px; sui tre profili principali, nessun controllo è sotto 44 × 44 CSS px. Il profilo P04 entra senza scroll a 430 × 820, 412 × 760 e 390 × 664.

Sono stati esercitati nel mock:

- barra inferiore nascosta in P02 e FAB P03;
- dettatura dentro il pannello nota e flusso fotocamera/rotazione/crop;
- P12 con 23 persone, base tre e due giorni da quattro; selettore stay-over con tutte le 23 persone;
- aggiunta e rimozione esplicita in P13;
- dettaglio destinazione e ragioni warning in P14;
- deselezione Quest 2 in P15 con persone conservate;
- selezione icona in P17 e settimana P18 senza scorrimento orizzontale.

Queste misure non equivalgono a verifica completa di accessibilità o dell'app. P14 e P18 scorrono verticalmente per mostrare rispettivamente equipaggi su tre righe e 23 persone; il requisito r2 è preservare nomi/allineamento, non comprimere l'intero elenco in una schermata.

Formattazione e lint riguardano soltanto i file della galleria. Restano da disegnare/verificare tutti gli stati secondari, testo al 200%, tastiera mobile, equipaggi flessibili e dispositivi fisici. Creazione, autosave, OCR, voce e salvataggi sono dimostrazioni: non costituiscono prove del comportamento applicativo.

Dettagli macchina: [review-checks.json](review-checks.json). Registro umano: [11_MOCK_REVIEW.md](../11_MOCK_REVIEW.md).
