import { PowerSyncDatabase, type Schema } from "@powersync/web"

import { DUTY_SETTING_LISTS, SESSION_SEQUENCE } from "@/domain/config"
import {
  applyMigration,
  prepareDatabase,
  runMigrations,
  type Migration,
} from "@/persistence/migrations"
import { repairRows } from "@/persistence/repairs"
import {
  validateStoredRows,
  type RowIssue,
  type StoredTables,
} from "@/persistence/rowIntegrity"
import { COURSE_TABLES, createDatabase } from "@/persistence/schema"
import v010 from "@/test/fixtures/v0.1.0-course.json"
import v020 from "@/test/fixtures/v0.2.0-course.json"
import v030 from "@/test/fixtures/v0.3.0-course.json"
import {
  insertFixtureTables,
  seedLegacyFixture,
  type FixtureTables,
} from "@/test/legacySeed"
import { v020Schema } from "@/test/v020Schema"
import { v030Schema } from "@/test/v030Schema"

/**
 * Browser-only proof of D1 on the real PowerSync engine: a course written by
 * 0.1.0, 0.2.0 or 0.3.0 opens through the production boundary
 * (`prepareDatabase`) with every row, id and value intact plus complete record
 * metadata and course ownership; an interruption inside the repairs or a
 * migration leaves nothing half done; the migration ledger survives an older
 * app opening the same database, and the repairs restore what that app strips
 * or leaves out.
 */

type Version = "0.1.0" | "0.2.0" | "0.3.0"
const FIXTURES: Record<Version, FixtureTables> = {
  "0.1.0": v010.tables as FixtureTables,
  "0.2.0": v020.tables as FixtureTables,
  "0.3.0": v030.tables as FixtureTables,
}
const SCHEMAS: Partial<Record<Version, Schema>> = {
  "0.2.0": v020Schema,
  "0.3.0": v030Schema,
}

/** Write a fixture with its own version's schema, then close the file. */
export async function seed(
  version: Version,
  filename: string,
  tables: FixtureTables = FIXTURES[version],
) {
  if (version === "0.1.0") return seedLegacyFixture(filename)
  const legacy = new PowerSyncDatabase({
    schema: SCHEMAS[version]!,
    database: { dbFilename: filename },
  })
  await legacy.init()
  await insertFixtureTables(legacy, tables)
  // Read before closing: closing straight after a write lost WebKit's test
  // page now and then (D2 review DP-4).
  await legacy.get("SELECT count(*) AS count FROM courses")
  await legacy.close()
}

async function readTables(database: PowerSyncDatabase): Promise<StoredTables> {
  const tables: StoredTables = {}
  for (const table of COURSE_TABLES) {
    tables[table] = await database.getAll(`SELECT * FROM ${table} ORDER BY id`)
  }
  return tables
}

async function ledger(database: PowerSyncDatabase) {
  return database.getAll<{ id: string; value: number }>(
    "SELECT id, value FROM meta WHERE id LIKE 'migration:%' ORDER BY id",
  )
}

async function probes(database: PowerSyncDatabase) {
  return (
    await database.getAll<{ id: string }>(
      "SELECT id FROM meta WHERE id LIKE 'probe:%' ORDER BY id",
    )
  ).map((row) => row.id)
}

interface WorkerInitDiagnostic {
  workerId: string
  stage: string
  workerElapsedMs?: number
  pageReceivedAtMs: number
  durationMs?: number
  waitMs?: number
  category?: string
  messageCount?: number
  transferSize?: number
}

/**
 * Test-only worker shim for locating slow adapter initialization. The SDK's
 * normal worker entry still runs unchanged; the bootstrap wraps browser APIs
 * before importing it and reports timings over an isolated BroadcastChannel.
 */
