# Owner brief — closing 0.2.0 and running the 0.3.0 cycle

Captured 2026-09-21 directly from the repository owner, in one sitting, as answers
to a closure questionnaire plus a new batch of change requests.

This is a human decision record. Under `AGENTS.md` section 2 it outranks agent
judgement and any older plan text that disagrees with it. It does **not** replace
`04_IMPLEMENTATION_PLAN.md`: the first job of the session that picks this up is to
turn this brief into milestones there and in `.milestones/manifest.json`, and only
then to implement them. The owner asked for that order explicitly.

Everything the owner annotated is in `brief-0.3.0/` beside this file.

## 0. Order of work

1. Close UG1 as release 0.2.0 on the current branch. Section 1.
2. Branch for 0.3.0 from that checkpoint. Section 2.
3. Write sections 3–8 into the plan as milestones — goal, required behaviour,
   evidence files, acceptance criteria, reviewer level — **before** implementing
   any of them.
4. Execute them in order, one milestone at a time, with the full lifecycle of
   `AGENTS.md` section 6 around each.

The owner expects several hours of work and said so. Do not compress the harness to
finish sooner: the tracking is the point.

## 1. Close UG1 as 0.2.0 — on the current branch

Owner's words: _"Possiamo considerare lo stato attuale un 0.2.0, fai i test e
chiudiamo questa cosa […] immediatamente."_

### 1.1 The physical-device checks move to UG2, explicitly

`.evidence/UG1/physical-device-review.json` is `FAIL` on `UG1-PHYSICAL-STT` and
`UG1-PHYSICAL-OCR`, and `AGENTS.md` section 8 says a FAIL blocks completion. The
owner is not overriding the review; the owner is **changing UG1's acceptance
criteria**, which is theirs to do. The reason is concrete: the phone checks need a
trusted HTTPS origin, the app has none yet, and building one is the first 0.3.0
milestone.

Required, and none of it silent:

- Keep the 2026-09-15 review as history under a dated filename. Issue a new
  `physical-device-review.json` whose subject is the re-scoped criterion, which
  records the owner's authorisation, this date, and the fact that no device
  observation has been made.
- Amend UG1's required work and acceptance criteria in the plan so the physical
  checks read as re-scoped to UG2, not as passed.
- Record it as a known limitation of 0.2.0 in the plan and in `CHANGELOG.md`:
  dictation and scanning are verified by benchmark and by Playwright, never yet on
  a real phone.
- `docs/post-mvp/UG1_DEVICE_VALIDATION.md` stays exactly as written. It becomes
  UG2's checklist. Its rule stands: never record a simulated PASS.

### 1.2 Version 0.2.0

`package.json`, `package-lock.json` (both the root `version` and
`packages[""].version`). `scripts/check-repository.mjs` asserts the version is
`0.1.0` "until UG1" — that assertion and its message have to move with the release,
not be deleted. The 0.1.0 compatibility fixture is a different thing and stays.

### 1.3 CHANGELOG.md

Concise, user-visible, 0.1.0 → 0.2.0. The owner requires OCR, transcription and the
visual work to be in it, and is content for the rest to be summarised: _"as long as
queste 3 cose sono incluse per me è ok."_

Do **not** send it to the owner for review. They asked instead for an adversarial
internal pass: a reviewer agent whose job is to find what the changelog claims but
the repository does not support, and what shipped but went unmentioned.

### 1.4 Documentation corrections

- The mock README still says `mockups/assets/rs-quest.png` is preserved, with its
  SHA; the file was deleted. Owner: _"correggi frase."_ Fix the sentence, do not
  restore the file.
- `.evidence/UG1/field-feedback-followups.md`: owner: _"adattalo a quello che è
  stato fatto."_ Rewrite it against what actually shipped. The two OCR follow-ups
  the owner deferred (section 9) must survive the rewrite, in the plan.

### 1.5 PWA icon palette

`#063b52` is a third blue, aligned to nothing. The owner left the call to the agent;
the call is to align it: `public/icons/cvc-helper.svg`, the three PNGs beside it,
`theme-color` in `index.html`, `theme_color` in `vite.config.ts`. Use the blue the
app and the boat marks already share, and say which one in the evidence.

