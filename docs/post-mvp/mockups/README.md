# Mock UX r10 — guida alla revisione

Questa galleria è separata dall'app. Non importa codice o dati applicativi e non simula persistenza, OCR, fotocamera o microfono reali. Le interazioni servono a discutere geometria, gerarchia e feedback.

## Aprire la galleria

Dalla cartella del repository:

```powershell
python -m http.server 8785 --bind 127.0.0.1 --directory docs/post-mvp/mockups
```

Poi aprire `http://127.0.0.1:8785/#P01`. Il server espone soltanto questa cartella.

## Percorso consigliato

1. P01 per direzione visiva e marchio.
2. P04 per il profilo con note e riepilogo settimanale integrato nella card Valutazioni.
3. P06: `Fai una foto` → scatto → rotazione libera/crop.
4. P11 con stato `Con avvisi / nomi lunghi`, poi tap su un giorno per entrare direttamente in P13.
5. P12 per “Giorni con più persone” e selezione stay-over fra tutti.
6. P14: toccare destinazione e verificare stati e ordine numerico delle barche, aprire il triangolo, poi fare doppio tap su un membro; osservare A terra/Volontari in basso. In P15 controllare fascia, legenda e tre stati, poi selezionare un equipaggio senza barca e una barca blu.
7. P16 per il logo barca più leggibile. P17, P18 e P19 per inserimento, riepilogo e storia delle valutazioni; P17 dispone nome e cinque icone sulla stessa riga, P18 compatta la riga nome e in P19 il riepilogo è in alto con soggetto sticky.

Sono disponibili P01–P19. P20 è stata eliminata: `Detta` gestisce permesso, registrazione, retry e trascrizione nello stesso pannello di testo di P05/P09/P17.

## Identità r10

L'header usa il simbolo intero dell'asset pubblicato nella [home CVC](https://www.centrovelicocaprera.it/), acquisito il 4 settembre 2026. Il file non è stato ridisegnato; la resa ritaglia visivamente soltanto la scritta della copia locale `assets/logo-fcvc.avif`.

Il logo RS Quest in `assets/rs-quest.png` è la copia non modificata fornita dall'autore nella revisione r1. SHA-256: `F7B5DC1A95C233A3805AC5AE361ECA4D5BF9508D206AD9B5B62CA11CF5D181AB`. Poiché l'originale è già tagliato sul lato destro, la r10 usa `assets/rs-quest-complete.png`, una ricostruzione grafica generata per completare la lettera finale (701 × 240, SHA-256 `5C1BF936707E3B4E7F70476B9A830A5EADA086EE06FC9FA3B3AE057E887B1B52`). È una proposta del mock, non un nuovo asset ufficiale; l'originale resta conservato.

Il nome “CVC Helper” e il blu funzionale restano proposte. Le immagini Instagram come sfondo o card sono un upgrade futuro e non sono state copiate nella galleria.

I loghi barca aggiunti in r10 sono documentati in [assets/README.md](assets/README.md): le sei tavole PNG trasparenti sono tutte `256 × 72` px e seguono l'ordine RS 500, Laser Vago, RS Toura, J/80, First 25.7, First 27 dopo l'asset RS Quest già presente.

## Decisioni consolidate in r10

P12 applica `floor(N/D)` a ogni giorno e richiede esattamente `N mod D` “Giorni con più persone”. Il [target pagina per pagina](../07_PAGE_CHANGELOG.md) fissa inoltre: P13 centrata sul giorno e aperta direttamente da P11; P15 su due righe senza scroll orizzontale; P19 con riepilogo in alto e soggetto sticky; P04 con due note recenti e le altre su richiesta. La r10 conserva due allievi per riga in P13, trasforma l'azione del nome in una riga neutra con `+` blu discreto, rimuove il bannerino azzurro e mantiene il fallback testo/inset blu a 320 px per preservare spazio al nome. P17 conserva nome e cinque valutazioni sulla stessa riga.

## Controlli r10

Nel browser vengono controllati 152 layout: 19 viste × quattro misure × stati normale e avvisi, con 23 allievi. Il criterio r10 richiede zero overflow orizzontali sia della pagina sia della fascia P15. I controlli compattati non devono scendere sotto 40 × 40 CSS px; le azioni P13 sono alte 44 px e la X resta più piccola solo visivamente. La verifica finale sui dispositivi resta obbligatoria.

Sono stati esercitati nel mock:

- codice corso P02 aggiornato da D2 a C4, barra inferiore nascosta e FAB P03;
- dettatura dentro il pannello nota e flusso fotocamera/rotazione/crop;
- P12 con 23 persone, base tre e due giorni da quattro; selettore stay-over con tutte le 23 persone;
- contatori OCR live dopo completamento/rimozione di una riga;
- copertura Comandate 20/21 nello scenario warning e apertura diretta P11 → P13;
- P11 allineata in alto anche con quantità diverse; P13 con due card per riga a 320 px, caso multi-giorno a tutta larghezza, SVG warning con “Sab, Mer”, rimozione con X e riassegnazione dal solo nome; le card azionabili restano neutre, con `+` blu sopra 350 px e testo/inset blu nel layout più stretto;
- dettaglio destinazione e warning XL/XL in P14; popup con ordine numerico e stati condivisi con P15; doppio tap su Giulia con aumento dei Disponibili e slot liberato;
- P15: due righe, nessuno scroll laterale, stati grigio/verde/blu e assegnazione Equipaggio 5 → First 25.7 14 con aggiornamento dei due riepiloghi;
- P04 con griglia settimanale condivisa; P16 con logo da 68 px; P17 con nome e cinque SVG sulla stessa riga, `--` allineato e secondo tap di annullamento; P18 con riga nome e controlli da 40 px, nessun `~` né scorrimento orizzontale; riepilogo P19 in alto e soggetto sticky.

Queste misure non equivalgono a verifica completa di accessibilità o dell'app. P13, P14, P15, P17 e P18 possono scorrere verticalmente per preservare nomi, composizione e allineamento; il requisito r10 non è comprimere un intero roster in una schermata. Il mock P15 aggiorna solo memoria locale della pagina: la persistenza nel database è un requisito futuro.

Formattazione e lint riguardano soltanto i file della galleria. Restano da disegnare/verificare tutti gli stati secondari, testo al 200%, tastiera mobile, equipaggi flessibili e dispositivi fisici. Creazione, autosave, OCR, voce e salvataggi sono dimostrazioni: non costituiscono prove del comportamento applicativo.

Dettagli macchina: [review-checks.json](review-checks.json). Il target autorevole è
[07_PAGE_CHANGELOG.md](../07_PAGE_CHANGELOG.md); la storia delle revisioni è in
`archive/v0.2.0-design-history/` e non fa parte del percorso operativo.
