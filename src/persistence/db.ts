import { appChannelConfig } from "@/runtimeConfig"
import { createDatabase } from "@/persistence/schema"
import {
  noteOpenedSchema,
  schemaFor,
  syncModeHint,
} from "@/persistence/syncMode"
import { guardWrites } from "@/persistence/writeGuard"

/**
 * The app's database. Importing this module opens it, so only the app's own
 * persistence modules do (src/persistence/writeStatements.test.ts); a test
 * harness that needs a database of its own uses `createDatabase` instead. Its
 * writes refuse when the data is newer than this version may write (D3). It
 * opens with the schema of the mode this device last used (B1); the open
 * corrects it from the data before the first read (prepareDatabase).
 */
const schema = schemaFor(syncModeHint(appChannelConfig.syncModeKey))
const database = createDatabase(appChannelConfig.databaseFilename, schema)
noteOpenedSchema(database, schema)

export const db = guardWrites(database)