### 1.6 The two FIRST marks

Reference: `brief-0.3.0/first-marks-reference.png`, showing `first-25-7.png` above
and `first-27.png` below.

Owner's words: _"rendili uguali in tutto e per tutto uno all'altro tranne per il
numero. Usa come base quello di sotto, ma mettendo i numeri con dimensione di quello
di sopra, allineati a destra verticalmente con la scritta FIRST."_

So: `first-27.png` is the base for both; the numerals take the size they have in the
25.7 mark; the numerals' right edge lines up with the right edge of the FIRST
wordmark. The two marks must then differ only in the digits. `first-27.png` today is
the 25.7 artwork with the `.7` erased, which is why its number is small.

Re-run `tests/e2e/ug1-boat-mark-fit.spec.ts` afterwards: it measures all seven
canonical marks against their slot.

### 1.7 Evidence housekeeping

About 13 MB of screenshots from milestones long closed sit in the way. Owner:
_"sposta quello che non serve più in legacy o da qualche altra parte, non devono
essere in mezzo mentre cerco roba effettivamente utile."_

Move, do not delete. Every file the manifest lists as required evidence stays where
the manifest says. Update the manifest if a path moves.

### 1.8 Absolute paths

Owner: _"fai ricerca per percorsi assoluti che non devono esistere."_
`.evidence/UG1/bench.mjs` hard-codes `C:/Users/Marco Furio Colombo/...` and is
therefore already broken for anyone else. Sweep the whole repository, not just that
file, and add a check so it cannot come back — `scripts/check-repository.mjs` is the
natural home.

The benchmark scripts (`bench.mjs`, `build-corpus.mjs`, and whatever else the speech
work left in `.evidence/UG1/`) are about to be used again in section 5. Move them to
`scripts/` and give them a documented entry point.

### 1.9 Spec consolidation

`tests/e2e/evaluations.spec.ts` and `tests/e2e/volunteers.spec.ts` are each one
assertion and one screenshot away from redundancy. The owner left the call to the
agent; the call is to fold them into the journeys that supersede them — but only if
both survive: the unique assertions, and the WebKit project coverage they currently
provide. If either would be lost, keep the spec and say why.

### 1.10 Harness amendment

Owner: _"la pratica di ripulire cartelle dove teniamo roba temporanee può entrare
anche tra gli step di sviluppo indicati dall'harness."_

Add it to `AGENTS.md` as a step in the milestone lifecycle: before the checkpoint
commit, sweep the working and evidence directories and move or remove what the
milestone made and nobody needs. Keep it one sentence; `AGENTS.md` earns its
authority by being short.

Also: `data/` must be in `.gitignore`. It holds an 823 MB audio corpus supplied by
the owner (section 5) and must never enter the history.

### 1.11 Release mechanics

Run `npm run verify:all` on the release candidate. Bump, changelog, plan, manifest,
then one clean checkpoint commit.

Tag: the owner left the call to the agent. `AGENTS.md` says a tag is created when the
release is actually declared, and the owner has just declared it, so tag the
checkpoint `v0.2.0`, annotated. Do not push anything without being asked; the first
push is part of section 3, where it has a purpose.

## 2. Branch for 0.3.0

Owner: _"also put 0.3.0 development in a new branch."_

Create it from the 0.2.0 checkpoint, before any section 3–8 work:

```bash
git switch -c codex/0.3.0
```

0.2.0 stays where it is on `codex/post-mvp-ux-planning`. Do not rebase or rewrite
anything the other agent may already have built on.

## 3. Milestone: reach the app from a phone, over HTTPS

This unblocks everything the owner cannot test today. Owner: _"prima capiamo come
caricare sta app su internet, e lo facciamo, poi te lo posso testare da telefono."_

Goal: the owner opens a URL on their own phone, installs the PWA if they want, and
the app works — local-only data, no backend, no accounts.

What has to be established, in evidence, before choosing a host:

