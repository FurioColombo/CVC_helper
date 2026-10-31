import type { PowerSyncBackendConnector } from "@powersync/web"
import type { SupabaseClient } from "@supabase/supabase-js"

import { backupConfig, type BackupConfig } from "@/backup/config"
import { createConnector } from "@/backup/connector"
import { APP_VERSION_HEADER, OUTDATED_WRITER_CODE } from "@/backup/uploadPolicy"
import { APP_VERSION_TEXT } from "@/appVersion"
import {
  claimDeviceForAccount,
  connectDatabase,
  databaseConnected,
  deviceCourseId,
  deviceSyncMode,
  disconnectDatabase,
  adoptMinimumWriter,
  firstSync,
  forgetServerErasures,
  keepForLater,
  openedWithSyncedTables,
  pendingServerErasures,
  awaitingAccountCourse,
  courseTableColumns,
  recordUploadOutcome,
  stopAwaitingAccountCourse,
  switchDeviceToSyncedTables,
  syncStalled,
} from "@/persistence/backupLink"
import { CourseReplacedError } from "@/persistence/courseSession"
import { eraseAllCourseData } from "@/persistence/courses"
import { appChannelConfig } from "@/runtimeConfig"

/**
 * B3: signing in to the online backup. Signed out, nothing connects and the
 * app is 0.4.0's. Signed in, the device switches once to synced tables (B1)
 * and connects: after `prepareDatabase`, before `connect()`, as PowerSync
 * requires. An account that already holds another course is not switched
 * into: choosing between the two is B5's (B1 review SC-B1-2). Sign-out
 * disconnects and keeps the course on the device.
 */
export type BackupState =
  | { kind: "unavailable" }
  | { kind: "checking" }
  | { kind: "signed-out"; notice?: string }
  | { kind: "link-sent"; email: string; notice?: string }
  | { kind: "offline"; email: string }
  | { kind: "reopen" }
  | { kind: "replace-course"; online: string }
  | { kind: "restoring"; email: string }
  | { kind: "other-account" }
  | { kind: "connected"; email: string; outdated?: boolean }
  | { kind: "error"; message: string }

const UNREACHABLE = "Backup non raggiungibile. Riprova con la connessione."

let client: Promise<SupabaseClient> | null = null
/** The server last answered that this app is below its minimum writer. */
let uploadsOutdated = false
let connected = false
/** Counts sign-outs, so a start begun before one never connects after it. */
let signOuts = 0

async function supabase(config: BackupConfig) {
  client ??= import("@supabase/supabase-js").then(({ createClient }) => {
    const created = createClient(config.supabaseUrl, config.supabaseKey, {
      // The server refuses writers older than its minimum (B4, 03 §3.1).
      global: { headers: { [APP_VERSION_HEADER]: APP_VERSION_TEXT } },
      auth: {
        storageKey: appChannelConfig.backupAuthKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
    // A sign-in completed in another tab of this app reaches this one too
    // (review FUX-B3-5). Outside the callback: the library holds its lock.
    created.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
        window.setTimeout(() => void resumeBackup(), 0)
      // Esci in another tab signs this one out too (review FUX-B3-R2-Q3).
      if (event === "SIGNED_OUT")
        window.setTimeout(() => void signedOutElsewhere(), 0)
    })
    return created
  })
  return client
}

const linkSentKey = () => `${appChannelConfig.backupAuthKey}-link-sent`
/** A link is valid for an hour (Supabase's default). */
const LINK_LIFETIME_MS = 60 * 60 * 1000

function rememberLinkSent(email: string | null) {
  try {
    if (email)
      window.localStorage.setItem(
        linkSentKey(),
        JSON.stringify({ email, at: Date.now() }),
      )
    else window.localStorage.removeItem(linkSentKey())
  } catch {
    // Only spares typing the address again after the app was closed.
  }
}

/** The address a still valid link went to, if the app was closed since. */
function linkSentTo(): string | null {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(linkSentKey()) ?? "null",
    ) as { email?: unknown; at?: unknown } | null
    if (
      typeof stored?.email === "string" &&
      typeof stored.at === "number" &&
      Date.now() - stored.at < LINK_LIFETIME_MS
    )
      return stored.email
  } catch {
    // Unreadable: as if none was sent.
  }
  // Expired or unreadable: the address is not kept longer than the link
  // (review SP-B3-10).
  rememberLinkSent(null)
  return null
}