function captureWorkerInitDiagnostics() {
  const channelName = `d1-init-${crypto.randomUUID()}`
  const channel = new BroadcastChannel(channelName)
  const events: WorkerInitDiagnostic[] = []
  const wrapperUrls = new Map<string, () => void>()
  const originalWorker = globalThis.Worker
  const lockManager = globalThis.navigator.locks
  const originalLockDescriptor = Object.getOwnPropertyDescriptor(
    lockManager,
    "request",
  )
  const originalLockRequest = lockManager.request.bind(lockManager)
  const recordEvent = (
    event: Omit<WorkerInitDiagnostic, "pageReceivedAtMs">,
  ) => {
    const captured = {
      ...event,
      pageReceivedAtMs: Math.round(performance.now()),
    }
    events.push(captured)
    console.info(`D1_INIT_STAGE:${JSON.stringify(captured)}`)
  }

  try {
    Object.defineProperty(lockManager, "request", {
      configurable: true,
      writable: true,
      value: (...incoming: unknown[]) => {
        const started = performance.now()
        const args = [...incoming]
        const callbackIndex = typeof args[1] === "function" ? 1 : 2
        const callback = args[callbackIndex]
        if (typeof callback === "function") {
          const name = String(args[0])
          const category = name.startsWith("tab-close-signal-")
            ? "tab-close-signal"
            : name === "open-wasqlite-db"
              ? "powersync-open"
              : name.startsWith("db-lock-")
                ? "sqlite-database"
                : name.startsWith("lock##")
                  ? "sqlite-vfs"
                  : "other"
          args[callbackIndex] = (lock: Lock | null) => {
            recordEvent({
              workerId: "page",
              stage: "page-weblock-granted",
              category,
              waitMs: Math.round((performance.now() - started) * 100) / 100,
            })
            return Reflect.apply(callback, undefined, [lock])
          }
        }
        return Reflect.apply(originalLockRequest, lockManager, args)
      },
    })
  } catch {
    recordEvent({
      workerId: "page",
      stage: "page-weblock-instrumentation-unavailable",
    })
  }

  channel.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as Partial<WorkerInitDiagnostic> | undefined
    if (
      !data ||
      typeof data.workerId !== "string" ||
      typeof data.stage !== "string"
    ) {
      return
    }
    if (data.stage === "worker-bootstrap-ready") {
      wrapperUrls.get(data.workerId)?.()
    }
    recordEvent({
      workerId: data.workerId,
      stage: data.stage,
      ...(typeof data.workerElapsedMs === "number"
        ? { workerElapsedMs: data.workerElapsedMs }
        : {}),
      ...(typeof data.durationMs === "number"
        ? { durationMs: data.durationMs }
        : {}),
      ...(typeof data.waitMs === "number" ? { waitMs: data.waitMs } : {}),
      ...(typeof data.category === "string" ? { category: data.category } : {}),
      ...(typeof data.messageCount === "number"
        ? { messageCount: data.messageCount }
        : {}),
      ...(typeof data.transferSize === "number"
        ? { transferSize: data.transferSize }
        : {}),
    })
  })

  const diagnosticWorker = new Proxy(originalWorker, {
    construct(target, args) {
      const scriptUrl = String(args[0])
      const options = args[1] as WorkerOptions | undefined
      const workerId = crypto.randomUUID()
      recordEvent({
        workerId,
        stage: "worker-created",
      })
      const source = `
        const channel = new BroadcastChannel(${JSON.stringify(channelName)});
        const workerId = ${JSON.stringify(workerId)};
        const now = () => performance.now();
        const send = (stage, fields = {}) => channel.postMessage({
          workerId,
          stage,
          workerElapsedMs: Math.round(now() * 100) / 100,
          ...fields
        });
        const elapsed = (started) => Math.round((now() - started) * 100) / 100;
        const lockCategory = (name) => {
          const value = String(name);
          if (value === "open-wasqlite-db") return "powersync-open";
          if (value.startsWith("tab-close-signal-")) return "tab-close-signal";
          if (value.startsWith("db-lock-")) return "sqlite-database";
          if (value.startsWith("lock##")) return "sqlite-vfs";
          return "other";
        };

        try {
          const originalFetch = globalThis.fetch.bind(globalThis);
          Object.defineProperty(globalThis, "fetch", {
            configurable: true,
            writable: true,
            value: (...args) => {
              const started = now();
              return originalFetch(...args).then((response) => {
                const contentType = response.headers.get("content-type") || "";
                let sameOriginWasm = false;
                try {
                  sameOriginWasm =
                    new URL(response.url).origin === globalThis.location.origin &&
                    contentType.toLowerCase().includes("application/wasm");
                } catch {
                  // Opaque or invalid response URLs carry no timing category.
                }
                if (sameOriginWasm) {
                  send("wasm-fetch-response", {
                    durationMs: elapsed(started),
                    category: "same-origin-wasm"
                  });
                }
                return response;
              });
            }
          });
        } catch {
          send("fetch-instrumentation-unavailable");
        }

        const reportedWasmResources = new Set();
        const reportWasmResourceTimings = () => {
          try {
            const entries = globalThis.performance.getEntriesByType("resource");
            for (const entry of entries) {
              const resource = entry;
              if (!(resource.responseEnd > 0)) continue;
              const url = new URL(resource.name, globalThis.location.href);
              if (
                url.origin !== globalThis.location.origin ||
                !url.pathname.toLowerCase().endsWith(".wasm") ||
                reportedWasmResources.has(resource.name)
              ) continue;
              reportedWasmResources.add(resource.name);
              send("wasm-fetch-body-ready", {
                durationMs: Math.round((resource.responseEnd - resource.fetchStart) * 100) / 100,
                waitMs: Math.round((resource.responseEnd - resource.responseStart) * 100) / 100,
                transferSize: Number.isFinite(resource.transferSize) ? resource.transferSize : undefined,
                category: "same-origin-wasm"
              });
            }
          } catch {
            send("wasm-resource-timing-unavailable");
          }
        };

        try {
          const idb = globalThis.indexedDB;
          const originalOpen = idb.open.bind(idb);
          Object.defineProperty(idb, "open", {
            configurable: true,
            writable: true,
            value: (...args) => {
              const started = now();
              const request = originalOpen(...args);
              request.addEventListener("blocked", () => {
                send("indexeddb-open-blocked", { waitMs: elapsed(started) });
              });
              request.addEventListener("success", () => {
                send("indexeddb-open-success", { durationMs: elapsed(started) });
              });
              request.addEventListener("error", () => {
                send("indexeddb-open-error", { durationMs: elapsed(started) });
              });
              return request;
            }
          });
        } catch {
          send("indexeddb-instrumentation-unavailable");
        }

        try {
          const lockManager = globalThis.navigator.locks;
          const originalRequest = lockManager.request.bind(lockManager);
          Object.defineProperty(lockManager, "request", {
            configurable: true,
            writable: true,
            value: (...incoming) => {
              const started = now();
              const args = [...incoming];
              const callbackIndex = typeof args[1] === "function" ? 1 : 2;
              const callback = args[callbackIndex];
              if (typeof callback === "function") {
                const category = lockCategory(args[0]);
                args[callbackIndex] = (lock) => {
                  send("weblock-granted", {
                    category,
                    waitMs: elapsed(started)
                  });
                  return callback(lock);
                };
              }
              const request = originalRequest(...args);
              return request.catch((error) => {
                send("weblock-error", {
                  category: lockCategory(args[0]),
                  waitMs: elapsed(started)
                });
                throw error;
              });
            }
          });
        } catch {
          send("weblock-instrumentation-unavailable");
        }

        try {
          const wasm = globalThis.WebAssembly;
          for (const method of ["compile", "compileStreaming", "instantiate", "instantiateStreaming"]) {
            if (typeof wasm[method] !== "function") continue;
            const original = wasm[method].bind(wasm);
            Object.defineProperty(wasm, method, {
              configurable: true,
              writable: true,
              value: (...args) => {
                const started = now();
                let result;
                try {
                  result = original(...args);
                } catch (error) {
                  send("wasm-error", { category: method, durationMs: elapsed(started) });
                  throw error;
                }
                return Promise.resolve(result).then(
                  (value) => {
                    send("wasm-complete", { category: method, durationMs: elapsed(started) });
                    if (method === "instantiateStreaming") reportWasmResourceTimings();
                    return value;
                  },
                  (error) => {
                    send("wasm-error", { category: method, durationMs: elapsed(started) });
                    throw error;
                  }
                );
              }
            });
          }
        } catch {
          send("wasm-instrumentation-unavailable");
        }

        const bufferedMessages = [];
        const captureEarlyMessage = (event) => {
          event.stopImmediatePropagation();
          bufferedMessages.push({
            data: event.data,
            ports: Array.from(event.ports),
            origin: event.origin,
            lastEventId: event.lastEventId,
            source: event.source
          });
          send("worker-message-buffered", { category: "comlink" });
        };
        self.addEventListener("message", captureEarlyMessage, true);
        let entryImported = false;
        send("worker-bootstrap-ready");
        try {
          await import(${JSON.stringify(scriptUrl)});
          entryImported = true;
          send("worker-entry-evaluated");
        } catch (error) {
          send("worker-entry-import-error", {
            category: error instanceof Error ? error.name : "unknown"
          });
          throw error;
        } finally {
          self.removeEventListener("message", captureEarlyMessage, true);
          if (entryImported) {
            for (const message of bufferedMessages) {
              self.dispatchEvent(new MessageEvent("message", message));
            }
            send("worker-message-buffer-replayed", {
              category: "comlink",
              messageCount: bufferedMessages.length
            });
          }
        }
      `
      const wrapperUrl = URL.createObjectURL(
        new Blob([source], { type: "text/javascript" }),
      )
      const worker = Reflect.construct(
        target,
        [wrapperUrl, options],
        target,
      ) as Worker
      const revoke = () => {
        if (wrapperUrls.has(workerId)) {
          URL.revokeObjectURL(wrapperUrl)
          wrapperUrls.delete(workerId)
        }
      }
      wrapperUrls.set(workerId, revoke)
      worker.addEventListener("error", revoke, { once: true })
      const terminate = worker.terminate.bind(worker)
      worker.terminate = () => {
        recordEvent({
          workerId,
          stage: "worker-terminate-called",
        })
        revoke()
        terminate()
      }
      return worker
    },
  })

  globalThis.Worker = diagnosticWorker
  return {
    events,
    restore() {
      globalThis.Worker = originalWorker
      if (originalLockDescriptor) {
        Object.defineProperty(lockManager, "request", originalLockDescriptor)
      } else {
        Reflect.deleteProperty(lockManager, "request")
      }
    },
    async finish() {
      await new Promise((resolve) => setTimeout(resolve, 0))
      globalThis.Worker = originalWorker
      if (originalLockDescriptor) {
        Object.defineProperty(lockManager, "request", originalLockDescriptor)
      } else {
        Reflect.deleteProperty(lockManager, "request")
      }
      for (const revoke of wrapperUrls.values()) revoke()
      channel.close()
    },
  }
}