- **Cross-origin isolation.** Desktop Chrome still hands out `SharedArrayBuffer`
  without it; Android Chrome does not. If wa-sqlite needs the real thing on a phone,
  the host must be able to send `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy`, which rules out hosts that cannot set headers.
  Measure this, do not assume it: the repository has no COOP/COEP configured today
  and the app nevertheless works in desktop Chrome.
- **What `require-corp` would break.** The speech model is fetched from
  huggingface.co on first use. Under `require-corp` a cross-origin fetch without
  `Cross-Origin-Resource-Policy` fails. Either the host supports `credentialless`,
  or the model is served from the same origin, or isolation is not needed at all.
  OCR assets are already local (`vite.config.ts`), so they are not at risk.
- **Privacy.** A public URL is a public URL. No course data of any kind may be
  seeded into a deployed build, and the deployment must not add analytics or any
  network call the app does not already make.

Deliverables: a documented, repeatable deploy; the URL; a `docs/` page saying how to
redeploy and how to take it down; evidence that a cold phone load works offline
afterwards.

## 4. Milestone: the dictation control must stop changing size

Screenshots: `brief-0.3.0/dictation-stop-overflow.png` (the owner's red arrow points
at "Te…" clipped at the pane edge) and `brief-0.3.0/dictation-loading-overflow.png`
("Caricamento 100%" running out of the card).

The control is `DictationTrigger` in `src/features/speech/DictationControls.tsx`. It
is a text button whose label changes with state — `Detta`, `Permesso…`,
`Caricamento 62%`, `Termina`, `Elaborazione…` — so its width changes with it, and at
the long end it overflows.

Owner's design, in their words:

- _"Mi piace molto l'animazione della waveform, tienila com'è."_ `DictationMeter`
  is not in scope.
- Recording: keep the border, the filled red square, the label, the colours — but
  the whole element stays **square** instead of stretching sideways, with the label
  under the square, and the word becomes **Stop** rather than _Termina_.
- Processing: _"anche quando diventa Elaborazione sborda un po'."_ Same square
  element, and inside it only a red spinner, no word.
- Permission: same square, with the label under the icon as in the stop state, in
  the colour that state should have. _"Design dipendente da quello deciso per la
  versione con stop."_

Two things the owner asked for twice, so they are acceptance criteria, not advice:

1. **Validate the design with an independent specialised reviewer** before building
   it — accessibility and mobile, plus field UX. A square control with a label
   underneath must still clear the touch-target rule (R04) and must not lose its
   accessible name when the visible word changes; `aria-label` already carries the
   full sentence and must keep doing so.
2. **Then actually measure the sizes across screens.** A Playwright spec that puts
   the control through every state — idle, permission, loading with a long
   percentage, recording, processing, error — at the narrow viewport and at 200%
   text, asserting a stable box and no horizontal page scroll (R18). The bug escaped
   because no test ever rendered the long labels.

## 5. Milestone: another round on transcription quality

Owner: _"la qualità è molto migliorata, ma non è ottima, è buona, siamo un po'
borderline usabile."_

Two constraints, and the second is hard:

- Quality must improve measurably.
- **Time must not increase, and should fall by at least 20%.** _"Il tempo non può
  aumentare, anzi per essere usabile dovrebbe calare minimo di un 20%, idealmente
  molto di più."_

### What already exists

`.evidence/UG1/speech-quality-benchmark.json` is the record of the last round: a real
A/B harness over a labelled Italian corpus, with WER, median WER and a
repetition-loop rate, run through the live app in Playwright. Read it before planning
anything — it will save a day. Its findings:

- The dominant failure was repetition collapse, fixed by `TRANSCRIPTION_GUARD` in
  `src/capabilities/speech.ts`: 303% → 90% aggregate WER.
- Classic DSP measured as neutral: DC removal, an 80 Hz high pass, RMS normalisation
  and silence trimming gave 90.5% against 89.9% on tiny. Not shipped.
- The model was the lever: `onnx-community/whisper-base` halved tiny's error, to
  55.5% overall, for 73 MB of first-use download.
- That corpus is 8 kHz mu-law telephone speech, so the absolute numbers are inflated
  and only the comparison means anything.

### What is new