/** The account of a session the library keeps but could not refresh. */
function storedSessionEmail(): string | null {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(appChannelConfig.backupAuthKey) ?? "null",
    ) as { user?: { email?: unknown } } | null
    return typeof stored?.user?.email === "string" ? stored.user.email : null
  } catch {
    return null
  }
}

const offline = () => !window.navigator.onLine

/** Sends the sign-in link to `email`; the link returns to this app. */
export async function sendSignInLink(email: string): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
  const auth = (await supabase(config)).auth
  const { error } = await auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      // Only the accounts made in the backend's dashboard sign in: nobody
      // creates one from the public test app (review SP-B3-4).
      shouldCreateUser: false,
    },
  })
  if (!error) {
    rememberLinkSent(email)
    return { kind: "link-sent", email }
  }
  // The form stays filled, so its button is the retry (review FUX-B3-Q1).
  return {
    kind: "signed-out",
    notice: offline()
      ? "Nessuna connessione: il link non è partito. Riprova quando c’è campo."
      : error.status === 429
        ? "Troppe richieste. Aspetta un minuto e riprova."
        : error.status === 422 || error.status === 400
          ? "Questa email non ha un accesso al backup."
          : "Invio non riuscito. Riprova.",
  }
}

/**
 * Signs in with the code in the email, for a link that opens in another
 * browser than this app's (an iPhone home-screen app, a mail app's own
 * browser; review FUX-B3-4).
 */
export async function signInWithCode(
  email: string,
  code: string,
): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
  const { error } = await (
    await supabase(config)
  ).auth.verifyOtp({ email, token: code, type: "email" })
  if (error)
    return {
      kind: "link-sent",
      email,
      notice: offline()
        ? "Nessuna connessione. Riprova quando c’è campo."
        : "Codice non valido o scaduto. Controlla l’ultima email o richiedine una nuova.",
    }
  await resumeBackup(true)
  return current
}

/**
 * Where the backup stands, acting on it: switches a signed-in local device
 * (the app then reopens) or connects a switched one. `beforeSwitch` throws
 * when the switch may not reload the app now.
 */
