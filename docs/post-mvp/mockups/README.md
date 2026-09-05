# Mock UX r3 — guida alla revisione

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

## Identità r3

L'header usa il simbolo intero dell'asset pubblicato nella [home CVC](https://www.centrovelicocaprera.it/), acquisito il 4 settembre 2026. Il file non è stato ridisegnato; la resa ritaglia visivamente soltanto la scritta della copia locale `assets/logo-fcvc.avif`.

Il logo RS Quest in `assets/rs-quest.png` è la copia non modificata fornita dall'autore nella revisione r1. SHA-256: `F7B5DC1A95C233A3805AC5AE361ECA4D5BF9508D206AD9B5B62CA11CF5D181AB`. Poiché l'originale è già tagliato sul lato destro, la r3 usa `assets/rs-quest-complete.png`, una ricostruzione grafica generata per completare la lettera finale (701 × 240, SHA-256 `5C1BF936707E3B4E7F70476B9A830A5EADA086EE06FC9FA3B3AE057E887B1B52`). È una proposta del mock, non un nuovo asset ufficiale; l'originale resta conservato.

Il nome “CVC Helper” e il blu funzionale restano proposte. Le immagini Instagram come sfondo o card sono un upgrade futuro e non sono state copiate nella galleria.

## Decisioni da confermare

P12 applica `floor(N/D)` a ogni giorno e richiede esattamente `N mod D` “Giorni con più persone”; la revisione r2 ha confermato questa logica. Le quattro scelte residue sono in [12](../12_R2_REVIEW_QUESTIONS.md): modello P13, fascia barche P15, riepilogo P19 e numero di note recenti P04.

## Controlli r3

Nel browser sono stati controllati 152 layout: 19 viste × quattro misure × stati normale e avvisi, con 23 allievi. Non sono emersi overflow orizzontali della pagina. La fascia P15 ha uno scroll orizzontale interno intenzionale e resta da confermare in Q11. I controlli compattati dalla revisione r2 non scendono sotto 40 × 40 CSS px; la verifica finale sui dispositivi resta obbligatoria.

Sono stati esercitati nel mock:

- codice corso P02 aggiornato da D2 a C4, barra inferiore nascosta e FAB P03;
- dettatura dentro il pannello nota e flusso fotocamera/rotazione/crop;
- P12 con 23 persone, base tre e due giorni da quattro; selettore stay-over con tutte le 23 persone;
- contatori OCR live dopo completamento/rimozione di una riga;
- copertura Comandate 20/21 nello scenario warning;
- dettaglio destinazione e warning XL/XL in P14;
- deselezione Quest 2 in P15 con persone conservate;
- selezione e secondo tap di annullamento in P17; P18 senza `~` né scorrimento orizzontale; riepilogo P19 interamente visibile.

Queste misure non equivalgono a verifica completa di accessibilità o dell'app. P14, P17 e P18 scorrono verticalmente per preservare nomi, composizione e allineamento; il requisito r3 non è comprimere un intero roster in una schermata.

Formattazione e lint riguardano soltanto i file della galleria. Restano da disegnare/verificare tutti gli stati secondari, testo al 200%, tastiera mobile, equipaggi flessibili e dispositivi fisici. Creazione, autosave, OCR, voce e salvataggi sono dimostrazioni: non costituiscono prove del comportamento applicativo.

Dettagli macchina: [review-checks.json](review-checks.json). Registro umano: [11_MOCK_REVIEW.md](../11_MOCK_REVIEW.md).
