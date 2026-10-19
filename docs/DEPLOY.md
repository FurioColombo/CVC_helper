# Putting the app on the internet

CVC Helper is a local-first PWA with no backend, so deploying it is publishing a
folder of static files over HTTPS. This page says how, how to do it again, and
how to take it down.

Why it matters: a browser will not give a web page the camera or the microphone
over plain HTTP, so the phone checks in `docs/DEVICE_CHECKS.md` cannot run
until the app has a trusted HTTPS address. That is what this is for.

## What was measured before choosing a host

`npm run measure:isolation` drives the real app in Chromium and WebKit with
`SharedArrayBuffer` removed before any app code runs — the condition Android
Chrome and iOS Safari impose on a page that is not cross-origin isolated. In
every run the database opened, took a course and kept it across a reload.

So the app does **not** need `Cross-Origin-Opener-Policy` or
`Cross-Origin-Embedder-Policy`. That matters twice over:

- a host that cannot set headers, such as GitHub Pages, is fine;
- `Cross-Origin-Embedder-Policy: require-corp` never applies, so the one
  cross-origin fetch the app makes — the speech model, from huggingface.co on
  first dictation — is not at risk.

The measurement is recorded in `.evidence/V01/isolation-measurement.json`. Re-run
it if the storage layer or the PowerSync version changes; the answer is a
property of that layer, not a fact about the host.

## Where it is

GitHub Pages, from this repository, at

```
https://furiocolombo.github.io/CVC_helper/
```

A project site serves from a subdirectory, so the build is given a base path.
Every asset — the OCR worker and language data, the boat marks, the icons, the
web manifest and the service worker scope — resolves against it. Building
without that base path produces an app that 404s on a project site, which is why
`CVC_BASE_PATH` exists.

## Deploying and redeploying

`.github/workflows/deploy-pages.yml` publishes `main` only after the
deterministic verification workflow (`ci.yml`) has passed on that exact commit,
and first proves the built app works offline at its subpath
(`check:ocr-offline`). A push whose CI fails is not deployed. To redeploy, push
`main` and let CI pass; to redeploy without a change, run the workflow manually
from the Actions tab.

**Only `main` deploys**, and that is not a preference. GitHub's `github-pages`
environment allows the default branch alone unless its deployment-branch rules
are changed, so a run from any other branch builds fine and is then refused at
the publish step with _"Branch X is not allowed to deploy to github-pages due to
environment protection rules"_. That is what happened on the first attempt from
`codex/0.3.0`. Work on a branch, then push `main` when you want the site to
move. The alternative is to allow the working branch in Settings → Environments
→ github-pages → Deployment branches, which is a choice about what `main` means
rather than a technical constraint.

Two settings have to be right, and they are the repository owner's to set:

1. the repository must be **public**, or the account must be on a plan that
   allows Pages from a private repository;
2. **Settings → Pages → Build and deployment → Source** must be **GitHub
   Actions**, not "Deploy from a branch".

Until both are true the workflow runs and the deploy step fails. Nothing else
breaks.

## Preparing the phone-test site

Owner phone checks use GitHub-hosted HTTPS and the familiar installed-app update
flow. Preparing the build and address is agent work; the owner needs no USB,
local server or hosting choice. Notify the owner when the queue item is READY.