export async function startBackup(
  beforeSwitch: () => Promise<void> = async () => {},
): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
  // A sign-out while this start awaits the network ends it: it never
  // connects for the account just signed out.
  const epoch = signOuts
  const client = await supabase(config)
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession()
  if (!session) {
    // Offline with an expired token the library keeps the session: the
    // backup resumes with signal, nobody is signed out (review FUX-B3-2).
    const kept = sessionError ? storedSessionEmail() : null
    if (kept) return { kind: "offline", email: kept }
    const sentTo = linkSentTo()
    return sentTo
      ? { kind: "link-sent", email: sentTo }
      : { kind: "signed-out" }
  }
  rememberLinkSent(null)
  const email = session.user.email ?? ""
  if ((await deviceSyncMode()) === "local") {
    const device = await deviceCourseId()
    const { data: owned, error } = await client
      .from("courses")
      .select("id, label")
      .limit(2)
    if (error)
      return offline()
        ? { kind: "offline", email }
        : { kind: "error", message: UNREACHABLE }
    // B5: a device holding another course asks before it is replaced, and
    // never merges the two (as an import); an empty device switches and
    // restores the account's course.
    const online = (owned ?? []).find(({ id }) => id !== device)
    if (online && device)
      return { kind: "replace-course", online: String(online.label ?? "") }
    await beforeSwitch()
    try {
      await switchDeviceToSyncedTables(session.user.id)
    } catch (error) {
      // Another tab switched first (B1 review SC-B1-Q2).
      if (!(error instanceof CourseReplacedError)) throw error
    }
    return { kind: "reopen" }
  }
  // Another tab switched while this one still reads the local tables.
  if (!openedWithSyncedTables()) return { kind: "reopen" }
  // A synced device belongs to the account that switched it: another account
  // never uploads its queue nor receives its course (review SP-B3-1, -3).
  if (!(await claimDeviceForAccount(session.user.id)))
    return { kind: "other-account" }
  if (!connected) {
    // B6: a course erased here is erased on the server before anything
    // connects, so it is never downloaded again; offline, the backup waits
    // for signal and the erase completes then.
    const settled = await settleServerErasures(client)
    if (settled === "outdated")
      return { kind: "error", message: OUTDATED_ERASE }
    if (settled === "failed")
      return offline()
        ? { kind: "offline", email }
        : { kind: "error", message: UNREACHABLE }
    if (epoch !== signOuts) return { kind: "signed-out" }
    connected = true
    // Restoring means waiting for the account's course: a device switched
    // empty. One whose own course was erased here makes a new one freely.
    restoring = (await awaitingAccountCourse()) && !(await deviceCourseId())
    // An empty device takes the server's minimum writer before anything is
    // downloaded: after the download the course is not yet bound to this
    // screen and the write guard would refuse the record (review SC-B5-1).
    if (restoring) await adoptServerMinimum(client).catch(() => {})
    if (epoch !== signOuts) {
      connected = false
      return { kind: "signed-out" }
    }
    activeConnector = createConnector(client, config, session.user.id, {
      columnsOf: courseTableColumns,
      recordOutcome: recordUploadOutcome,
      onOutdated: (outdated) => {
        // The first upload can answer before the state says connected.
        uploadsOutdated = outdated
        if (current.kind === "connected" && !!current.outdated !== outdated)
          setBackupState({ ...current, outdated })
      },
    })
    // Started, not awaited: the SDK's connect waits on its first request,
    // and a request hung on a dead connection would hold the backup in its
    // launch state (owner check B4-PHONE-UPLOADS, 2026-10-28).
    void connectDatabase(activeConnector).catch(() => {})
    watchStalledSync()
  }
  if (restoring) {
    void finishRestore(email)
    return { kind: "restoring", email }
  }
  // At every connection, so a failed read is tried again and a minimum
  // raised on the server since reaches this device too: from the next
  // launch it opens read-only (reviews DI-B5-5, SC-B5-2).
  void adoptServerMinimum(client).catch(() => {})
  // Reopened on the restored course: nothing is awaited any more.
  void stopAwaitingAccountCourse().catch(() => {})
  return { kind: "connected", email, outdated: uploadsOutdated }
}

let activeConnector: PowerSyncBackendConnector | null = null

/** How long a connection may stay stalled, online and on screen. */
const STALL_MS = 30_000
/** At most one restart in this time: never a reconnect loop. */
const RESTART_GAP_MS = 2 * 60_000
let watchdog = 0
let stalledSince = 0
let lastRestart = 0

/**
 * B4 owner check (2026-10-28): after a day offline the phone sent every
 * change, but its download stream stayed down until the app reopened (most
 * likely a request hung on a connection from before airplane mode, or an
 * upload loop PowerSync had left after a failure). While the backup is
 * connected, the phone online and the app on screen, a connection stalled
 * (`syncStalled`) for longer than STALL_MS is restarted, as reopening the
 * app did.
 */