The owner has supplied a real corpus:
`data/test/transcription/Italian_Conversational_Speech_Corpus.zip`, 823 MB,
untracked and to stay that way. It is conversational Italian rather than telephone
audio, so this round can finally produce an absolute number worth quoting. Unpack
outside the repository, or into `data/`, which section 1.10 puts in `.gitignore`.

### What the harness must gain

`bench.mjs` measures only accuracy. The owner's second constraint is time, so the
harness has to measure latency per clip and report it beside WER — wall clock and
real-time factor, warm model, same machine, several repeats, median not mean. A
quality win that costs time fails this milestone.

### Directions, in the owner's order of preference

The owner asked specifically for DSP to be taken seriously this time, and the
reasoning is sound: the last attempt tried one generic chain on the weakest model.

_"Io continuo a suggerire un po' di DSP per migliorare i casi reali. Filtering di
frequenze che non ci interessano, in modo dipendente da come questo filtraggio si
accoppia al modello — cioè ogni modello penso possa funzionare meglio o peggio con
vari filtraggi: leggere documentazione, issues, repo, papers, forum. Ma anche altro
tipo di DSP: standardizzare durata pause, compressore multibanda, soppressione di
rumore, magari altro che io non so."_

Read before coding — Whisper's own preprocessing, what the model was trained on,
what the transformers.js and whisper.cpp issue trackers say about front-end
filtering, and the published work on noise robustness. Whisper is trained on largely
unfiltered audio, so aggressive filtering can hurt; that is a hypothesis to measure,
not a reason to skip the experiment.

Candidates worth a measured A/B: band limiting matched to what the model expects,
multiband compression, spectral or learned noise suppression, silence and
pause-length normalisation, VAD-driven trimming of dead air. Pause normalisation is
also a latency lever: less audio in, less time spent. So is chunking, so is the
quantisation of the model weights, so is a smaller model that DSP makes viable again
— the 20% is allowed to come from anywhere.

Every variant goes in the variants file, every number in the evidence, and the
shipped configuration is the one the numbers chose.

### Remove the confirmation step

Owner: _"elimina la conferma della trascrizione, come se ci fosse subito confermato
usa testo, è uno step inutile."_ Screenshot: `brief-0.3.0/dictation-review-step.png`.

The transcript goes straight into the field. `DictationPanels`' review branch and its
two buttons come out; the text stays editable, which is what made the review step
redundant. `Scarta` disappears with it, so check that cancelling mid-recording still
works and that the tests, journeys and `dictationState` machine follow — `review` may
stop being a state at all. Undo is the field itself; say so in the page changelog
rather than inventing a new affordance.

## 6. Milestone: the crop editor's remaining two details

Owner: _"per OCR grandi miglioramenti, prima di tutto grafici, rimangono dettagli."_

### 6.1 Edge handles

Sketch: `brief-0.3.0/crop-edge-handles-sketch.png`. Red is what exists — four corner
brackets. Green is what the owner wants added — one handle in the middle of each
edge, to move one side at a time. _"Chiaramente è solo un disegno qualitativo:
dimensioni, colore eccetera devono sempre seguire il design un po' Apple della cosa e
quello che già è fatto, che è positivo."_

`CROP_CORNERS` and `updateNormalizedCrop` in
`src/features/students/StudentScanImageEditorDocument.tsx` and
`studentImageCrop.ts` already model gestures as named handles, so this extends an
existing shape rather than adding a mechanism. Keyboard support exists on the corners
(`moveHandleWithKeyboard`) and must exist on the edges too, with an accessible name
each, and the 44px target rule still applies on a handle drawn much smaller than its
hit area.

### 6.2 Rotation has to follow the finger

Owner: _"quando ruoto l'immagine deve ruotare già durante il drag, non dopo,
altrimenti diventa difficile da usare."_

Diagnosed: the tilt ruler updates state on every pointer move, but the visible bitmap
is regenerated by an effect behind a 120 ms `setTimeout` that the next move event
cancels, so nothing turns until the drag stops. The fix is to separate the two:
transform what is already on screen live — the image and the crop frame together —
and keep the debounced bitmap regeneration for quality after the gesture settles.
Evidence should show the angle tracking the pointer mid-drag, not only the end state.

## 7. Milestone: the LLM-assisted scanning path

