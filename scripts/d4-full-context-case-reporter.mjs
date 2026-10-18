import { appendFile, mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const OUTPUT_PATH =
  process.env.CVC_D4_CASE_MARKER_OUTPUT ||
  path.join(os.tmpdir(), "cvc-d4-full-context-case-markers.jsonl")
const MAX_MARKER_BYTES = 32 * 1024
const TARGET_PROJECT = "iphone-13-webkit-core"
const TARGET_FILE = "d1-migration.spec.ts"
const TARGET_TITLE =
  "upgrades and reopens a 40-student course within five seconds each"

export default class D4FullContextCaseReporter {
  constructor() {
    this.bytes = 0
    this.disabled = false
    this.chain = Promise.resolve()
  }

  async onBegin() {
    try {
      await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
      await writeFile(OUTPUT_PATH, "", "utf8")
    } catch {
      this.disable()
    }
  }

  onTestBegin(test, result) {
    if (!this.isTarget(test)) return
    return this.enqueue({
      type: "case_start",
      timestamp: new Date().toISOString(),
      epochMs: Date.now(),
      project: TARGET_PROJECT,
      file: TARGET_FILE,
      title: TARGET_TITLE,
      retry: result.retry,
    })
  }

  onTestEnd(test, result) {
    if (!this.isTarget(test)) return
    return this.enqueue({
      type: "case_end",
      timestamp: new Date().toISOString(),
      epochMs: Date.now(),
      project: TARGET_PROJECT,
      file: TARGET_FILE,
      title: TARGET_TITLE,
      retry: result.retry,
      status: result.status,
      durationMs: result.duration,
    })
  }

  async onEnd() {
    await this.chain
  }

  isTarget(test) {
    return (
      test.title === TARGET_TITLE &&
      path.basename(test.location.file) === TARGET_FILE &&
      test.parent.project()?.name === TARGET_PROJECT
    )
  }

  enqueue(record) {
    this.chain = this.chain
      .then(async () => {
        if (this.disabled) return
        const line = JSON.stringify(record) + "\n"
        const bytes = Buffer.byteLength(line)
        if (this.bytes + bytes > MAX_MARKER_BYTES) return
        await appendFile(OUTPUT_PATH, line, "utf8")
        this.bytes += bytes
      })
      .catch(() => this.disable())
    return this.chain
  }

  disable() {
    if (this.disabled) return
    this.disabled = true
    process.stderr.write("D4 case marker telemetry unavailable.\n")
  }
}
