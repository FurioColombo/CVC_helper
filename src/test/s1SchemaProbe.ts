import { column, PowerSyncDatabase, Schema, Table } from "@powersync/web"

import { AppSchema } from "@/persistence/schema"

/**
 * S1 spike (0.5.0, not app code): what PowerSync does to a database that an
 * app switches from 0.4.0's local-only course tables to synced ones, and then
 * an older 0.4.0 app opens again. Runs in the browser with no backend:
 * nothing here connects.
 */
type SchemaJson = {
  tables: Array<{
    name: string
    columns: Array<{ name: string; type: string }>
    local_only?: boolean
  }>
}

const appTables = (
  AppSchema as unknown as { toJSON: () => SchemaJson }
).toJSON().tables

function columnsOf(name: string) {
  const table = appTables.find((candidate) => candidate.name === name)
  if (!table) throw new Error(`No app table ${name}`)
  return Object.fromEntries(
    table.columns.map(({ name: columnName, type }) => [
      columnName,
      type.toLowerCase() === "integer" ? column.integer : column.text,
    ]),
  )
}

/** 0.4.0's tables, still declared for their rows, and synced ones in front. */
export function syncedSchema() {
  const tables: Record<string, Table> = {}
  for (const { name } of appTables) {
    const columns = columnsOf(name)
    if (name === "meta") {
      tables.meta = new Table(columns, { localOnly: true })
      continue
    }
    tables[name] = new Table(columns, {
      localOnly: true,
      viewName: `inactive_local_${name}`,
    })
    tables[`synced_${name}`] = new Table(columns, { viewName: name })
  }
  return new Schema(tables)
}

async function open(filename: string, schema: Schema) {
  const database = new PowerSyncDatabase({
    schema,
    database: { dbFilename: filename },
  })
  await database.init()
  return database
}

async function snapshot(database: PowerSyncDatabase) {
  const tables = await database.getAll<{ name: string; type: string }>(
    "SELECT name, type FROM sqlite_master WHERE name LIKE 'ps_data%courses' OR name IN ('courses', 'inactive_local_courses', 'ps_untyped') ORDER BY name",
  )
  const count = async (sql: string) =>
    (await database.getAll<{ n: number }>(sql))[0]?.n ?? null
  const has = (name: string) => tables.some((table) => table.name === name)
  return {
    objects: tables.map((table) => `${table.type}:${table.name}`),
    viewCourses: has("courses")
      ? await count("SELECT count(*) AS n FROM courses")
      : null,
    localRows: has("ps_data_local__courses")
      ? await count("SELECT count(*) AS n FROM ps_data_local__courses")
      : null,
    syncedRows: has("ps_data__synced_courses")
      ? await count("SELECT count(*) AS n FROM ps_data__synced_courses")
      : null,
    untyped: await count(
      "SELECT count(*) AS n FROM ps_untyped WHERE type = 'synced_courses'",
    ),
    crud: await count("SELECT count(*) AS n FROM ps_crud"),
    crudTables: (
      await database.getAll<{ data: string }>("SELECT data FROM ps_crud")
    ).map((row) => (JSON.parse(row.data) as { type: string }).type),
  }
}

export async function runProbe(filename: string) {
  const steps: Record<string, unknown> = {}
  const course = (id: string) => [
    id,
    1,
    "Deriva",
    2,
    38,
    2026,
    "2026-09-12",
    "2026-09-18",
    "probe",
    "2026-09-01T12:00:00.000Z",
    "2026-09-01T12:00:00.000Z",
  ]
  const insert =
    "INSERT INTO courses (id, active, family, level, isoWeek, year, startDate, endDate, label, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"

  // 1. A 0.4.0 device with one course.
  let db = await open(filename, AppSchema)
  await db.execute(insert, course("course-040"))
  steps.v040 = await snapshot(db)
  await db.close()

  // 2. The new version opens it, then copies the course into synced tables.
  db = await open(filename, syncedSchema())
  steps.synced_open = await snapshot(db)
  await db.writeTransaction(async (tx) => {
    await tx.execute("INSERT INTO courses SELECT * FROM inactive_local_courses")
  })
  await db.execute(insert, course("course-050"))
  steps.synced_copied = await snapshot(db)
  await db.close()

  // 3. An older 0.4.0 app opens the same database with its own schema.
  db = await open(filename, AppSchema)
  steps.v040_again = await snapshot(db)
  await db.close()

  // 4. The new version opens it once more.
  db = await open(filename, syncedSchema())
  steps.synced_again = await snapshot(db)
  await db.close()
  return steps
}
