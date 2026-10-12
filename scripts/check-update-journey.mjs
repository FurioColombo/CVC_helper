import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, extname, join, relative, resolve, sep } from "node:path"

import { chromium, webkit } from "@playwright/test"
import { getAppChannelConfig, parseAppChannel } from "../src/appChannel.ts"

/**
 * D3's success predicate in a real browser: an installed app brought back to
 * the foreground after a deploy offers the update within one minute, without
 * reinstalling, and applies it without losing unsaved work.
 *
 * Version N (the selected channel's baseline) and N+1 (its patch plus one) are
 * built from the current source into two temporary folders and served from ONE
 * origin by a small static server whose root is switched from N to N+1: a
 * service worker belongs to an origin, so a second port would be a second app.
 */

const root = resolve(import.meta.dirname, "..")
const OFFER_LIMIT_SECONDS = 60
// A phone locked for ten minutes: past the 30 s gap between checks
// (src/navigation/updateChecks.ts) and short of the hourly one, so a check that
// follows can only come from the return to the foreground.
const AWAY_MS = 10 * 60 * 1000
const SERVICE_WORKER_PROBE_MS = 15_000

const packageVersion = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
).version
const testJourney = process.argv.slice(2).includes("--test")
const appChannel = parseAppChannel(
  testJourney ? "test" : process.env.CVC_APP_CHANNEL,
)
const installedVersion =
  getAppChannelConfig(appChannel).versionBaseline ?? packageVersion
const [major, minor, patch] = installedVersion.split(".").map(Number)
if (![major, minor, patch].every(Number.isInteger)) {
  throw new Error(`package.json version is not x.y.z: ${installedVersion}`)
}
const deployedVersion = `${major}.${minor}.${patch + 1}`

// The same normalisation as vite.config.ts: the app may be built for a
// subdirectory of its host, where its pages and its service worker live.
const base = (() => {
  const configured = process.env.CVC_BASE_PATH?.trim()
  if (!configured) return appChannel === "test" ? "/CVC_helper_test/" : "/"
  if (configured === "/") return "/"
  return `/${configured.replace(/^\/+|\/+$/g, "")}/`
})()

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gz": "application/gzip",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
}

const workspace = mkdtempSync(join(tmpdir(), "cvc-update-journey-"))
const folders = {
  [installedVersion]: join(workspace, "installed"),
  [deployedVersion]: join(workspace, "deployed"),
}

/** One production build of the current source, labelled with `version`. */
function build(version) {
  return new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [
        resolve(root, "node_modules/vite/bin/vite.js"),
        "build",
        "--outDir",
        folders[version],
        "--emptyOutDir",
        "--logLevel",
        "warn",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          CVC_APP_CHANNEL: appChannel,
          CVC_APP_VERSION: version,
          CVC_BASE_PATH: base,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    let output = ""
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    child.on("error", fail)
    child.on("close", (code) =>
      code === 0
        ? done()
        : fail(
            new Error(`vite build failed for version ${version}:\n${output}`),
          ),
    )
  })
}

/**
 * One origin, one folder at a time. The page and the service worker are served
 * without caching so the browser sees the new worker at once; hashed assets are
 * cacheable, as on any static host.
 */
function startServer(initialVersion) {
  let version = initialVersion
  const workerRequests = []
  const server = createServer((request, response) => {
    void serve(request, response).catch(() => {
      response.statusCode = 500
      response.end()
    })
  })

  async function serve(request, response) {
    const { pathname } = new URL(request.url ?? "/", "http://localhost")
    if (!pathname.startsWith(base)) return notFound(response)
    let relative = decodeURIComponent(pathname.slice(base.length))
    if (relative === "" || relative.endsWith("/")) relative += "index.html"
    const folder = folders[version]
    const file = resolve(folder, relative)
    if (
      !file.startsWith(folder + sep) ||
      !existsSync(file) ||
      !statSync(file).isFile()
    ) {
      return notFound(response)
    }
    if (relative === "sw.js") {
      workerRequests.push({ version, at: performance.now() })
    }
    response.setHeader(
      "Content-Type",
      CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    )
    response.setHeader(
      "Cache-Control",
      relative.startsWith("assets/")
        ? "public, max-age=31536000, immutable"
        : "no-store",
    )
    response.end(await readFile(file))
  }

  function notFound(response) {
    response.statusCode = 404
    response.end()
  }

  return new Promise((resolveStart) => {
    server.listen(0, "127.0.0.1", () => {
      resolveStart({
        url: `http://127.0.0.1:${server.address().port}${base}`,
        workerRequests,
        switchTo(next) {
          version = next
        },
        async close() {
          server.closeAllConnections()
          await new Promise((done) => server.close(done))
        },
      })
    })
  })
}

