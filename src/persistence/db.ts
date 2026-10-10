import { createDatabase } from "@/persistence/schema"
import { guardWrites } from "@/persistence/writeGuard"

/**
 * The app's database. Importing this module opens it, so only the app's own
 * persistence modules do (src/persistence/writeStatements.test.ts); a test
 * harness that needs a database of its own uses `createDatabase` instead. Its
 * writes refuse when the data is newer than this version may write (D3).
 */
export const db = guardWrites(createDatabase("cvc-helper.db"))
