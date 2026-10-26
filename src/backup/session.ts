import type { SupabaseClient } from "@supabase/supabase-js"

import { backupConfig, type BackupConfig } from "@/backup/config"
import { createConnector } from "@/backup/connector"
import {
  connectDatabase,
  deviceCourseId,
  deviceSyncMode,
  disconnectDatabase,
  switchDeviceToSyncedTables,
} from "@/persistence/backupLink"
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
  | { kind: "signed-out" }
  | { kind: "link-sent"; email: string }
  | { kind: "reopen" }
  | { kind: "other-course" }
  | { kind: "connected"; email: string }
  | { kind: "error"; message: string }

let client: Promise<SupabaseClient> | null = null
let connected = false

async function supabase(config: BackupConfig) {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        storageKey: appChannelConfig.backupAuthKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    }),
  )
  return client
}

/** Sends the sign-in link to `email`; the link returns to this app. */
export async function sendSignInLink(email: string): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
  const auth = (await supabase(config)).auth
  const { error } = await auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      shouldCreateUser: true,
    },
  })
  return error
    ? { kind: "error", message: "Invio non riuscito. Riprova." }
    : { kind: "link-sent", email }
}

/**
 * Where the backup stands, acting on it: switches a signed-in local device
 * (the app then reopens) or connects a switched one.
 */
export async function startBackup(): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
  const client = await supabase(config)
  const {
    data: { session },
  } = await client.auth.getSession()
  if (!session) return { kind: "signed-out" }
  const email = session.user.email ?? ""
  if ((await deviceSyncMode()) === "local") {
    const device = await deviceCourseId()
    const { data: owned, error } = await client
      .from("courses")
      .select("id")
      .limit(2)
    if (error)
      return {
        kind: "error",
        message: "Backup non raggiungibile. Riprova con la connessione.",
      }
    const elsewhere = (owned ?? []).some(({ id }) => id !== device)
    if (elsewhere) return { kind: "other-course" }
    await switchDeviceToSyncedTables()
    return { kind: "reopen" }
  }
  if (!connected) {
    connected = true
    await connectDatabase(createConnector(client, config))
  }
  return { kind: "connected", email }
}

/** Disconnects and signs out; the course stays on the device. */
export async function signOutOfBackup(): Promise<BackupState> {
  const config = backupConfig()
  if (!config) return { kind: "unavailable" }
  await disconnectDatabase()
  connected = false
  await (await supabase(config)).auth.signOut({ scope: "local" })
  return { kind: "signed-out" }
}

let current: BackupState = { kind: "signed-out" }
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

/**
 * At app start: a sign-in link lands on the app's home page, so the backup is
 * checked here, not only in Impostazioni. A device just switched reopens at
 * once, before anything could be typed.
 */
export async function startBackupAtLaunch(
  reload = () => window.location.reload(),
) {
  if (!backupConfig()) return setBackupState({ kind: "unavailable" })
  try {
    const state = await startBackup()
    setBackupState(state)
    if (state.kind === "reopen") reload()
  } catch {
    setBackupState({
      kind: "error",
      message: "Backup non raggiungibile. Riprova con la connessione.",
    })
  }
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