const bottomNavigation = (page) =>
  page.getByRole("navigation", { name: "Navigazione principale" })

const goHome = (page) =>
  bottomNavigation(page).getByRole("button", { name: "Home" }).click()

/** Reads the version row of Impostazioni, then returns to Home. */
async function versionInSettings(page) {
  await goHome(page)
  await page.getByRole("button", { name: "Impostazioni", exact: true }).click()
  const shown = await page
    .locator("dt", { hasText: /^Versione$/ })
    .locator("xpath=following-sibling::dd")
    .innerText()
  await page.getByRole("button", { name: "Torna alla Home" }).click()
  return shown.trim()
}

async function createCourseAndStudent(page) {
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill("Rossi")
  await page
    .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
    .fill("16")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

/**
 * How far a floating control sits above the update banner (UG2-UX-3, rulebook
 * R12): the banner publishes its height and these controls rise by it. Both
 * are fixed to the viewport, so their boxes share one coordinate system.
 */
async function clearanceAboveBanner(page, name, control) {
  const banner = page
    .getByRole("status")
    .filter({ hasText: "Nuova versione disponibile" })
  const [controlBox, bannerBox] = await Promise.all([
    control.boundingBox(),
    banner.boundingBox(),
  ])
  if (!controlBox || !bannerBox) {
    throw new Error(`${name} or the update banner is not on screen`)
  }
  const controlBottom = controlBox.y + controlBox.height
  const overlapWidth =
    Math.min(controlBox.x + controlBox.width, bannerBox.x + bannerBox.width) -
    Math.max(controlBox.x, bannerBox.x)
  const overlapHeight =
    Math.min(controlBottom, bannerBox.y + bannerBox.height) -
    Math.max(controlBox.y, bannerBox.y)
  const measured = {
    controlBottom: Number(controlBottom.toFixed(2)),
    bannerTop: Number(bannerBox.y.toFixed(2)),
    clearancePx: Number((bannerBox.y - controlBottom).toFixed(2)),
    overlapsBanner: overlapWidth > 0 && overlapHeight > 0,
  }
  if (measured.clearancePx < 0 || measured.overlapsBanner) {
    throw new Error(
      `${name} reaches the update banner: ${JSON.stringify(measured)}`,
    )
  }
  return measured
}

/**
 * Whether a tap on the centre of each of the offer's buttons reaches that
 * button, and not a control drawn over it (D3 reviews RH-2, RH-3, FU-1).
 */
async function offerButtonsTappable(page, name) {
  const banner = page
    .getByRole("status")
    .filter({ hasText: "Nuova versione disponibile" })
  const results = await banner.getByRole("button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect()
      const hit = globalThis.document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      )
      return {
        button: button.textContent.trim(),
        reached: Boolean(hit && button.contains(hit)),
      }
    }),
  )
  const covered = results.filter(({ reached }) => !reached)
  if (results.length === 0 || covered.length > 0) {
    throw new Error(
      `${name}: the offer's buttons are covered: ${JSON.stringify(results)}`,
    )
  }
  return results.map(({ button }) => button)
}

/**
 * The screens the reviewers found the crew rail on the bar with (D3 reviews
 * RH-2, FU-5, FU-9): short, narrow, and with enlarged text, as the root font
 * size the phone's text setting scales. The measures above run at 390x844.
 * Each is measured with the page at its top, as a screen opens, except 200%
 * text on 320 px: there the bar and the navigation leave the page about a
 * quarter of the screen, so the page scrolls, as the rulebook allows for this
 * profile ("320 CSS px di larghezza e testo 200%"), and the controls are
 * measured where that scroll ends.
 */
const STRESS_PROFILES = [
  { width: 320, height: 568, text: 1, at: "top" },
  { width: 360, height: 640, text: 1.3, at: "top" },
  { width: 390, height: 844, text: 1.5, at: "top" },
  { width: 430, height: 820, text: 1.5, at: "top" },
  { width: 320, height: 664, text: 2, at: "end" },
]

/** Two frames: the bar republishes its height, the layout follows. */
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        globalThis.requestAnimationFrame(() =>
          globalThis.requestAnimationFrame(done),
        ),
      ),
  )

/**
 * On each stress profile: each control clear of the offer, and the offer's
 * buttons tappable. Returns each control's clearance.
 */