/**
 * Synthetic migrations: the shipped list is empty until D2, and the ledger is
 * proved on the real engine all the same. Each leaves a `probe:` row in `meta`
 * so a test can count how often it ran.
 */
const probeMigration = (name: string): Migration => ({
  id: `test-${name}`,
  async run(transaction) {
    await transaction.execute("INSERT INTO meta(id, value) VALUES (?, ?)", [
      `probe:${name}`,
      1,
    ])
  },
})

/** Every fixture value that differs in the stored row, as "table:id.column". */
function changedValues(version: Version, tables: StoredTables) {
  const changes: string[] = []
  let rows = 0
  for (const [table, fixtureRows] of Object.entries(FIXTURES[version])) {
    if (!(table in tables)) continue
    for (const original of fixtureRows) {
      rows += 1
      const stored = tables[table]!.find((row) => row.id === original.id)
      if (!stored) {
        changes.push(`${table}:${String(original.id)} missing`)
        continue
      }
      for (const [column, value] of Object.entries(original)) {
        if (stored[column] !== value) {
          changes.push(`${table}:${String(original.id)}.${column}`)
        }
      }
    }
  }
  const counts = Object.fromEntries(
    Object.entries(tables).map(([table, list]) => [table, list.length]),
  )
  return { changes, rows, counts }
}

