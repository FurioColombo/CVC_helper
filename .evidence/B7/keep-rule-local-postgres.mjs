import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { readFileSync, readdirSync, mkdtempSync } from "node:fs"
import { join } from "node:path"
const [pkg, repo, scratch] = process.argv.slice(2)
const require = createRequire(join(pkg, "x.js"))
const EmbeddedPostgres = require("embedded-postgres").default ?? require("embedded-postgres")
const pgm = require("pg")
const dir = mkdtempSync(join(scratch, "pgdata-"))
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "x", port: 54331, persistent: false, onLog: () => {} })
await pg.initialise(); await pg.start(); await pg.createDatabase("t")
const conn = async () => { const c = new pgm.Client({ host: "127.0.0.1", port: 54331, user: "postgres", password: "x", database: "t" }); await c.connect(); return c }
const admin = await conn()
await admin.query(`create role anon; create role authenticated; create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;`)
const files = readdirSync(join(repo, "supabase/migrations")).sort()
for (const f of files) await admin.query(readFileSync(join(repo, "supabase/migrations", f), "utf8"))
await admin.query(readFileSync(join(repo, "supabase/migrations", files.at(-1)), "utf8"))
console.log("migrated, last file run twice")
const U = "11111111-1111-4111-8111-111111111111", OTHER = "22222222-2222-4222-8222-222222222222"
const T0 = "2026-11-04T10:00:00.000Z", T1 = "2026-11-04T11:00:00.000Z"
const as = async (uid = U, version = "0.5.4", role = "authenticated") => { const c = await conn(); await c.query(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false), set_config('request.headers','${JSON.stringify({ "x-cvc-app-version": version })}',false)`); return c }
const reset = () => admin.query(`delete from public.courses; delete from public.erased_courses;`)
const addCourse = (id, owner = U, active = 1) => admin.query(`insert into public.courses(id,"ownerId",active,label,"updatedAt") values ($1,$2,$3,$1,$4)`, [id, owner, active, T0])
const addStudent = (id, course, at = T0) => admin.query(`insert into public.students(id,"courseId","firstName","updatedAt") values ($1,$2,'Sintetica',$3)`, [id, course, at])
const state = async () => ({ courses: (await admin.query(`select id from public.courses order by id`)).rows.map(r => r.id), erased: (await admin.query(`select id from public.erased_courses order by id`)).rows.map(r => r.id), students: (await admin.query(`select id from public.students order by id`)).rows.map(r => r.id) })
const keep = async (c, id, giveUp) => { try { await c.query(`select public.keep_course($1,$2::jsonb)`, [id, giveUp === null ? null : JSON.stringify(giveUp)]); return "kept" } catch (e) { return `error ${e.code}` } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
// What the app sends: src/persistence/courseFingerprint.ts.
const fp = (...rows) => createHash("sha256").update(rows.map((row) => row.join("\t")).sort().join("\n")).digest("hex")
const courseRow = (id, at = T0) => ["courses", id, at]
const studentRow = (id, at = T0) => ["students", id, at]
let failed = 0
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; if (!ok) failed++; console.log(ok ? "ok  " : "FAIL", name, ok ? "" : `\n  got  ${g}\n  want ${w}`) }

// The same value as src/persistence/courseFingerprint.test.ts, computed by the SQL.
await reset(); await addCourse("K"); await admin.query(`insert into public.courses(id,"ownerId",active,label,"updatedAt") values ('X',$1,1,'X','2026-11-04T09:00:00.000Z')`, [U]); await addStudent("x1", "X", "2026-11-04T10:00:00.000Z");
{
  const pinned = "1ed019069dbd4feea647dfc3a9c190ee9e47e36bd46372ec7956141872036244"
  await admin.query(`insert into public."crewMembers"(id,"courseId","updatedAt") values ('m1','X',null)`)
  const a = await as()
  check("the SQL computes the app's pinned value", [await keep(a, "K", { X: pinned }), (await state()).courses], ["kept", ["K"]])
  await a.end()
}

await reset(); await addCourse("K"); await addCourse("X"); await addCourse("Z"); await addStudent("z1", "Z")
{
  const a = await as()
  const shown = { X: fp(courseRow("X")), Z: fp(courseRow("Z"), studentRow("z1")) }
  check("a course not shown refuses the whole choice", [await keep(a, "K", { X: shown.X }), await state()], ["error CVNEW", { courses: ["K","X","Z"], erased: [], students: ["z1"] }])
  check("naming all of them keeps one", [await keep(a, "K", shown), await state()], ["kept", { courses: ["K"], erased: ["X","Z"], students: [] }])
  check("the same choice again, as after a lost answer", [await keep(a, "K", shown), await state()], ["kept", { courses: ["K"], erased: ["X","Z"], students: [] }])
  check("the course given up is gone", await keep(a, "X", { K: fp(courseRow("K")) }), "error CVGON")
  await a.end()
}

await reset(); await addCourse("K"); await addCourse("X"); await addStudent("x1", "X", T1); await addStudent("x2", "X", T0)
{
  const a = await as()
  const seen = fp(courseRow("X"), studentRow("x1", T1), studentRow("x2", T0))
  await addStudent("late", "X", T0)
  check("a row with an older stamp the device never saw refuses (SC-B7-9)", [await keep(a, "K", { X: seen }), (await state()).courses], ["error CVNEW", ["K","X"]])
  await admin.query(`delete from public.students where id='late'`)
  await admin.query(`update public.students set "updatedAt"=$1 where id='x2'`, ["2026-11-04T10:30:00.000Z"])
  check("an edit stamped below the newest one the device saw refuses", await keep(a, "K", { X: seen }), "error CVNEW")
  await admin.query(`delete from public.students where id='x2'`)
  check("a row the device saw that is gone refuses", await keep(a, "K", { X: seen }), "error CVNEW")
  await addStudent("x2", "X", T0)
  check("a stamp from a clock ahead does not pass", await keep(a, "K", { X: "2099-01-01T00:00:00.000Z" }), "error CVNEW")
  check("no fingerprint refuses", [await keep(a, "K", { X: null }), (await state()).courses], ["error CVNEW", ["K","X"]])
  check("a value that is no text refuses", await keep(a, "K", { X: { nested: seen } }), "error CVNEW")
  check("null give_up refuses", await keep(a, "K", null), "error CVNEW")
  check("what it saw is what is there", [await keep(a, "K", { X: seen }), (await state()).courses], ["kept", ["K"]])
  await a.end()
}

await reset(); await addCourse("K"); await addCourse("X"); await addStudent("k1", "K", T1)
{ const a = await as(); check("a change of the course kept does not matter", [await keep(a, "K", { X: fp(courseRow("X")) }), await state()], ["kept", { courses: ["K"], erased: ["X"], students: ["k1"] }]); await a.end() }

await reset(); await addCourse("K"); await admin.query(`insert into public.courses(id,"ownerId",active,label) values ('X',$1,1,'X')`, [U])
{ const a = await as(); check("a row with no stamp reads as empty on both sides", [await keep(a, "K", { X: fp(["courses", "X", ""]) }), (await state()).courses], ["kept", ["K"]]); await a.end() }

await reset(); await addCourse("K"); await addCourse("X"); await addCourse("OFF", U, 0)
{ const a = await as(); check("a course switched off is neither named nor touched", [await keep(a, "K", { X: fp(courseRow("X")) }), await state()], ["kept", { courses: ["K","OFF"], erased: ["X"], students: [] }]); check("it cannot be the one kept", await keep(a, "OFF", { K: fp(courseRow("K")) }), "error CVGON"); await a.end() }

await reset(); await addCourse("K"); await addCourse("X"); await addCourse("F", OTHER)
{ const a = await as(); check("another account's course is not this one's to keep", [await keep(a, "F", { K: T0, X: T0 }), (await state()).courses], ["error CVGON", ["F","K","X"]]); check("nor to give up", [await keep(a, "K", { X: fp(courseRow("X")), F: fp(courseRow("F")) }), await state()], ["kept", { courses: ["F","K"], erased: ["X"], students: [] }]); await a.end() }

await reset(); await addCourse("K"); await addCourse("X")
{ const old = await as(U, "0.4.0"); check("an outdated writer changes nothing", [await keep(old, "K", { X: fp(courseRow("X")) }), (await state()).courses], ["error CVOLD", ["K","X"]]); await old.end() }

await reset(); await addCourse("K"); await addCourse("X")
{ const anon = await as(U, "0.5.4", "anon"); check("anon may not call it", await keep(anon, "K", { X: fp(courseRow("X")) }), "error 42501"); await anon.end() }
{ const a = await as(); check("the old one-argument function is gone", await a.query(`select public.keep_course('K')`).then(() => "there", (e) => e.code), "42883"); await a.end() }

const tally = {}
for (let i = 0; i < 200; i++) {
  await reset(); await addCourse("K"); await addCourse("X"); await addStudent("k1", "K"); await addStudent("x1", "X")
  const a = await as(), b = await as()
  const [ra, rb] = await Promise.all([keep(a, "K", { X: fp(courseRow("X"), studentRow("x1")) }), keep(b, "X", { K: fp(courseRow("K"), studentRow("k1")) })])
  const s = await state()
  const key = `${[ra, rb].sort().join("|")}|${s.courses.length}|${s.students.length}|${s.erased.length}`
  tally[key] = (tally[key] ?? 0) + 1
  await a.end(); await b.end()
}
check("200 opposite choices at once keep exactly one", Object.keys(tally), ["error CVGON|kept|1|1|1"]); console.log("    tally", JSON.stringify(tally))

await reset(); await addCourse("K"); await addCourse("X")
{
  const up = await as(); await up.query("begin"); await up.query(`update public.courses set label='edit' where id='K'`)
  const a = await as(); const pending = keep(a, "K", { X: fp(courseRow("X")) }); await sleep(400)
  const c = await as(); const z = c.query(`insert into public.courses(id,active,label) values ('Z',1,'Z')`).then(() => "accepted", (e) => e.code)
  await sleep(200); await up.query("commit")
  const r = await pending, zr = await z
  check("a course arriving during the wait stays, with no record", [r, zr, await state()], ["kept", "accepted", { courses: ["K","Z"], erased: ["X"], students: [] }])
  await up.end(); await a.end(); await c.end()
}
await reset(); await addCourse("K"); await addCourse("X"); await addStudent("x1", "X")
{
  const hold = await as(); await hold.query("begin"); await hold.query(`select id from public.students where id='x1' for update`)
  const a = await as(); const pending = keep(a, "K", { X: fp(courseRow("X"), studentRow("x1")) }); await sleep(400)
  const b = await as(); const upsert = b.query(`insert into public.courses(id,active,label,"updatedAt") values ('X',1,'offline edit','${T1}') on conflict (id) do update set label=excluded.label, "updatedAt"=excluded."updatedAt"`).then(() => "accepted", (e) => `error ${e.code}`)
  await sleep(400); await hold.query("commit")
  check("an upload of the course given up during the erase is refused", [await pending, await upsert, await state()], ["kept", "error CVERA", { courses: ["K"], erased: ["X"], students: [] }])
  await hold.end(); await a.end(); await b.end()
}
await reset(); await addCourse("K"); await addCourse("X")
{ const c = await as(); check("an ordinary edit of a course still passes the trigger", await c.query(`update public.courses set label='fine', "updatedAt"='${T1}' where id='K'`).then(() => "accepted", (e) => e.code), "accepted"); await c.end() }
{
  const rounds = {}
  for (let i = 0; i < 150; i++) {
    await reset(); await addCourse("K"); await addCourse("X")
    const a = await as(), e1 = await as(), e2 = await as()
    const edit = (c, id) => c.query(`update public.courses set label='edit', "updatedAt"='${T1}' where id='${id}'`).then(() => "ok", (e) => e.code)
    const [rk, r1, r2] = await Promise.all([keep(a, "K", { X: fp(courseRow("X")) }), edit(e1, "K"), edit(e2, "X")])
    const key = [/40P01/.test(rk) ? "keep-40P01" : "keep-done", r1 === "40P01" || r2 === "40P01" ? "edit-40P01" : "edits-done"].join("|")
    rounds[key] = (rounds[key] ?? 0) + 1
    await a.end(); await e1.end(); await e2.end()
  }
  const deadlocks = Object.entries(rounds).filter(([k]) => k.includes("40P01")).reduce((n, [, v]) => n + v, 0)
  check("150 choices against edits of course rows: no deadlock", deadlocks, 0); console.log("    tally", JSON.stringify(rounds))
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED")
await admin.end(); await pg.stop(); process.exit(failed ? 1 : 0)