async function underStress(page, name, controls) {
  const measured = []
  const setText = (size) =>
    page.evaluate((value) => {
      globalThis.document.documentElement.style.fontSize = value
    }, size)
  for (const { width, height, text, at } of STRESS_PROFILES) {
    const profile = `${name} at ${width}x${height}, text ${text * 100}%`
    await page.setViewportSize({ width, height })
    await setText(`${text * 100}%`)
    await settle(page)
    await page.evaluate(
      (top) =>
        globalThis.scrollTo(
          0,
          top ? 0 : globalThis.document.documentElement.scrollHeight,
        ),
      at === "top",
    )
    await settle(page)
    const clearancePx = {}
    for (const [label, control] of controls) {
      clearancePx[label] = (
        await clearanceAboveBanner(page, `${profile}: ${label}`, control)
      ).clearancePx
    }
    await offerButtonsTappable(page, profile)
    measured.push({ width, height, text, at, clearancePx })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await setText("")
  await page.evaluate(() => globalThis.scrollTo(0, 0))
  await settle(page)
  return measured
}

/**
 * Moves the page between foreground and background the way the browser does:
 * the state the app reads, then the event it listens to.
 */
function setVisibility(page, state) {
  // Run in the page; `globalThis` is its `window`, which this Node file's lint
  // configuration does not declare.
  return page.evaluate((next) => {
    const { document } = globalThis
    for (const property of ["visibilityState", "hidden"]) {
      Object.defineProperty(document, property, {
        configurable: true,
        get: () => (property === "hidden" ? next === "hidden" : next),
      })
    }
    document.dispatchEvent(new Event("visibilitychange"))
  }, state)
}

/** The page, as an installed app that has just been reopened. */
async function openInstalledApp(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" })
  if (!(await page.evaluate(() => "serviceWorker" in navigator))) return false
  const ready = await Promise.race([
    page.evaluate(async () => {
      await navigator.serviceWorker.ready
      return true
    }),
    new Promise((done) =>
      setTimeout(() => done(false), SERVICE_WORKER_PROBE_MS),
    ),
  ])
  if (!ready) return false
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  return true
}

const stage = (engine, message) => console.log(`[${engine}] ${message}`)

async function runJourney(engine, browserType, server, screenshots) {
  const browser = await browserType.launch()
  try {
    const context = await browser.newContext({
      locale: "it-IT",
      serviceWorkers: "allow",
      viewport: { width: 390, height: 844 },
    })
    // Installed before the first navigation, so the page's clock is the test's
    // to move: `Date.now()` is what the app measures its 30 s gap with, and a
    // real wait of that length would only slow the check down.
    await context.clock.install({ time: new Date() })
    const page = await context.newPage()
    page.setDefaultTimeout(30_000)

    if (!(await openInstalledApp(page, server.url))) {
      return {
        engine,
        skipped:
          "service workers are not available in this browser build, so an installed app cannot be exercised",
      }
    }
    const browserVersion = browser.version()
    stage(engine, `installed ${installedVersion}, service worker in control`)

    await createCourseAndStudent(page)
    const shownBefore = await versionInSettings(page)
    if (shownBefore !== installedVersion) {
      throw new Error(
        `Impostazioni showed ${shownBefore} before the update, expected ${installedVersion}`,
      )
    }

    const openStudentEdit = async () => {
      await goHome(page)
      await page.getByRole("button", { name: "Allievi", exact: true }).click()
      await page.getByRole("button", { name: /^Mario,/ }).click()
      await page.getByRole("button", { name: "Modifica allievo" }).click()
    }
    await openStudentEdit()
    const initialNote = page.getByRole("textbox", { name: "Nota iniziale" })
    const courseNote = page.getByRole("textbox", { name: "Nota del corso" })
    const firstText = "Scritta prima del rilascio"
    const secondText = "Scritta mentre arriva l’aggiornamento"
    await initialNote.fill(firstText)
    // The form saves 500 ms after the last keystroke; this note is saved.
    await page.getByText("Salvato", { exact: true }).waitFor()

    // The app goes to the background, and the new version is deployed.
    await setVisibility(page, "hidden")
    server.switchTo(deployedVersion)
    await page.clock.fastForward(AWAY_MS)
    const quiet = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      return !registration?.installing && !registration?.waiting
    })
    if (
      !quiet ||
      (await page.getByText("Nuova versione disponibile").count())
    ) {
      throw new Error("An update was offered before the app came back")
    }
    const requestsBefore = server.workerRequests.length

    // Back to the foreground: the clock starts at the event.
    const startedAt = performance.now()
    await setVisibility(page, "visible")
    await page
      .getByText("Nuova versione disponibile")
      .waitFor({ timeout: OFFER_LIMIT_SECONDS * 1000 })
      .catch(() => {
        throw new Error(
          `No update was offered within ${OFFER_LIMIT_SECONDS} s of the return to the foreground`,
        )
      })
    const seconds = (performance.now() - startedAt) / 1000
    if (seconds >= OFFER_LIMIT_SECONDS) {
      throw new Error(
        `The update was offered ${seconds.toFixed(1)} s after the return, over ${OFFER_LIMIT_SECONDS} s`,
      )
    }
    // The page asked the server for the worker after the return, and got the
    // new one: the return, not a timer or a navigation, started the check.
    const workerRequest = server.workerRequests
      .slice(requestsBefore)
      .find(({ version }) => version === deployedVersion)
    if (!workerRequest) {
      throw new Error("The offer did not come from a fresh worker request")
    }
    stage(engine, `update offered ${seconds.toFixed(2)} s after the return`)
    await page.screenshot({
      path: join(screenshots, `update-offer-${engine}.png`),
    })

    // The floating controls stay clear of the banner while it is shown.
    // Crew page: the bar that appears when a person is picked up to be moved.
    await bottomNavigation(page)
      .getByRole("button", { name: "Equipaggi" })
      .click()
    await page.getByRole("button", { name: "Crea equipaggi" }).click()
    // The quick-access rail (A terra, Collocati, Volontari), the bar UG2-UX-3
    // named, and the offer's buttons tapped over it.
    const crewRail = page.getByRole("navigation", {
      name: "Accesso rapido equipaggi",
    })
    await crewRail.waitFor()
    const crewRailClearance = await clearanceAboveBanner(
      page,
      "The crew page's quick-access rail",
      crewRail,
    )
    await offerButtonsTappable(page, "Crew page")
    const crewStress = await underStress(page, "Crew page", [
      ["quick-access rail", crewRail],
    ])
    await page
      .getByRole("region", { name: "Allievi disponibili" })
      .getByRole("button", { name: "Mario", exact: true })
      .click()
    const crewBar = page.getByRole("region", {
      name: "Destinazione persona selezionata",
    })
    await crewBar.waitFor()
    const crewBarClearance = await clearanceAboveBanner(
      page,
      "The crew page's destination panel",
      crewBar,
    )
    const crewSelectedStress = await underStress(
      page,
      "Crew page with a person selected",
      [
        ["quick-access rail", crewRail],
        ["destination panel", crewBar],
      ],
    )
    // Allievi list: the round add button.
    await goHome(page)
    await page.getByRole("button", { name: "Allievi", exact: true }).click()
    const addStudent = page.getByRole("button", { name: "Aggiungi allievo" })
    await addStudent.waitFor()
    const addButtonClearance = await clearanceAboveBanner(
      page,
      "The Allievi add button",
      addStudent,
    )
    await offerButtonsTappable(page, "Allievi")
    const addStudentStress = await underStress(page, "Allievi", [
      ["add button", addStudent],
    ])

    // A start or reload that finds the update already waiting shows the offer
    // above the navigation, drawn after the offer was known (D3 review RH-3).
    await page.reload({ waitUntil: "domcontentloaded" })
    await page
      .getByRole("status")
      .filter({ hasText: "Nuova versione disponibile" })
      .waitFor()
    await bottomNavigation(page).waitFor()
    await offerButtonsTappable(page, "After a reload")

    // Work typed while the offer is on screen. The clock is stopped so the
    // 500 ms wait before the form saves cannot run out: the note is certainly
    // still unsaved when the update is tapped, and it is the leave guard (with
    // the form's own flush as the last resort) that has to save it.
    await openStudentEdit()
    const now = await page.evaluate(() => Date.now())
    await page.clock.pauseAt(now + 1000)
    await courseNote.fill(secondText)
    await page.getByText("Salvataggio…").first().waitFor()
    if (await page.getByText("Salvato", { exact: true }).count()) {
      throw new Error("The second note was saved before the update was tapped")
    }
    // A reload loses this marker: it is how the page is known to have reloaded.
    await page.evaluate(() => {
      globalThis.__beforeUpdate = true
    })
    await page
      .getByRole("button", { name: "Aggiorna CVC Helper alla nuova versione" })
      .click()
    await page.waitForFunction(() => globalThis.__beforeUpdate === undefined)
    await page.clock.resume()
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    )
    stage(engine, "page reloaded into the new version")

    // What the profile shows was read from the database after the reload.
    await goHome(page)
    await page
      .getByText(`CVC Helper è aggiornata alla versione ${deployedVersion}.`)
      .waitFor()
    await page.getByRole("button", { name: "Allievi", exact: true }).click()
    await page.getByRole("button", { name: /^Mario,/ }).click()
    const editSurvived =
      (await page.getByText(firstText).count()) > 0 &&
      (await page.getByText(secondText).count()) > 0
    if (!editSurvived) {
      throw new Error(
        "A note typed before the update is missing from the student after it",
      )
    }

    const shownAfter = await versionInSettings(page)
    if (shownAfter !== deployedVersion) {
      throw new Error(
        `Impostazioni showed ${shownAfter} after the update, expected ${deployedVersion}`,
      )
    }

    // No update loop: the new app asks again and finds nothing newer.
    await page
      .getByRole("button", { name: "Impostazioni", exact: true })
      .click()
    await page.getByRole("button", { name: "Cerca aggiornamenti" }).click()
    await page
      .getByText("Nessuna versione più recente disponibile ora.")
      .waitFor()
    if (await page.getByText("Nuova versione disponibile").count()) {
      throw new Error("The app offered an update again after applying it")
    }

    await context.close()
    return {
      engine,
      browserVersion,
      secondsFromForegroundToWorkerRequest: Number(
        ((workerRequest.at - startedAt) / 1000).toFixed(3),
      ),
      secondsFromForegroundToOffer: Number(seconds.toFixed(2)),
      editSurvived,
      versionShownAfterUpdate: shownAfter,
      updatedNoteShown: true,
      noUpdateOfferedAfterwards: true,
      bannerClearance: {
        addStudentButton: addButtonClearance,
        crewQuickAccessRail: crewRailClearance,
        crewDestinationPanel: crewBarClearance,
      },
      offerButtonsTappable: ["crew page", "Allievi", "after a reload"],
      underStress: {
        crewPage: crewStress,
        crewPageWithSelection: crewSelectedStress,
        addStudentButton: addStudentStress,
      },
    }
  } finally {
    await browser.close()
  }
}