The permanent test address is
[**CVC Helper Test**](https://furiocolombo.github.io/CVC_helper_test/), published
from the static-output repository
[FurioColombo/CVC_helper_test](https://github.com/FurioColombo/CVC_helper_test).
The regular app stays at its existing address and its main-only deployment
workflow is unchanged. The two sites share a hostname; the folder alone does
not isolate their data.

The test channel (`CVC_APP_CHANNEL=test`) has its own database
`cvc-helper-test.db`, preference keys, speech-model cache, Workbox cache names,
and OCR language-cache key `cvc-helper-test-ocr/ita.traineddata`,
manifest identity and service-worker scope. The regular channel keeps its
existing names. `npm run check:test-isolation` builds both channels on one origin
and exercises creation, student edits and course erasure through their UI on
Chromium and WebKit, checking the regular course, preferences and offline app
remain intact. Real OCR initializes both library caches; test-key writes and
deletes preserve the regular model bytes under `./ita.traineddata`. The offline proof makes the owned origin unreachable, requires service-worker
responses and confirms uncached requests fail. It avoids a documented
[Playwright WebKit offline-emulation issue](https://github.com/microsoft/playwright/issues/42775);
it does not represent a physical-device test. Its report is
`.evidence/D3/test-isolation.json`. D4's full reset
must use these same channel boundaries, deleting only the selected OCR language
key from Tesseract's shared `keyval-store` rather than deleting that whole store.
`npm run check:test-reset-isolation` extends that production journey with full
test-app reset. It requires the test database, preferences, caches, worker and
OCR key to disappear while the regular course, preferences, cache/model bytes
and offline reopening stay intact. Its D4 report is
`.evidence/D4/test-isolation.json` when deliberately refreshed; ordinary runs
write to ignored `test-results/`.

The repository package remains the released 0.3.0 until UG3; the isolated test
channel explicitly uses the 0.4 patch line, so the owner's one installation
takes every later build as an ordinary update. D3 used **0.4.0** then **0.4.1**
from one verified source; D4 uses **0.4.2** from its own verified checkpoint.
A later minor version is never substituted: the data keeps the newest version
that opened it.

`.milestones/test-site.json` pins one milestone's verified source, its planned
patch versions, the active publication and the build it replaces. Publish
deliberately, after that checkpoint has passed push CI and the milestone's
recorded evidence and reviews:

```text
npm run test-site:publish -- --source <full-verified-checkpoint> --version <pinned patch>
```

The publisher builds an archive of that exact commit, checks the recorder’s
clean checkpoint, unchanged source tree and exact-commit CI, and pushes only
static build outputs. GitHub Pages publishes the test repository's main branch,
with `.nojekyll`. `build-info.json` at the test address identifies source,
version and CI. Ordinary pushes of later work cannot deploy to this repository.
After publishing, verify the live HTTPS app, its identity, persistence and
worker before changing the milestone's owner check to READY with
`owner:update`.

**The installed build stays fixed until its owner check is resolved.**
`scripts/test-site-contract.mjs` refuses any source but the pinned one, any
unplanned or lower version, a pin's second version without the owner's
installation report (recorded in `ownerInstalled` with `reportedBy: owner`,
its source and summary; coordination, not a physical PASS), and a pin that
replaces another milestone's build before that build's owner check has PASSED
or without a higher patch. Announce each publication and its focused steps in
`docs/OWNER_TODO.md` through `owner:update`. The device steps are in
[Updates and versions](./DEVICE_CHECKS.md#updates-and-versions) and
[Course files and full local reset](./DEVICE_CHECKS.md#course-files-and-full-local-reset).

## Building it yourself

```bash
CVC_BASE_PATH=CVC_helper npm run build
```

`dist/` is then a complete site for `https://<host>/CVC_helper/`. Any static
host will serve it. For a host that gives the app the root of a domain, leave
`CVC_BASE_PATH` unset and the base stays `/`.

To check a subpath build locally, serve it the same way it will be served:

```bash
CVC_BASE_PATH=CVC_helper npm run preview
```

`vite preview` reads the same config, so it honours the base path. Note that it
reads `CVC_BASE_PATH` too — a preview started without it serves `dist/` at the
root and every asset 404s, which looks like a broken build and is not one.

## Proving it still works offline

```bash
CVC_BASE_PATH=CVC_helper npm run check:ocr-offline
```

It installs the service worker, goes offline, and completes a first OCR scan from
the precache. It reports the base path it tested, so the result cannot be read as
covering a URL nobody visits.

## Taking it down

Settings → Pages → **Unpublish site**. The site stops being served; the
repository is untouched. Publishing again is one run of the workflow.

To stop it deploying at all without unpublishing, delete
`.github/workflows/deploy-pages.yml` or disable it in the Actions tab.

## What ships, and what does not

The deployed build contains the application and its local assets. It does not
contain course data of any kind: no fixture, no roster, no student. A stranger
who opens the URL gets an empty app.

Nothing was added for the deployment — no analytics, no beacons, no error
reporting. Measured on a cold load through course creation: **zero off-origin
requests**. The only cross-origin request the app ever makes is the Whisper
model weights, from huggingface.co on first dictation, which predates this
milestone and is stated in `CHANGELOG.md`.

The WebAssembly engine that _runs_ that model (`onnxruntime-web`, loaded
through `@huggingface/transformers`) is a separate matter from the model
weights themselves, and is not fetched from anywhere but this origin.
Left to its default, `@huggingface/transformers` fetches its executable
ONNX Runtime `.wasm`/`.mjs` from `cdn.jsdelivr.net` — that would have been a
second cross-origin request, of _executable_ code, on every first dictation
on a cold cache. `src/capabilities/speech.ts` (`configureLocalOnnxRuntime`)
overrides `env.backends.onnx.wasm.wasmPaths` to the same files Vite already
emits into `dist/assets/` for the build, before any inference session is
created, so both the Safari and non-Safari ONNX Runtime variants load
same-origin instead. Verified by recording every request host through a real
first dictation (create a course, open a note, record, stop) against a
`vite preview` build: no request went to `cdn.jsdelivr.net`, and the ONNX
Runtime `.wasm`/`.mjs` came from the preview's own origin. The script and its
request log live under the (git-ignored) `data/private/speech-check/`
directory, not in this repository's history.

The site is public. Anyone with the URL can open it. Everything they create
stays in their own browser, because there is no backend to send it to.
