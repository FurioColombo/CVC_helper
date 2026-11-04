export type FingerprintRow = {
  table: string
  id: string
  updatedAt: string | null
}

/**
 * What a course holds, row by row: its tables, ids and last edits, hashed. The
 * owner gives a course up on what the screen shows, and a stamp cannot say the
 * server holds nothing else: it is the time of the edit on a phone, so offline
 * work reaches the server with old ones (review SC-B7-9). `keep_course` computes
 * the same text in the same order
 * (supabase/migrations/20261104000000_keep_course.sql), and a test pins both to
 * the same value.
 */
export async function courseFingerprint(rows: FingerprintRow[]) {
  const text = rows
    .map(({ table, id, updatedAt }) => `${table}\t${id}\t${updatedAt ?? ""}`)
    .sort((first, second) => (first < second ? -1 : first > second ? 1 : 0))
    .join("\n")
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
