# Putting the app on the internet

CVC Helper is a local-first PWA with no backend, so deploying it is publishing a
folder of static files over HTTPS. This page says how, how to do it again, and
how to take it down.

Why it matters: a browser will not give a web page the camera or the microphone
over plain HTTP, so the phone checks in `UG1_DEVICE_VALIDATION.md` cannot run
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

`.github/workflows/deploy-pages.yml` builds and publishes on every push to
`main`, and on demand from the Actions tab. To redeploy, push `main`; to
redeploy without a change, run the workflow manually.

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
requests**. The only cross-origin request the app ever makes is the speech model
on first dictation, which predates this milestone and is stated in
`CHANGELOG.md`.

The site is public. Anyone with the URL can open it. Everything they create
stays in their own browser, because there is no backend to send it to.