The owner's idea, to be built **alongside** the on-device OCR, not instead of it:
photograph the roster, paste it into whatever assistant you already use together with
a prompt copied from inside the app, and paste the assistant's answer back into a
field in the app, which parses it into the same reviewable student list.

Owner's own warning, which is the whole design problem: _"il prompt deve essere
veramente in grado di costringere l'LLM a ritornare un risultato copiabile e sempre
compatibile con il campo da riempire. Spostare la difficoltà di parsare l'immagine a
parsare un output di LLM non deterministico e difficilmente controllabile sarebbe un
autogol che vorrei evitare."_

Therefore the acceptance criteria are about the parser, not the prompt:

- The pasted format is strict, small and self-evident, and the parser is written
  against a specification the app itself states — not inferred from one model's
  habits.
- The parser is tested against deliberately malformed input: prose wrapped around the
  data, a code fence, smart quotes, a trailing apology, a missing column, an invented
  column, a header row, an empty answer. None of it may produce a silently wrong
  student.
- What cannot be parsed is reported to the user as unparsed, with the offending line
  visible and the option to fix it in place.
- Every imported row lands in the same manual review the camera path already
  requires. Nothing enters the course unreviewed.
- The prompt is copyable in one tap from inside the app, and the app never talks to an
  assistant itself. No network call is added.

Both paths stay. The owner said so twice.

## 8. Milestone: the 0.3.0 gate

Owner: _"anche per raggiungimento 0.3.0 servono tutti i test indipendenti, mettilo a
piano."_

So UG2 is an `INTEGRATION_GATE` with the same weight UG1 had: the full deterministic
ladder, a realistic upgraded week, the six independent reviews with zero blockers,
migration proof from both the 0.1.0 and the 0.2.0 fixtures — and the physical-device
checklist that 0.2.0 deferred, now runnable because section 3 gave it a URL.

Test data for that gate, in the owner's words: _"sì, vai con dati tuoi sintetici. Sii
critico nella generazione per avere esempi problematici sia come individui che come
gruppo, coprire i corner case, e esempi anche con tanti allievi, tipo fino a una
quarantina max."_

Generate that roster deliberately hostile: accented and apostrophed names, two
students who differ by one character, a name long enough to break a row, minors either
side of a birthday boundary, a group whose sizes do not divide into the fleet, a course
with more students than seats, forty students. No real people.

Release mechanics repeat section 1.11 at 0.3.0.

## 9. Decisions the owner has already made — do not re-ask

- Physical device checks: deferred to UG2, because the app is not yet reachable from a
  phone. Not waived.
- The two OCR follow-ups still open from UG1 — line fragmentation in the scan, and the
  absence of an automated test over a real photograph: _"la rimandiamo."_ Deferred past
  0.3.0. Keep them recorded in the plan; do not quietly drop them.
- Product name and derived brand mark: _"rinviati, no problem."_
- Known limitations: nothing further to add. _"No."_
- The changelog is not to be sent for approval (section 1.3).
- `Quest` shown beside `Senza barca` on a crew card is intended behaviour, already
  muted in 0.2.0 after the owner said the pairing was unclear.

## 10. Questions left open, and what to do with them

The owner answered everything asked. These are the ones that will surface during the
work; each has a default, so none of them is a reason to stop and wait:

- **Which blue for the icon** (1.5) — take the one the boat marks and the app share,
  and record the choice.
- **Where "legacy" is** (1.7) — a sibling directory outside `.evidence/`, so the
  milestone directories keep meaning what the manifest says. Do not invent a second
  evidence system.
- **Which host** (section 3) — decided by the isolation measurement, not by
  preference. Say what was measured.
- **How far to push DSP before switching levers** (section 5) — the numbers decide. If
  three measured DSP variants do not move WER, say so plainly, as the last round did,
  and spend the remaining effort on the model and on latency.
- **Whether `review` survives as a dictation state** (section 5) — remove it if nothing
  else uses it.

Where a decision changes what the owner sees on screen, record it in
`docs/post-mvp/07_PAGE_CHANGELOG.md` against the page it changes, as every other visual
decision in this repository is recorded.
