// Does this app need cross-origin isolation to open its database?
//
// Desktop Chrome still hands out SharedArrayBuffer without it. Android Chrome
// does not, and neither does iOS Safari. So the desktop result proves nothing
// about the phone, and the question has to be asked under the phone's
// condition: SharedArrayBuffer absent.
//
// This drives the real app in the real browser engines and reports what
// happened. It asserts nothing; the numbers decide. V01 evidence:
// .evidence/V01/isolation-measurement.json
import { createRequire } from "node:module"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const require = createRequire(import.meta.url)
const { chromium, webkit } = require("playwright")

const root = resolve(import.meta.dirname, "..")
const url = process.argv[2] ?? "http://127.0.0.1:5180/"
const READY = "Crea corso"
const BROKEN = "Archivio non disponibile"

/** Remove SharedArrayBuffer before a single line of app code runs. */
const HIDE_SAB = `
  delete globalThis.SharedArrayBuffer;
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    value: false,
    configurable: true,
  });
`

/**
 * What the platform offers a database worker. createSyncAccessHandle is exposed
 * only inside workers in Chromium, so asking on the main thread under-reports
 * it; this asks where a VFS would actually use it, and completes a real write.
 */
const PROBE = `(async () => {
  const source = \`self.onmessage = async () => {
    const out = { hasSharedArrayBuffer: typeof SharedArrayBuffer !== "undefined" };
    out.hasSyncAccessHandle = typeof FileSystemFileHandle !== "undefined"
      && !!FileSystemFileHandle.prototype.createSyncAccessHandle;
    try {
      const dir = await navigator.storage.getDirectory();
      const file = await dir.getFileHandle("__isolation_probe__", { create: true });
      const handle = await file.createSyncAccessHandle();
      handle.write(new TextEncoder().encode("ok"), { at: 0 });
      handle.flush();
      out.syncWrittenBytes = handle.getSize();
      handle.close();
      await dir.removeEntry("__isolation_probe__");
      out.syncAccessWorks = true;
    } catch (error) {
      out.syncAccessWorks = false;
      out.syncAccessError = String(error);
    }
    self.postMessage(out);
  }\`;
  const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(blobUrl);
  const inWorker = await new Promise((done) => {
    worker.onmessage = (event) => done(event.data);
    worker.onerror = (event) => done({ workerError: String(event.message ?? event) });
    worker.postMessage(1);
  });
  worker.terminate();
  URL.revokeObjectURL(blobUrl);
  return {
    crossOriginIsolated: self.crossOriginIsolated,
    mainThread: { hasSharedArrayBuffer: typeof SharedArrayBuffer !== "undefined" },
    inWorker,
    userAgent: navigator.userAgent,
  };
})()`

async function measure(engine, engineName, { hideSharedArrayBuffer }) {
  const browser = await engine.launch()
  const context = await browser.newContext({ locale: "it-IT" })
  if (hideSharedArrayBuffer) await context.addInitScript(HIDE_SAB)
  const page = await context.newPage()
  const consoleErrors = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) =>
    consoleErrors.push(`pageerror: ${error.message}`),
  )

  let databaseOpened
  let visibleOutcome
  let writeSurvivedReload = null
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" })
    const ready = page.getByRole("button", { name: READY })
    const broken = page.getByText(BROKEN)
    const winner = await Promise.race([
      ready.waitFor({ timeout: 45_000 }).then(() => "ready"),
      broken.waitFor({ timeout: 45_000 }).then(() => "broken"),
    ]).catch(() => "timeout")
    visibleOutcome = winner
    databaseOpened = winner === "ready"
  } catch (error) {
    visibleOutcome = `error: ${String(error).split("\n")[0]}`
    databaseOpened = false
  }

  // Reaching the create screen only proves a read. Write a course, reload, and
  // see whether it is still there: that is what "the database works" means.
  if (databaseOpened) {
    try {
      await page.getByRole("button", { name: "Deriva" }).click()
      await page.getByRole("button", { name: "Livello 2" }).click()
      await page.getByRole("button", { name: READY }).click()
      await page
        .getByRole("button", { name: "Allievi" })
        .waitFor({ timeout: 30_000 })
      await page.reload({ waitUntil: "domcontentloaded" })
      await page
        .getByRole("button", { name: "Allievi" })
        .waitFor({ timeout: 30_000 })
      writeSurvivedReload = true
    } catch (error) {
      writeSurvivedReload = false
      visibleOutcome = `${visibleOutcome}; write/reload failed: ${String(error).split("\n")[0]}`
    }
  }

  const platform = await page.evaluate(PROBE).catch((error) => ({
    probeError: String(error).split("\n")[0],
  }))

  await browser.close()
  return {
    engine: engineName,
    sharedArrayBufferHidden: Boolean(hideSharedArrayBuffer),
    databaseOpened,
    writeSurvivedReload,
    visibleOutcome,
    platform,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 8),
  }
}

const runs = []
runs.push(await measure(chromium, "chromium", { hideSharedArrayBuffer: false }))
runs.push(await measure(chromium, "chromium", { hideSharedArrayBuffer: true }))
runs.push(await measure(webkit, "webkit", { hideSharedArrayBuffer: false }))

const withoutSab = runs.find(
  (run) => run.engine === "chromium" && run.sharedArrayBufferHidden,
)
const worked = withoutSab?.databaseOpened && withoutSab?.writeSurvivedReload
const conclusion = worked
  ? "The database opens, takes a write and keeps it across a reload without SharedArrayBuffer, so the app does not need cross-origin isolation and any static host will do."
  : "The database does not work without SharedArrayBuffer, so a phone needs the host to send COOP/COEP — or the storage layer has to stop needing it."

const evidence = {
  milestone: "V01",
  subject: "Does the app need cross-origin isolation to open its database?",
  measuredOn: new Date().toISOString(),
  url,
  method:
    "The real app, driven in Playwright. SharedArrayBuffer is deleted before any app script runs, which is the condition Android Chrome and iOS Safari impose on a page that is not cross-origin isolated. The outcome is what the user sees: the course-creation screen, or the archive-unavailable message.",
  runs,
  conclusion,
}

const directory = resolve(root, ".evidence/V01")
mkdirSync(directory, { recursive: true })
writeFileSync(
  resolve(directory, "isolation-measurement.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
)
console.log(JSON.stringify(evidence, null, 2))
