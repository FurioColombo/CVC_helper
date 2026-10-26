import type { SupabaseClient } from "@supabase/supabase-js"

import { backupConfig, type BackupConfig } from "@/backup/config"
import { createConnector } from "@/backup/connector"
import {
  claimDeviceForAccount,
  connectDatabase,
  deviceCourseId,
  deviceSyncMode,
  disconnectDatabase,
  openedWithSyncedTables,
  switchDeviceToSyncedTables,
} from "@/persistence/backupLink"
import { CourseReplacedError } from "@/persistence/courseSession"
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
  | { kind: "other-course" }
  | { kind: "other-account" }
  | { kind: "connected"; email: string }
  | { kind: "error"; message: string }

const UNREACHABLE = "Backup non raggiungibile. Riprova con la connessione."

let client: Promise<SupabaseClient> | null = null
let connected = false

async function supabase(config: BackupConfig) {
  client ??= import("@supabase/supabase-js").then(({ createClient }) => {
    const created = createClient(config.supabaseUrl, config.supabaseKey, {
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
 * (the app then reopens) or connects a switched one. `beforeSwitch` waits
 * until the switch may reload the app.
 */
export async function startBackup(
  beforeSwitch: () => Promise<void> = async () => {},
): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
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
      .select("id")
      .limit(2)
    if (error)
      return offline()
        ? { kind: "offline", email }
        : { kind: "error", message: UNREACHABLE }
    const elsewhere = (owned ?? []).some(({ id }) => id !== device)
    if (elsewhere) return { kind: "other-course" }
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
    connected = true
    await connectDatabase(createConnector(client, config, session.user.id))
  }
  return { kind: "connected", email }
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
  if (current.kind !== "connected" && current.kind !== "offline") return
  await disconnectDatabase()
  connected = false
  setBackupState({ kind: "signed-out" })
}

const SIGN_OUT_WAIT_MS = 3_000

/** Disconnects and signs out; the course stays on the device. */
export async function signOutOfBackup(): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
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
