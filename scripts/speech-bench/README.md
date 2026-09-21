# Speech benchmark harness

Measures dictation quality, and from V03 onwards latency, by driving the real
app in a browser over a labelled Italian corpus. It is not part of
`verify:quick` or `verify:all`: it is slow, it downloads models, and it needs a
corpus that never enters the repository.

It lived in `.evidence/UG1/` until 2026-09-21, which made it evidence rather than
a tool and hid it from lint, formatting and the absolute-path check. Its first
line also hard-coded one machine's checkout path.

## Entry point

```bash
npm run speech:bench -- <corpus-directory> [url] [variants] [conditions]
```

- `corpus-directory` — built by `fetch-balanced.mjs` then `build-corpus.mjs`;
  holds `clean/`, `noisy/` and `manifest.json`. Keep it outside the repository,
  or under `data/`, which `.gitignore` excludes.
- `url` — a running app, default `http://localhost:5173/`. Start it with
  `npm run dev` first; the benchmark transcribes through the real capability,
  not through a copy of it.
- `variants` — comma-separated keys from `variants.js`, default `baseline,dsp`.
- `conditions` — comma-separated corpus conditions, default all.

## The pieces

| File                 | What it does                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `fetch-balanced.mjs` | Pulls Italian clips with human transcripts from the public HuggingFace datasets API and keeps a voice-balanced selection.  |
| `dsp.mjs`            | WAV reading (linear PCM, mu-law and A-law), F0 estimation, noise generation and the filter primitives.                     |
| `build-corpus.mjs`   | Labels each clip's voice by median F0 and renders the noise conditions: wind, babble, white, pink, quiet and clipped.      |
| `variants.js`        | Every pipeline that has been tried, injected into the page. `baseline` is the original, so any comparison can be repeated. |
| `bench.mjs`          | Runs the variants over the corpus in Playwright and prints WER, median WER and the repetition-loop rate.                   |

## What the numbers mean

`.evidence/UG1/speech-quality-benchmark.json` records the 0.2.0 round. Its corpus
is 8 kHz mu-law telephone speech, so its absolute error rates are inflated and
only the comparisons between variants are meaningful. Read that file before
planning another round.

The harness reads WAV format tag 7 (mu-law) and tag 6 (A-law) as well as linear
PCM. An early corpus was silently decoded as linear PCM and every number
measured on it was distorted and discarded; do not remove that handling.
