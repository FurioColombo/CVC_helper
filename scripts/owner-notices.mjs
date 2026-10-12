import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { readOwnerChecks, validateOwnerChecks } from "./owner-checks.mjs"

export function pendingOwnerNotices(queue, acknowledged = {}) {
  return queue.items.filter(
    (item) =>
      item.status !== "PASSED" &&
      acknowledged[item.id] !== `${item.revision}:${item.status}`,
  )
}

export function noticeSnapshot(queue) {
  return createHash("sha256").update(JSON.stringify(queue.items)).digest("hex")
}

export function acknowledgementFor(queue, expectedSnapshot) {
  if (
    expectedSnapshot !== undefined &&
    expectedSnapshot !== noticeSnapshot(queue)
  ) {
    throw new Error(
      "Owner actions changed after the notice was read; reread and announce them before acknowledging",
    )
  }
  return Object.fromEntries(
    queue.items.map((item) => [item.id, `${item.revision}:${item.status}`]),
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const args = process.argv.slice(2)
    if (
      args.length &&
      (args.length !== 2 ||
        args[0] !== "--ack" ||
        !/^[a-f\d]{64}$/.test(args[1]))
    )
      throw new Error("Usage: npm run owner:notice [-- --ack <snapshot>]")
    const root = resolve(import.meta.dirname, "..")
    const queue = readOwnerChecks(root)
    const manifest = JSON.parse(
      readFileSync(resolve(root, ".milestones/manifest.json"), "utf8"),
    )
    const problems = validateOwnerChecks(queue, manifest)
    if (problems.length) throw new Error(problems.join("\n"))
    const cursor = resolve(root, ".milestones/owner-notices.local.json")
    const acknowledged = existsSync(cursor)
      ? JSON.parse(readFileSync(cursor, "utf8"))
      : {}
    const pending = pendingOwnerNotices(queue, acknowledged)
    const nextAcknowledgement = args.length
      ? acknowledgementFor(queue, args[1])
      : null
    if (!pending.length) console.log("No new owner actions.")
    for (const item of pending)
      console.log(
        `OWNER ACTION: ${item.id} — ${item.status} — ${item.title}; docs/OWNER_TODO.md`,
      )
    console.log(`SNAPSHOT: ${noticeSnapshot(queue)}`)
    if (nextAcknowledgement)
      writeFileSync(cursor, JSON.stringify(nextAcknowledgement, null, 2) + "\n")
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