export interface UpgradeResult {
  version: Version
  fixtureRows: number
  counts: Record<string, number>
  changedValues: string[]
  rowIssues: RowIssue[]
  reopenedIdentical: boolean
}

/** Upgrade one fixture through `prepareDatabase`, then close and reopen it. */
export async function runUpgrade(version: Version): Promise<UpgradeResult> {
  const filename = `d1-${version}-${crypto.randomUUID()}.db`
  await seed(version, filename)

  const upgraded = createDatabase(filename)
  await prepareDatabase(upgraded)
  const after = await readTables(upgraded)
  const { changes, rows, counts } = changedValues(version, after)
  await upgraded.close()

  // The repairs run again on every open; on upgraded rows they change nothing.
  const reopened = createDatabase(filename)
  await prepareDatabase(reopened)
  const again = await readTables(reopened)
  await reopened.close()

  return {
    version,
    fixtureRows: rows,
    counts,
    changedValues: changes,
    rowIssues: validateStoredRows(after),
    reopenedIdentical: JSON.stringify(after) === JSON.stringify(again),
  }
}

export interface InterruptionResult {
  repairsRolledBack: boolean
  migrationRolledBack: boolean
  ledgerAfterFailure: string[]
  probesAfterFailure: string[]
  ledgerAfterReopen: string[]
  ledgerValuesAreTimes: boolean
  probesAfterReopen: string[]
  rowIssues: RowIssue[]
  changedValues: string[]
  secondRunApplied: string[]
  secondRunIdentical: boolean
}

/**
 * 1. The repairs, interrupted after they have run but before their
 *    transaction commits (the tab killed), leave every table as it was.
 * 2. A migration interrupted the same way, after writing course data and its
 *    probe, leaves both and its ledger row unwritten; the migration before it
 *    stays applied.
 * 3. The next open applies only the interrupted one; a second run applies
 *    nothing and changes nothing.
 */