function watchStalledSync() {
  if (watchdog) return
  watchdog = window.setInterval(async () => {
    if (
      !connected ||
      !activeConnector ||
      !window.navigator.onLine ||
      document.visibilityState !== "visible" ||
      !(await syncStalled().catch(() => false))
    ) {
      stalledSince = 0
      return
    }
    const now = Date.now()
    if (!stalledSince) stalledSince = now
    if (now - stalledSince < STALL_MS || now - lastRestart < RESTART_GAP_MS)
      return
    lastRestart = now
    stalledSince = 0
    restartSync(activeConnector)
  }, 5_000)
}

/** A new connect replaces the stuck one, aborting its request (PowerSync). */
function restartSync(connector: PowerSyncBackendConnector) {
  if (connected && activeConnector === connector)
    void connectDatabase(connector).catch(() => {})
}

/** PostgREST's answer for a table the server does not have yet. */
const NOT_INSTALLED = new Set(["PGRST205", "42P01"])

type Settled = "done" | "failed" | "outdated"

/**
 * B6: erases on the server the courses erased or replaced on this device
 * (and `also`, the full reset's), and accepts again a course file's course
 * imported under an erased id. The course row's delete takes every row of
 * the course with it and depends on no device's clock (B4 review SP-B4-3);
 * the erased id is recorded first, so another phone's later upload cannot
 * create the course again (supabase/migrations/20261028000000_course_erase.sql).
 * Each step can be repeated: a failure leaves the record for the next
 * connection. Before the owner installs that migration the delete alone
 * runs (review SP-B6-4).
 */
async function settleServerErasures(
  client: SupabaseClient,
  also: string[] = [],
): Promise<Settled> {
  try {
    const pending = await pendingServerErasures()
    // A record that would erase the course open here, never imported again,
    // is no state the app makes; it is dropped, not obeyed (review DI-B6-Q3).
    const open = await deviceCourseId()
    const stray = pending.rows.filter(
      ({ id, keep }) => id === open && !keep && !also.includes(id),
    )
    const rows = pending.rows.filter((row) => !stray.includes(row))
    const erase = [
      ...new Set([
        ...rows.filter((row) => row.erase).map(({ id }) => id),
        ...also,
      ]),
    ]
    // The full reset's course is erased for good, even one imported here
    // and not yet uploaded (review DI-B6-Q1).
    const keep = rows
      .filter((row) => row.keep && !also.includes(row.id))
      .map(({ id }) => id)
    if (!erase.length && !keep.length) {
      await forgetServerErasures(stray).catch(() => {})
      return "done"
    }
    const refused = (code: string | undefined): Settled =>
      code === OUTDATED_WRITER_CODE ? "outdated" : "failed"
    const recorded = erase.filter((id) => !keep.includes(id))
    let installed = true
    if (recorded.length) {
      const { error } = await client.from("erased_courses").upsert(
        recorded.map((id) => ({ id })),
        { onConflict: "ownerId,id", ignoreDuplicates: true },
      )
      if (error && NOT_INSTALLED.has(error.code)) installed = false
      else if (error) return refused(error.code)
    }
    if (erase.length) {
      const { error } = await client.from("courses").delete().in("id", erase)
      if (error) return refused(error.code)
    }
    // Accepting a course again never holds the backup back: a server out of
    // reach or refusing it now is asked again at the next connection, and
    // meanwhile a refusal of that course is kept for Riprova, not dropped
    // (src/persistence/migrations.ts courseLeftThisDevice).
    let lifted = true
    if (keep.length && installed) {
      const { error } = await client
        .from("erased_courses")
        .delete()
        .in("id", keep)
      if (error && !NOT_INSTALLED.has(error.code)) lifted = false
    }
    // Without the record on the server (its migration not run), the delete
    // alone happened: the record is forgotten all the same, since repeating
    // the delete could erase the owner's later import of that course
    // (review DI-B6-R2-1). A read-only device cannot forget at all; it makes
    // no new erase (review DI-B6-Q2).
    await forgetServerErasures([
      ...stray,
      ...rows.filter((row) => lifted || !row.keep),
    ]).catch(() => {})
    if (!lifted)
      await keepForLater(rows.filter((row) => row.keep)).catch(() => {})
    return "done"
  } catch {
    return "failed"
  }
}

