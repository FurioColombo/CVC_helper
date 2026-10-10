import { createDatabase } from "@/persistence/schema"

/**
 * The app's database. Importing this module opens it, so only the app's own
 * persistence modules do (src/persistence/writeStatements.test.ts); a test
 * harness that needs a database of its own uses `createDatabase` instead.
 */
export const db = createDatabase()