export async function runInterruption(): Promise<InterruptionResult> {
  const filename = `d1-interrupted-${crypto.randomUUID()}.db`
  await seed("0.3.0", filename)
  const first = probeMigration("first")
  const second = probeMigration("second")
  const crashing: Migration = {
    id: second.id,
    async run(transaction, now) {
      await transaction.execute("UPDATE students SET courseNote = 'a metà'")
      await second.run(transaction, now)
      throw new Error("interrupted inside the migration")
    },
  }

  const before = createDatabase(filename)
  await before.init()
  const untouched = await readTables(before)
  await before
    .writeTransaction(async (transaction) => {
      await repairRows(transaction, new Date().toISOString())
      throw new Error("interrupted inside the repairs")
    })
    .catch(() => undefined)
  const afterRepairCrash = await readTables(before)
  await applyMigration(before, first)
  await applyMigration(before, crashing).catch(() => undefined)
  const afterMigrationCrash = await readTables(before)
  const ledgerAfterFailure = (await ledger(before)).map((row) => row.id)
  const probesAfterFailure = await probes(before)
  await before.close()

  const reopened = createDatabase(filename)
  await prepareDatabase(reopened, [first, second])
  const migrated = await readTables(reopened)
  const ledgerAfterReopen = await ledger(reopened)
  const probesAfterReopen = await probes(reopened)
  const secondRunApplied = await runMigrations(reopened, [first, second])
  const afterSecondRun = await readTables(reopened)
  await reopened.close()

  return {
    repairsRolledBack:
      JSON.stringify(untouched) === JSON.stringify(afterRepairCrash),
    migrationRolledBack:
      JSON.stringify(untouched) === JSON.stringify(afterMigrationCrash),
    ledgerAfterFailure,
    probesAfterFailure,
    ledgerAfterReopen: ledgerAfterReopen.map((row) => row.id),
    ledgerValuesAreTimes: ledgerAfterReopen.every(
      (row) => Number.isInteger(row.value) && row.value > Date.UTC(2026, 0),
    ),
    probesAfterReopen,
    rowIssues: validateStoredRows(migrated),
    changedValues: changedValues("0.3.0", migrated).changes,
    secondRunApplied,
    secondRunIdentical:
      JSON.stringify(migrated) === JSON.stringify(afterSecondRun),
  }
}

export interface OlderAppResult {
  ledgerKept: boolean
  probesAfterReopen: string[]
  strippedByOlderApp: string[]
  rowIssues: RowIssue[]
  olderAppStudent: Record<string, unknown>
  untouchedStudentKeptCreatedAt: boolean
  olderAppEvaluation: Record<string, unknown>
  courseId: string
}

/**
 * 03 §3.1: a phone that still runs 0.3.0 opens the database after 0.4.0
 * upgraded it, deactivates a student and saves an evaluation with 0.3.0's own
 * statements. Its schema drops the views' new columns, so the student row loses
 * its metadata and the evaluation is stored without course or metadata. The
 * ledger, in `meta`, which 0.3.0 also declares, survives, so no migration runs
 * twice; the next 0.4.0 open repairs both rows.
 */
export async function runOlderAppAfterUpgrade(): Promise<OlderAppResult> {
  const filename = `d1-older-app-${crypto.randomUUID()}.db`
  await seed("0.3.0", filename)
  const course = String(FIXTURES["0.3.0"].courses![0]!.id)
  const migration = probeMigration("once")

  const upgraded = createDatabase(filename)
  await prepareDatabase(upgraded, [migration])
  const beforeOlderApp = await readTables(upgraded)
  await upgraded.close()

  const older = new PowerSyncDatabase({
    schema: v030Schema,
    database: { dbFilename: filename },
  })
  await older.init()
  await older.execute(
    "UPDATE students SET active = ? WHERE id = ? AND courseId = ?",
    [0, "student-v030-paolo", course],
  )
  await older.execute(
    "INSERT INTO evaluations(id, studentId, sessionId, value, note) VALUES (?, ?, ?, ?, ?)",
    ["evaluation-older-app", "student-v030-marta", "mon-am", "+", null],
  )
  const stripped = await older.getAll<{ id: string; data: string }>(
    "SELECT id, data FROM ps_data_local__students WHERE id = ?",
    ["student-v030-paolo"],
  )
  await older.close()

  const reopened = createDatabase(filename)
  await prepareDatabase(reopened, [migration])
  const repaired = await readTables(reopened)
  const ledgerAfter = await ledger(reopened)
  const probesAfterReopen = await probes(reopened)
  await reopened.close()

  const student = (tables: StoredTables, id: string) =>
    tables.students!.find((row) => row.id === id)!
  return {
    ledgerKept: ledgerAfter.some((row) => row.id === "migration:test-once"),
    probesAfterReopen,
    strippedByOlderApp: ["createdAt", "updatedAt"].filter(
      (column) => !(column in JSON.parse(stripped[0]!.data)),
    ),
    rowIssues: validateStoredRows(repaired),
    olderAppStudent: student(repaired, "student-v030-paolo"),
    untouchedStudentKeptCreatedAt:
      student(repaired, "student-v030-sara").createdAt ===
      student(beforeOlderApp, "student-v030-sara").createdAt,
    olderAppEvaluation: repaired.evaluations!.find(
      (row) => row.id === "evaluation-older-app",
    )!,
    courseId: course,
  }
}

