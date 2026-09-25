# Speech benchmark harness

Measures dictation quality, and from V03 onwards latency, by running the
Transformers.js speech path in a browser over a labelled Italian corpus. The
`current` variant takes its model, dtype and generation guard from the
production capability; experimental preprocessing and chunking stay in the
harness. It is not part of
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
- `url` — a running Vite development app, default `http://localhost:5173/`.
  Start it with `npm run dev` first; V03 reads production speech settings from
  the Vite-served source module.
- `variants` — comma-separated keys from `variants.js`, default `baseline,dsp`.
- `conditions` — comma-separated corpus conditions, default all.

Keep the historical `baseline,dsp` default to reproduce the UG1 comparison. For
the V03 comparison, pass the production-matched pipeline and its alternatives:

```bash
npm run speech:bench -- <corpus-directory> http://localhost:5173/ current,currenttrim,currentdsp,currentq4,tinyguard,currentchunked
```

Set `SPEECH_BENCH_ROUNDS` to a positive integer to choose the number of measured
warm rounds per clip and variant. It defaults to `3`. Each round visits every
selected clip once for every variant. Clip order, variant order and model-group
order rotate across rounds to spread position and device-load effects. Variants
with the same model and dtype share one pipeline. The harness loads and releases
one model/dtype group at a time, warming each selected variant in that group on
the same clip before measurement; warm-up is excluded from results.

## The pieces

| File                 | What it does                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `fetch-balanced.mjs` | Pulls Italian clips with human transcripts from the public HuggingFace datasets API and keeps a voice-balanced selection.         |
| `dsp.mjs`            | WAV reading (linear PCM, mu-law and A-law), F0 estimation, noise generation and the filter primitives.                            |
| `build-corpus.mjs`   | Labels each clip's voice by median F0 and renders the noise conditions: wind, babble, white, pink, quiet and clipped.             |
| `variants.js`        | Benchmark pipelines injected into the page. `current` reads the model, dtype and generation guard from the production capability. |
| `bench.mjs`          | Runs matched warm rounds in Playwright and prints aggregate WER, median WER, loop rate and warm latency.                          |
| `metrics.mjs`        | Shared median, loop-rate and matched-round scheduling helpers, with focused unit tests.                                           |
| `result-path.mjs`    | Prevents detailed results from being written into a tracked repository path.                                                      |

## What the numbers mean

`.evidence/UG1/speech-quality-benchmark.json` records the 0.2.0 round. Its corpus
is 8 kHz mu-law telephone speech, so its absolute error rates are inflated and
only the comparisons between variants are meaningful. Read that file before
planning another round.

WER uses the first measured warm round, preserving one WER result per clip and
variant. Latency is timed inside the browser around audio decode, any variant
preprocessing and transcription; corpus file reads and transfer, model loading
and the excluded warm-up are outside the timer. The browser receives the source
audio bytes directly, without base64 decoding. Only one pipeline is active at a
time, and pipelines are disposed after each model/dtype group. Each result row in
`<corpus-directory>/results.json` stores its per-round latencies and their
median beside the first-round hypothesis and WER. Console output contains only
aggregate tables, so transcripts and per-clip measurements stay in the corpus
directory. A corpus outside the repository is allowed. Inside the repository,
the benchmark writes only when Git confirms that `results.json` is ignored.

The default `baseline` is the historical unguarded tiny model. The V03 `current`
variant receives its model id, dtype and guard directly from
`PRODUCTION_SPEECH_CONFIG` in `src/capabilities/speech.ts`.

The harness reads WAV format tag 7 (mu-law) and tag 6 (A-law) as well as linear
PCM. An early corpus was silently decoded as linear PCM and every number
measured on it was distorted and discarded; do not remove that handling.