const OUTDATED_ERASE =
  "Questa versione dell’app non può più eliminare il corso dal backup online: aggiorna l’app."

/**
 * B6: before "Azzera tutti i dati locali" on a device signed in to the
 * backup, its course is erased on the server too; the answer says why not
 * when that failed, and the reset then waits. Signed out, or on another
 * account's device, the online copy stays: the confirmation says so.
 */
export async function eraseOnlineCopyBeforeReset(): Promise<string | null> {
  const config = backupConfig()
  if (!config || (await deviceSyncMode()) !== "synced") return null
  if (
    current.kind !== "connected" &&
    current.kind !== "offline" &&
    current.kind !== "restoring" &&
    current.kind !== "error"
  )
    return null
  const client = await supabase(config)
  const {
    data: { session },
  } = await client.auth.getSession()
  const course = await deviceCourseId()
  const settled =
    session && (await claimDeviceForAccount(session.user.id))
      ? await settleServerErasures(client, course ? [course] : [])
      : "failed"
  if (settled === "done") return null
  if (settled === "outdated") return `${OUTDATED_ERASE} Nulla è stato azzerato.`
  return "Il corso non è stato eliminato dal backup online, quindi nulla è stato azzerato. Riprova con la connessione, oppure esci dal backup online prima di azzerare: la copia online resta."
}

/**
 * B6: an erase or import disconnects the backup before it forgets the synced
 * copy; one that failed reconnects it here, so the backup does not stay
 * stopped while saying it is up to date (review DI-B6-2).
 */
export function reconnectBackup() {
  if (!connected || databaseConnected()) return Promise.resolve()
  connected = false
  return resumeBackup()
}

/** A device that switched without a course waits for the account's. */
let restoring = false
let finishing: Promise<void> | null = null

/**
 * The server's minimum writer, adopted by the device's data version
 * (supabase/migrations/20261027000000_minimum_writer_read.sql). Not
 * installed yet, the server's own writer check still refuses an older
 * app's uploads.
 */
async function adoptServerMinimum(client: SupabaseClient) {
  const { data: minimum, error } = await client.rpc(
    "app_minimum_writer_version",
  )
  if (!error && typeof minimum === "string") await adoptMinimumWriter(minimum)
}

/**
 * B5: once the first complete download is in (the server's minimum writer
 * already taken, so an app older than it opens the course read-only), the
 * app reopens so its session binds the restored course
 * (B1 review SC-B1-Q5). Nothing can be lost by that reload: on a switched
 * empty device no course is created or imported until the account is known
 * to hold none (src/App.tsx). An account without a course leaves the device
 * empty and connected; a failure says so and Riprova resumes.
 */
function finishRestore(email: string) {
  finishing ??= (async () => {
    try {
      await firstSync()
      restoring = false
      if (await deviceCourseId()) reload()
      else {
        // The account has no course: one can be made here now. A device
        // read-only for an app older than the server's minimum keeps the
        // mark until the update; its banner already asks for it, so that is
        // no backup error (review SC-B5-R2-1).
        await stopAwaitingAccountCourse().catch(() => {})
        setBackupState({ kind: "connected", email, outdated: uploadsOutdated })
      }
    } catch {
      setBackupState({ kind: "error", message: UNREACHABLE })
    }
  })().finally(() => {
    finishing = null
  })
  return finishing
}

/**
 * B5: the owner confirmed replacing this device's course with the
 * account's. The account's course is checked first, so nothing is erased
 * for a course no longer online or a server out of reach; then the course
 * here is erased, as "Elimina il corso" does, and the app reopens at once,
 * empty: no screen keeps showing the erased course, and the launch restores
 * the online one (review DI-B5-2). Nothing is merged.
 */