export interface LegacyRepairResult {
  rowIssues: RowIssue[]
  disorderedFault: Record<string, unknown>
  orphanFault: Record<string, unknown>
  courseId: string
}

/**
 * Two states older versions can leave and the repairs settle: a 0.2.0 fault
 * updated with the clock set back (updatedAt before createdAt) and a fault
 * whose boat is gone (UG2-DAT-7's race), which takes the device's one course
 * and is still reported as an orphan.
 */
export async function runLegacyRepairs(): Promise<LegacyRepairResult> {
  const filename = `d1-legacy-repairs-${crypto.randomUUID()}.db`
  const tables = structuredClone(FIXTURES["0.2.0"])
  tables.faults = tables.faults!.map((fault) =>
    fault.id === "fault-v020-quest-12-reported"
      ? {
          ...fault,
          createdAt: "2026-09-19T10:00:00.000Z",
          updatedAt: "2026-09-19T09:00:00.000Z",
        }
      : fault,
  )
  tables.faults.push({
    id: "fault-v020-orphan",
    boatId: "boat-v020-gone",
    description: "Timone incrinato",
    state: "open",
    createdAt: "2026-09-19T08:10:00.000Z",
    updatedAt: "2026-09-19T08:10:00.000Z",
  })
  await seed("0.2.0", filename, tables)

  const upgraded = createDatabase(filename)
  await prepareDatabase(upgraded)
  const repaired = await readTables(upgraded)
  await upgraded.close()

  const fault = (id: string) => repaired.faults!.find((row) => row.id === id)!
  return {
    rowIssues: validateStoredRows(repaired),
    disorderedFault: fault("fault-v020-quest-12-reported"),
    orphanFault: fault("fault-v020-orphan"),
    courseId: String(tables.courses![0]!.id),
  }
}

/**
 * The checklist's "migration time on a 40-student course": the 0.3.0 fixture
 * plus 40 synthetic students with an evaluation for every session, upgraded
 * through `prepareDatabase` and timed, then opened again and timed, since the
 * repairs' probe runs on every open.
 */
async function sha256Json(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value) ?? "")
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
}

async function digestTables(tables: StoredTables) {
  const tableSha256 = await Promise.all(
    COURSE_TABLES.map(async (table) => ({
      table,
      sha256: await sha256Json(tables[table] ?? []),
    })),
  )
  const orderedTablesSha256 = await sha256Json(
    COURSE_TABLES.map((table) => [table, tables[table] ?? []]),
  )
  return { tableSha256, orderedTablesSha256 }
}

async function timedLargeOpen(filename: string) {
  // Start before construction so the five-second bound includes the full
  // cold-open path. Keep the result reads and close outside that bound.
  const started = performance.now()
  const workerDiagnostics = captureWorkerInitDiagnostics()
  const constructed = performance.now()
  let database: PowerSyncDatabase
  try {
    database = createDatabase(filename)
  } finally {
    workerDiagnostics.restore()
  }
  const created = performance.now()
  const adapterInitStarted = performance.now()
  // PowerSync starts this adapter open from its constructor. Awaiting the
  // same promise used by its normal init path lets the report separate the
  // WA-SQLite worker/VFS open from the remaining SDK readiness work.
  const adapter = database.database as unknown as { init: () => Promise<void> }
  await adapter.init()
  const adapterReady = performance.now()
  await database.init()
  const initialized = performance.now()
  await prepareDatabase(database)
  const prepared = performance.now()
  const durationMs = Math.round(prepared - started)
  const createDatabaseMs = Math.round(created - constructed)
  const initMs = Math.round(initialized - created)
  const prepareAfterInitMs = Math.round(prepared - initialized)
  const readStarted = performance.now()
  const tables = await readTables(database)
  const readTablesMs = Math.round(performance.now() - readStarted)
  const closeStarted = performance.now()
  await database.close()
  const closeMs = Math.round(performance.now() - closeStarted)
  await workerDiagnostics.finish()
  return {
    durationMs,
    createDatabaseMs,
    initMs,
    adapterInitMs: Math.round(adapterReady - adapterInitStarted),
    sdkReadyAfterAdapterMs: Math.round(initialized - adapterReady),
    prepareAfterInitMs,
    readTablesMs,
    closeMs,
    workerDiagnostics: workerDiagnostics.events,
    tables,
  }
}

