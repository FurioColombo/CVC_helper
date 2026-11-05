export type FingerprintRow = {
  table: string
  id: string
  updatedAt: string | null
}

/** UTF-8 byte order, which is `collate "C"`: UTF-16 units differ past U+E000. */
function byCodePoint(first: string, second: string) {
  const a = Array.from(first)
  const b = Array.from(second)
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const difference = a[i]!.codePointAt(0)! - b[i]!.codePointAt(0)!
    if (difference) return difference
  }
  return a.length - b.length
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
    .sort(byCodePoint)
    .join("\n")
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