export async function replaceWithOnlineCourse(): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
  const { data: online, error } = await (
    await supabase(config)
  )
    .from("courses")
    .select("id")
    .limit(1)
  if (error || !online?.length)
    return {
      kind: "error",
      message: error
        ? UNREACHABLE
        : "Il corso online non c’è più: il corso di questo telefono resta.",
    }
  await eraseAllCourseData()
  reload()
  return current
}

/**
 * Removes the stored session whatever the library managed: offline with an
 * expired token its sign-out returns early and keeps it, and the next online
 * launch would sign the old account back in (review SP-B3-2).
 */
function forgetStoredSession() {
  try {
    for (const key of Object.keys(window.localStorage))
      if (
        key === appChannelConfig.backupAuthKey ||
        key.startsWith(`${appChannelConfig.backupAuthKey}-`)
      )
        window.localStorage.removeItem(key)
  } catch {
    // Storage unavailable: nothing was stored either.
  }
  client = null
}

async function signedOutElsewhere() {
  if (
    current.kind !== "connected" &&
    current.kind !== "offline" &&
    current.kind !== "restoring"
  )
    return
  signOuts += 1
  await disconnectDatabase()
  connected = false
  setBackupState({ kind: "signed-out" })
}

const SIGN_OUT_WAIT_MS = 3_000

/** Disconnects and signs out; the course stays on the device. */
export async function signOutOfBackup(): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
  signOuts += 1
  await disconnectDatabase()
  connected = false
  try {
    // Offline with an expired token the library retries for about 30 s
    // before giving up; the stored session goes either way (SP-B3-11).
    const auth = (await supabase(config)).auth
    await Promise.race([
      auth.signOut({ scope: "local" }),
      new Promise((resolve) => window.setTimeout(resolve, SIGN_OUT_WAIT_MS)),
    ])
  } finally {
    forgetStoredSession()
  }
  return { kind: "signed-out" }
}

/** Forgets the link sent, to type another address. */
export function forgetLinkSent(): BackupState {
  rememberLinkSent(null)
  return { kind: "signed-out" }
}

// Until the launch check answers, a signed-in phone must not show the
// sign-in form (review FUX-B3-R3-Q1).
let current: BackupState = { kind: "checking" }
const listeners = new Set<(state: BackupState) => void>()

/** The latest state, for screens that show it. */
export function backupState() {
  return current
}