async function seedLargeUpgrade() {
  const filename = `d1-large-${crypto.randomUUID()}.db`
  const base = FIXTURES["0.3.0"]
  const courseId = String(base.courses![0]!.id)
  const students = Array.from({ length: 40 }, (_, index) => ({
    id: `student-load-${index}`,
    courseId,
    firstName: `Nome${index}`,
    surname: `Cognome${index}`,
    nickname: null,
    dateOfBirth: null,
    declaredAgeAtCourseStart: 10 + (index % 8),
    sex: index % 2 ? "male" : "female",
    phone: null,
    size: "M",
    initialNote: null,
    courseNote: null,
    active: 1,
  }))
  const evaluations = students.flatMap((student) =>
    SESSION_SEQUENCE.map((session) => ({
      id: `evaluation-load-${student.id}-${session.id}`,
      studentId: student.id,
      sessionId: session.id,
      value: "=",
      note: null,
    })),
  )
  const expectedTables: FixtureTables = {
    ...base,
    students: [...base.students!, ...students],
    evaluations: [...base.evaluations!, ...evaluations],
  }
  // D2 repairs materialize one row per distinct value in each canonical list.
  const expectedDutySettingItemRows = (base.dutySettings ?? []).reduce(
    (total, setting) =>
      total +
      DUTY_SETTING_LISTS.reduce((listTotal, { field }) => {
        const values = JSON.parse(String(setting[field] ?? "[]")) as unknown[]
        return listTotal + new Set(values).size
      }, 0),
    0,
  )
  const expectedRows = COURSE_TABLES.reduce(
    (total, table) =>
      total +
      (table === "dutySettingItems"
        ? expectedDutySettingItemRows
        : (expectedTables[table]?.length ?? 0)),
    0,
  )
  await seed("0.3.0", filename, {
    ...base,
    students: [...base.students!, ...students],
    evaluations: [...base.evaluations!, ...evaluations],
  })

  return {
    filename,
    expectedRows,
    expectedInjectedStudentRows: students.length,
    expectedInjectedEvaluationRows: evaluations.length,
  }
}

export async function runLargeUpgrade() {
  const seed = await seedLargeUpgrade()
  const { filename, expectedRows } = seed

  const upgrade = await timedLargeOpen(filename)
  // Every later open probes for rows to repair; sound data costs one read.
  const reopen = await timedLargeOpen(filename)
  const rows = Object.values(upgrade.tables).reduce(
    (sum, list) => sum + list.length,
    0,
  )
  const reopenRows = Object.values(reopen.tables).reduce(
    (sum, list) => sum + list.length,
    0,
  )
  const injectedStudentRows = upgrade.tables.students!.filter((row) =>
    String(row.id).startsWith("student-load-"),
  ).length
  const reopenInjectedStudentRows = reopen.tables.students!.filter((row) =>
    String(row.id).startsWith("student-load-"),
  ).length
  const injectedEvaluationRows = upgrade.tables.evaluations!.filter((row) =>
    String(row.id).startsWith("evaluation-load-"),
  ).length
  const reopenInjectedEvaluationRows = reopen.tables.evaluations!.filter(
    (row) => String(row.id).startsWith("evaluation-load-"),
  ).length
  const upgradeDigests = await digestTables(upgrade.tables)
  const reopenDigests = await digestTables(reopen.tables)
  return {
    // Returned only so the caller can reopen this same synthetic file after a
    // page reload; the e2e spec omits it from evidence and annotations.
    filename,
    durationMs: upgrade.durationMs,
    createDatabaseMs: upgrade.createDatabaseMs,
    initMs: upgrade.initMs,
    adapterInitMs: upgrade.adapterInitMs,
    sdkReadyAfterAdapterMs: upgrade.sdkReadyAfterAdapterMs,
    prepareAfterInitMs: upgrade.prepareAfterInitMs,
    readTablesMs: upgrade.readTablesMs,
    closeMs: upgrade.closeMs,
    reopenMs: reopen.durationMs,
    reopenCreateDatabaseMs: reopen.createDatabaseMs,
    reopenInitMs: reopen.initMs,
    reopenAdapterInitMs: reopen.adapterInitMs,
    reopenSdkReadyAfterAdapterMs: reopen.sdkReadyAfterAdapterMs,
    reopenPrepareAfterInitMs: reopen.prepareAfterInitMs,
    reopenReadTablesMs: reopen.readTablesMs,
    reopenCloseMs: reopen.closeMs,
    workerDiagnostics: upgrade.workerDiagnostics,
    reopenWorkerDiagnostics: reopen.workerDiagnostics,
    expectedRows,
    expectedInjectedStudentRows: seed.expectedInjectedStudentRows,
    injectedStudentRows,
    reopenInjectedStudentRows,
    expectedInjectedEvaluationRows: seed.expectedInjectedEvaluationRows,
    injectedEvaluationRows,
    reopenInjectedEvaluationRows,
    rows,
    reopenRows,
    rowIssues: validateStoredRows(upgrade.tables),
    reopenRowIssues: validateStoredRows(reopen.tables),
    reopenedIdentical:
      JSON.stringify(upgrade.tables) === JSON.stringify(reopen.tables),
    upgradeTableSha256: upgradeDigests.tableSha256,
    upgradeOrderedTablesSha256: upgradeDigests.orderedTablesSha256,
    reopenTableSha256: reopenDigests.tableSha256,
    reopenOrderedTablesSha256: reopenDigests.orderedTablesSha256,
  }
}