const screenshots = resolve(root, "test-results/d3-update-journey")
mkdirSync(screenshots, { recursive: true })
let server
const runs = []
try {
  console.log(`Building ${installedVersion} and ${deployedVersion}…`)
  await Promise.all([build(installedVersion), build(deployedVersion)])

  for (const [engine, browserType] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ]) {
    server = await startServer(installedVersion)
    try {
      const run = await runJourney(engine, browserType, server, screenshots)
      if (run.skipped) console.log(`[${engine}] skipped: ${run.skipped}`)
      runs.push(run)
    } finally {
      await server.close()
      server = undefined
    }
  }

  const done = runs.filter(({ skipped }) => !skipped)
  if (!done.some(({ engine }) => engine === "chromium")) {
    throw new Error("The Chromium journey did not run")
  }

  const evidence = {
    milestone: "D3",
    recordedAt: new Date().toISOString(),
    source: `scripts/check-update-journey.mjs (npm run ${testJourney ? "check:update:test" : "check:update"})`,
    base,
    installedVersion,
    deployedVersion,
    limitSeconds: OFFER_LIMIT_SECONDS,
    runs,
  }
  const evidenceFile =
    process.env.CVC_EVIDENCE_REFRESH === "D3"
      ? resolve(root, ".evidence/D3/browser-evidence.json")
      : resolve(screenshots, "browser-evidence.json")
  mkdirSync(dirname(evidenceFile), { recursive: true })
  writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`)

  console.log(
    `PASS: ${done
      .map(
        ({ engine, secondsFromForegroundToOffer }) =>
          `${engine} ${secondsFromForegroundToOffer} s`,
      )
      .join(
        ", ",
      )} from the return to the offer (${installedVersion} to ${deployedVersion}); the typed notes survived the update`,
  )
} catch (error) {
  console.error(
    `FAIL: ${error instanceof Error ? (error.stack ?? error.message) : error}`,
  )
  process.exitCode = 1
} finally {
  await server?.close()
  const allowedTempRoot = resolve(tmpdir())
  const cleanupTarget = resolve(workspace)
  const cleanupRelative = relative(allowedTempRoot, cleanupTarget)
  assert.ok(
    cleanupRelative &&
      cleanupRelative !== ".." &&
      !cleanupRelative.startsWith(`..${sep}`),
    `Refusing to remove a path outside the temporary directory: ${cleanupTarget}`,
  )
  rmSync(cleanupTarget, { force: true, recursive: true })
}