export function onBackupState(listener: (state: BackupState) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setBackupState(state: BackupState) {
  current = state
  for (const listener of listeners) listener(state)
}

let reload = () => window.location.reload()
let resuming: Promise<void> | null = null

/** Set at the first tap or key after launch. */
let touched = false

function watchFirstTouch() {
  const touch = () => {
    touched = true
    window.removeEventListener("pointerdown", touch, true)
    window.removeEventListener("keydown", touch, true)
  }
  window.addEventListener("pointerdown", touch, true)
  window.addEventListener("keydown", touch, true)
}

class SwitchDeferred extends Error {}
/** The switch waits for "Riapri l’app"; nothing changed on the device yet. */
let switchDeferred = false

/**
 * Brings the backup up to date and reopens the app when it switched. The
 * switch reloads the app, so it happens by itself only while nothing on
 * screen could be lost: before the first tap after launch, or when the user
 * asked for it from Impostazioni (`asked`). Otherwise Impostazioni offers
 * "Riapri l’app", and no screen is interrupted or asked to let go (reviews
 * FUX-B3-3, FUX-B3-R2-1).
 */
export function resumeBackup(asked = false) {
  // Waiting for "Riapri l’app": nothing to do until the app reopens, unless
  // it is the user asking for the deferred switch.
  if (current.kind === "reopen" && !(asked && switchDeferred))
    return Promise.resolve()
  resuming ??= (async () => {
    const mayReopen = () => asked || !touched
    let switchedHere = false
    try {
      const state = await startBackup(async () => {
        if (!mayReopen()) throw new SwitchDeferred()
        switchedHere = true
      })
      if (state.kind === "reopen") {
        setBackupState(state)
        // Switched here: this tab's screens can no longer save, so it reopens
        // at once. Switched by another tab while this one is in use: it waits
        // for "Riapri l’app".
        if (switchedHere || mayReopen()) reload()
        return
      }
      // A message on the form stays until something changes.
      if (
        state.kind === "signed-out" &&
        current.kind === "signed-out" &&
        current.notice
      )
        return
      setBackupState(state)
    } catch (error) {
      switchDeferred = error instanceof SwitchDeferred
      setBackupState(
        error instanceof SwitchDeferred
          ? { kind: "reopen" }
          : { kind: "error", message: UNREACHABLE },
      )
    } finally {
      resuming = null
    }
  })()
  return resuming
}

/**
 * "Riapri l’app": a deferred switch happens now, as asked, and reopens once;
 * a done one only reopens (review FUX-B3-R3-1).
 */
export function reopenApp() {
  if (switchDeferred) return resumeBackup(true)
  reload()
  return Promise.resolve()
}

/** Whether the address carries a sign-in link's answer; removes it. */
function takeLinkFromAddress() {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""))
  const failed = ["error", "error_code", "error_description"].some(
    (name) => url.searchParams.has(name) || hash.has(name),
  )
  const code = url.searchParams.has("code")
  if (!failed && !code) return null
  // The code is spent or useless either way, and an error description may
  // repeat the address: keep both out of the address bar and the history.
  for (const name of ["code", "error", "error_code", "error_description"])
    url.searchParams.delete(name)
  if (failed) url.hash = ""
  window.history.replaceState(window.history.state, "", url)
  return failed ? "failed" : "code"
}

/** How long the launch check may run before a kept session shows. */
const CHECK_PATIENCE_MS = 3_000

/**
 * At app start: a sign-in link lands on the app's home page, so the backup is
 * checked here, not only in Impostazioni. Signal coming back resumes it.
 */
export async function startBackupAtLaunch(
  reloadApp = () => window.location.reload(),
) {
  if (!backupConfig()) return setBackupState({ kind: "unavailable" })
  reload = reloadApp
  watchFirstTouch()
  window.addEventListener("online", () => {
    if (current.kind === "offline" || current.kind === "error")
      void resumeBackup()
  })
  // Offline with an expired token the library retries for about 25 s before
  // answering: a kept session shows as waiting meanwhile (SP-B3-13).
  const provisional = window.setTimeout(() => {
    const kept = storedSessionEmail()
    if (current.kind === "checking" && kept)
      setBackupState({ kind: "offline", email: kept })
  }, CHECK_PATIENCE_MS)
  // The library exchanges a sign-in link's code when it starts, reading the
  // address: only then may the address be cleaned (review SP-B3-8).
  await (await supabase(backupConfig()!)).auth.initialize()
  const link = takeLinkFromAddress()
  await resumeBackup()
  window.clearTimeout(provisional)
  // A link opened elsewhere than the browser that asked for it, expired or
  // already used (reviews SP-B3-6, FUX-B3-4).
  if (link && (current.kind === "signed-out" || current.kind === "link-sent"))
    setBackupState({
      kind: "signed-out",
      notice:
        "Il link è scaduto, già usato o aperto in un altro browser. Richiedine uno nuovo da qui, oppure usa il codice dell’email.",
    })
}

/**
 * Development only: tests cannot open an emailed link, so the live backup
 * test (tests/e2e/b3-backup-live.spec.ts) signs a synthetic test account in by
 * password. Production builds refuse it.
 */
export async function signInForTests(email: string, password: string) {
  if (!import.meta.env.DEV) throw new Error("Not available in production")
  const config = backupConfig()
  if (!config) throw new Error("No backup configured")
  const { error } = await (
    await supabase(config)
  ).auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
}
