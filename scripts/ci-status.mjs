// Read-only GitHub Actions status for HEAD; no gh installation is required.
// The CI mode fails open to running all checks, never to an unproven PASS.
import { execFileSync } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"
import { pathToFileURL } from "node:url"

const WORKFLOW_PATH = ".github/workflows/ci.yml"
const root = new URL("../", import.meta.url)

export function repositoryFromRemote(remote) {
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(
      remote.trim(),
    )
  if (!match) throw new Error("origin must name a GitHub repository")
  return match[1]
}

export function latestPushRun(runs, sha, excludedId) {
  return runs
    .filter(
      (run) =>
        run.event === "push" &&
        run.head_sha === sha &&
        run.path?.split("@")[0] === WORKFLOW_PATH &&
        String(run.id) !== String(excludedId),
    )
    .sort(
      (a, b) =>
        Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.id - a.id,
    )[0]
}

export function githubClient({ env = process.env, fetchImpl = fetch } = {}) {
  const headers = { Accept: "application/vnd.github+json" }
  const token = env.GITHUB_TOKEN || env.GH_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  const base = env.GITHUB_API_URL || "https://api.github.com"

  async function get(route) {
    const response = await fetchImpl(`${base}${route}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`)
    return response.json()
  }

  async function pages(route, key) {
    const items = []
    for (let page = 1; page <= 10; page += 1) {
      const data = await get(
        `${route}${route.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      )
      const batch = key ? data[key] : data
      if (!Array.isArray(batch))
        throw new Error("Unexpected GitHub API response")
      items.push(...batch)
      if (batch.length < 100) return items
    }
    throw new Error("GitHub API pagination limit reached; result unknown")
  }

  return {
    runs: (repo, sha) =>
      pages(
        `/repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push`,
        "workflow_runs",
      ),
    jobs: (repo, run) =>
      pages(
        `/repos/${repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`,
        "jobs",
      ),
    annotations: (repo, id) =>
      pages(`/repos/${repo}/check-runs/${id}/annotations`),
  }
}

export async function alreadyVerified(client, repo, sha, env = process.env) {
  // A manual dispatch or a rerun of this run deliberately repeats checks.
  if (env.GITHUB_EVENT_NAME !== "push" || Number(env.GITHUB_RUN_ATTEMPT) !== 1)
    return false
  const run = latestPushRun(
    await client.runs(repo, sha),
    sha,
    env.GITHUB_RUN_ID,
  )
  return run?.status === "completed" && run.conclusion === "success"
}

export async function failedDetails(client, repo, run) {
  const lines = []
  for (const job of await client.jobs(repo, run)) {
    if (
      !job.conclusion ||
      ["success", "skipped", "neutral"].includes(job.conclusion)
    )
      continue
    lines.push(`Job: ${job.name} (${job.conclusion})`)
    for (const step of job.steps ?? []) {
      if (
        step.conclusion &&
        !["success", "skipped", "neutral"].includes(step.conclusion)
      ) {
        lines.push(`  Step: ${step.name} (${step.conclusion})`)
      }
    }
    const checkId = /\/check-runs\/(\d+)$/.exec(job.check_run_url ?? "")?.[1]
    if (!checkId) continue
    try {
      const annotations = await client.annotations(repo, checkId)
      for (const annotation of annotations.filter(
        (a) => a.annotation_level === "failure",
      )) {
        const location = `${annotation.path}:${annotation.start_line}`
        const title =
          annotation.title || annotation.message?.split("\n")[0] || "Failure"
        lines.push(`  Test/check: ${title} (${location})`)
      }
      if (!annotations.some((a) => a.annotation_level === "failure")) {
        lines.push(
          "  No test titles published in GitHub annotations; open the run for logs.",
        )
      }
    } catch {
      lines.push("  Test annotations unavailable; open the run for logs.")
    }
  }
  return lines
}

export async function ciStatus({
  client,
  repo,
  sha,
  wait = false,
  timeoutMs = 10 * 60_000,
  sleep = delay,
  now = Date.now,
  write = console.log,
}) {
  const deadline = now() + timeoutMs
  let previous
  do {
    const run = latestPushRun(await client.runs(repo, sha), sha)
    const state = run
      ? `${run.status}/${run.conclusion ?? "pending"}`
      : "missing"
    const summary = `CI ${sha.slice(0, 12)}: ${state}${run ? ` — ${run.html_url}` : " (push this commit to start CI)"}`
    if (summary !== previous) write(summary)
    previous = summary
    if (run?.status === "completed") {
      if (run.conclusion === "success") return 0
      try {
        for (const line of await failedDetails(client, repo, run)) write(line)
      } catch {
        write("Failed-step details unavailable; open the run for logs.")
      }
      return 1
    }
    if (!wait) return 2
    const remaining = deadline - now()
    if (remaining <= 0) break
    await sleep(Math.min(15_000, remaining))
  } while (now() < deadline)
  write("CI wait timed out; completion has not been established.")
  return 2
}

async function main() {
  const args = process.argv.slice(2)
  const skipMode = args.includes("--skip-verified")
  try {
    if (
      args.some((arg) => !["--wait", "--skip-verified"].includes(arg)) ||
      (skipMode && args.includes("--wait"))
    ) {
      throw new Error(
        "Usage: npm run ci:status -- [--wait] (CI: --skip-verified)",
      )
    }
    const git = (args) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
    const repo =
      process.env.GITHUB_REPOSITORY ||
      repositoryFromRemote(git(["remote", "get-url", "origin"]))
    const sha = process.env.GITHUB_SHA || git(["rev-parse", "HEAD"])
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[a-f\d]{40}$/.test(sha)) {
      throw new Error("Invalid repository or commit")
    }
    const client = githubClient()
    if (skipMode) {
      const verified = await alreadyVerified(client, repo, sha)
      console.log(`verified=${verified}`)
      if (verified)
        console.error(`Reusing successful push verification of ${sha}.`)
      return
    }
    if (git(["status", "--porcelain"]))
      console.log(
        "Working tree has changes: this result covers the committed HEAD only.",
      )
    process.exitCode = await ciStatus({
      client,
      repo,
      sha,
      wait: args.includes("--wait"),
    })
  } catch (error) {
    console.error(`CI status unavailable: ${error.message}`)
    if (skipMode) console.log("verified=false")
    else process.exitCode = 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main()
