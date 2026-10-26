/**
 * B4: what one failed upload request means. A transient failure retries with
 * the whole transaction; an app older than the server's minimum writer stops
 * uploading until it is updated; anything the server will refuse again is
 * kept on the device and reported, and the queue moves on (a refusal that
 * retried forever would hold every later change back; 04 B4).
 */
export type UploadOutcome =
  | { kind: "retry" }
  | { kind: "outdated" }
  | { kind: "refused"; reason: RefusalReason }

/**
 * Why the server refused a change, as Impostazioni says it:
 * `other-account`, the course id is another account's online (B2 review
 * SP-B2-Q5); `access`, the row's course is not this account's (most often
 * because its course was refused first); `data`, the row itself breaks a rule.
 */
export type RefusalReason = "other-account" | "access" | "data"

export type UploadFailure = {
  /** The PostgREST or Postgres code, empty for a network failure. */
  code?: string
  /** The HTTP status; 0 when no response arrived. */
  status?: number
}

/** The writing app's version, on every request (supabase/migrations, B4). */
export const APP_VERSION_HEADER = "x-cvc-app-version"

/** Raised by the server's writer check (supabase/migrations, B4). */
export const OUTDATED_WRITER_CODE = "CVOLD"

const RETRY_STATUSES = new Set([0, 401, 408, 425, 429])
const RETRY_CODES = new Set([
  // Expired or not yet valid session: the next attempt has a fresh token.
  "PGRST301",
  "PGRST303",
  // Serialization failures and deadlocks clear on a second attempt.
  "40001",
  "40P01",
  // The server is starting, stopping or out of connections.
  "57P01",
  "57P03",
  "53300",
])
const ACCESS_CODES = new Set(["42501"])
const ACCESS_STATUSES = new Set([403])
const DATA_STATUSES = new Set([400, 404, 409, 422])
const DATA_CODES = new Set(["42703", "42P01", "PGRST102", "PGRST204"])

export function classifyUploadFailure(
  failure: UploadFailure,
  table: string,
): UploadOutcome {
  const code = failure.code ?? ""
  const status = failure.status ?? 0
  if (code === OUTDATED_WRITER_CODE) return { kind: "outdated" }
  if (RETRY_CODES.has(code)) return { kind: "retry" }
  const access = ACCESS_CODES.has(code) || ACCESS_STATUSES.has(status)
  // A course id taken by another account: its insert conflicts, and the
  // update of a row this account cannot see is refused by the access rules.
  if (table === "courses" && (access || code === "23505" || status === 409))
    return { kind: "refused", reason: "other-account" }
  if (access) return { kind: "refused", reason: "access" }
  if (
    code.startsWith("22") ||
    code.startsWith("23") ||
    DATA_CODES.has(code) ||
    DATA_STATUSES.has(status)
  )
    return { kind: "refused", reason: "data" }
  if (RETRY_STATUSES.has(status) || status >= 500) return { kind: "retry" }
  // Unknown: retrying loses nothing, and the status line keeps showing
  // changes waiting.
  return { kind: "retry" }
}
