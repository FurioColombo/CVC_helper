/**
 * Record metadata (D1, 03_TECHNICAL_DECISIONS.md §3): every row carries
 * `createdAt` and `updatedAt` as UTC ISO strings, which sort as text.
 * Every INSERT sets both from `stamp()`; every UPDATE sets `updatedAt` with
 * `TOUCH`, which only moves it forward and never below the row's `createdAt`,
 * so a phone clock set back never makes a row look older than it is or updated
 * before it was created. `src/persistence/writeStatements.test.ts` refuses
 * a write statement in this folder that leaves either out.
 */
export function stamp(): string {
  return new Date().toISOString()
}

/** The SET clause for `updatedAt`; its one parameter is `stamp()`. */
export const TOUCH =
  "updatedAt = max(?, coalesce(updatedAt, ''), coalesce(createdAt, ''))"