/** Upgrade only, so a later document can reopen the file without a same-page
 * reopen warming the WebAssembly module first. */
export async function runLargeUpgradeFreshDirect() {
  const seed = await seedLargeUpgrade()
  const upgrade = await timedLargeOpen(seed.filename)
  const digests = await digestTables(upgrade.tables)
  const rows = Object.values(upgrade.tables).reduce(
    (sum, list) => sum + list.length,
    0,
  )
  const injectedStudentRows = upgrade.tables.students!.filter((row) =>
    String(row.id).startsWith("student-load-"),
  ).length
  const injectedEvaluationRows = upgrade.tables.evaluations!.filter((row) =>
    String(row.id).startsWith("evaluation-load-"),
  ).length
  return {
    filename: seed.filename,
    durationMs: upgrade.durationMs,
    createDatabaseMs: upgrade.createDatabaseMs,
    initMs: upgrade.initMs,
    adapterInitMs: upgrade.adapterInitMs,
    sdkReadyAfterAdapterMs: upgrade.sdkReadyAfterAdapterMs,
    prepareAfterInitMs: upgrade.prepareAfterInitMs,
    readTablesMs: upgrade.readTablesMs,
    closeMs: upgrade.closeMs,
    workerDiagnostics: upgrade.workerDiagnostics,
    expectedRows: seed.expectedRows,
    expectedInjectedStudentRows: seed.expectedInjectedStudentRows,
    expectedInjectedEvaluationRows: seed.expectedInjectedEvaluationRows,
    rows,
    injectedStudentRows,
    injectedEvaluationRows,
    rowIssues: validateStoredRows(upgrade.tables),
    tableSha256: digests.tableSha256,
    orderedTablesSha256: digests.orderedTablesSha256,
  }
}

/** Reopen the same prepared database from a newly loaded document. */
export async function reopenLargeUpgrade(filename: string) {
  const reopened = await timedLargeOpen(filename)
  const digests = await digestTables(reopened.tables)
  const rows = Object.values(reopened.tables).reduce(
    (sum, list) => sum + list.length,
    0,
  )
  const injectedStudentRows = reopened.tables.students!.filter((row) =>
    String(row.id).startsWith("student-load-"),
  ).length
  const injectedEvaluationRows = reopened.tables.evaluations!.filter((row) =>
    String(row.id).startsWith("evaluation-load-"),
  ).length
  return {
    durationMs: reopened.durationMs,
    createDatabaseMs: reopened.createDatabaseMs,
    initMs: reopened.initMs,
    adapterInitMs: reopened.adapterInitMs,
    sdkReadyAfterAdapterMs: reopened.sdkReadyAfterAdapterMs,
    prepareAfterInitMs: reopened.prepareAfterInitMs,
    readTablesMs: reopened.readTablesMs,
    closeMs: reopened.closeMs,
    workerDiagnostics: reopened.workerDiagnostics,
    rows,
    injectedStudentRows,
    injectedEvaluationRows,
    rowIssues: validateStoredRows(reopened.tables),
    tableSha256: digests.tableSha256,
    orderedTablesSha256: digests.orderedTablesSha256,
  }
}
