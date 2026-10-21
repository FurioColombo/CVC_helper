import { describe, expect, it, vi } from "vitest"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import {
  alreadyVerified,
  ciStatus,
  failedDetails,
  githubClient,
  isFullRun,
  latestPushRun,
  repositoryFromRemote,
} from "./ci-status.mjs"

const sha = "a".repeat(40)
const repo = "example/course-helper"
const run = (extra = {}) => ({
  id: 10,
  run_attempt: 1,
  head_sha: sha,
  event: "push",
  path: ".github/workflows/ci.yml",
  updated_at: "2026-10-12T10:00:00Z",
  status: "completed",
  conclusion: "success",
  html_url: "https://github.com/example/course-helper/actions/runs/10",
  ...extra,
})
const pushEnv = {
  GITHUB_EVENT_NAME: "push",
  GITHUB_RUN_ID: "20",
  GITHUB_RUN_ATTEMPT: "1",
}

describe("CI run selection and reuse", () => {
  it("accepts workflow paths with GitHub's documented ref suffix", async () => {
    for (const workflowPath of [
      ".github/workflows/ci.yml",
      ".github/workflows/ci.yml@main",
      ".github/workflows/ci.yml@refs/heads/codex/0.4.0",
    ]) {
      const result = run({ path: workflowPath })
      expect(latestPushRun([result], sha)).toBe(result)
      expect(
        await alreadyVerified(
          { runs: async () => [result] },
          repo,
          sha,
          pushEnv,
        ),
      ).toBe(true)
    }
  })
  it("recognises HTTPS and SSH origin URLs", () => {
    for (const remote of [
      "https://github.com/example/course-helper",
      "https://github.com/example/course-helper.git",
      "git@github.com:example/course-helper.git",
    ])
      expect(repositoryFromRemote(remote)).toBe(repo)
    expect(() =>
      repositoryFromRemote("https://elsewhere.test/example/repo"),
    ).toThrow()
  })

  it("requires a push of this workflow and exact commit, excluding the current run", () => {
    expect(
      latestPushRun(
        [
          run({ id: 20 }),
          run({ id: 30, event: "workflow_dispatch" }),
          run({ id: 40, head_sha: "b".repeat(40) }),
          run({ id: 50, path: ".github/workflows/deploy-pages.yml" }),
          run(),
        ],
        sha,
        "20",
      )?.id,
    ).toBe(10)
  })

  it("does not hide newer failed or running checks behind an old success", () => {
    for (const extra of [
      { conclusion: "failure" },
      { status: "in_progress", conclusion: null },
    ]) {
      const newest = run({
        id: 11,
        updated_at: "2026-10-12T11:00:00Z",
        ...extra,
      })
      expect(latestPushRun([run(), newest], sha)).toBe(newest)
    }
  })

  it("uses the newest rerun attempt even when its original run id is older", () => {
    const rerun = run({
      id: 9,
      run_attempt: 2,
      updated_at: "2026-10-12T12:00:00Z",
      conclusion: "failure",
    })
    expect(latestPushRun([run(), rerun], sha)).toBe(rerun)
  })

  it("reuses a green commit from another branch but not a manual dispatch or rerun", async () => {
    const client = {
      runs: vi.fn().mockResolvedValue([run({ head_branch: "other-branch" })]),
    }
    expect(await alreadyVerified(client, repo, sha, pushEnv)).toBe(true)
    for (const env of [
      { ...pushEnv, GITHUB_EVENT_NAME: "workflow_dispatch" },
      { ...pushEnv, GITHUB_RUN_ATTEMPT: "2" },
      { ...pushEnv, GITHUB_RUN_ATTEMPT: undefined },
    ])
      expect(await alreadyVerified(client, repo, sha, env)).toBe(false)
  })

  it("does not skip missing, failed, cancelled, pending or self-only results", async () => {
    for (const runs of [
      [],
      [run({ conclusion: "failure" })],
      [run({ conclusion: "cancelled" })],
      [run({ status: "queued", conclusion: null })],
      [run({ id: 20 })],
    ]) {
      expect(
        await alreadyVerified({ runs: async () => runs }, repo, sha, pushEnv),
      ).toBe(false)
    }
  })
})

describe("command-line failure handling", () => {
  const execute = (args, env = {}) =>
    spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./ci-status.mjs", import.meta.url)), ...args],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_REPOSITORY: "invalid",
          GITHUB_SHA: sha,
          ...env,
        },
      },
    )

  it("runs checks when CI reuse cannot be established", () => {
    const result = execute(["--skip-verified"])
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe("verified=false")
    expect(result.stderr).toContain("Invalid repository or commit")
  })

  it("returns unknown, not success, for unavailable local status", () => {
    const result = execute([])
    expect(result.status).toBe(2)
    expect(result.stdout).not.toContain("success")
  })

  it("keeps manual reruns on the full-check path without consulting the API", () => {
    const result = execute(["--skip-verified"], {
      GITHUB_REPOSITORY: repo,
      GITHUB_EVENT_NAME: "push",
      GITHUB_RUN_ATTEMPT: "2",
    })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe("verified=false")
  })
})

describe("read-only GitHub API", () => {
  it("uses the public API without authentication and paginates", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: Array.from({ length: 100 }, (_, id) => run({ id })),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workflow_runs: [run({ id: 101 })] }),
      })
    const runs = await githubClient({ env: {}, fetchImpl }).runs(repo, sha)
    expect(runs).toHaveLength(101)
    expect(fetchImpl.mock.calls[0][0]).toContain(
      `head_sha=${sha}&event=push&per_page=100&page=1`,
    )
    expect(fetchImpl.mock.calls[1][0]).toContain("page=2")
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined()
    expect(fetchImpl.mock.calls[0][1].method).toBeUndefined()
  })

  it("uses an optional token and the specific run attempt for jobs", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ jobs: [] }) })
    await githubClient({
      env: { GH_TOKEN: "synthetic-test-token" },
      fetchImpl,
    }).jobs(repo, run({ run_attempt: 2 }))
    expect(fetchImpl.mock.calls[0][0]).toContain(
      "/actions/runs/10/attempts/2/jobs",
    )
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer synthetic-test-token",
    )
  })

  it("rejects API errors and malformed replies rather than reporting green", async () => {
    for (const response of [
      { ok: false, status: 403 },
      { ok: true, json: async () => ({ message: "unexpected" }) },
    ]) {
      const client = githubClient({ env: {}, fetchImpl: async () => response })
      await expect(client.runs(repo, sha)).rejects.toThrow()
    }
  })
})

describe("status and failed-test diagnostics", () => {
  const status = async (runs) => {
    const lines = []
    const code = await ciStatus({
      client: { runs: async () => runs, jobs: async () => [] },
      repo,
      sha,
      write: (line) => lines.push(line),
    })
    return { code, lines }
  }

  it("returns distinct success, non-success and unestablished results", async () => {
    expect((await status([run()])).code).toBe(0)
    expect((await status([run({ conclusion: "cancelled" })])).code).toBe(1)
    expect(
      (await status([run({ status: "queued", conclusion: null })])).code,
    ).toBe(2)
    const missing = await status([])
    expect(missing.code).toBe(2)
    expect(missing.lines[0]).toContain("push this commit")
  })

  it("waits through a not-yet-visible run and reports state changes only", async () => {
    const client = {
      runs: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          run({ status: "in_progress", conclusion: null }),
        ])
        .mockResolvedValueOnce([
          run({ status: "in_progress", conclusion: null }),
        ])
        .mockResolvedValueOnce([run()]),
    }
    const write = vi.fn()
    const code = await ciStatus({
      client,
      repo,
      sha,
      wait: true,
      now: () => 0,
      sleep: async () => {},
      write,
    })
    expect(code).toBe(0)
    expect(write).toHaveBeenCalledTimes(3)
  })

  it("ends a bounded wait without inventing a PASS", async () => {
    let time = 0
    const write = vi.fn()
    const code = await ciStatus({
      client: { runs: async () => [] },
      repo,
      sha,
      wait: true,
      timeoutMs: 1,
      now: () => time,
      sleep: async (ms) => {
        time += ms
      },
      write,
    })
    expect(code).toBe(2)
    expect(write.mock.calls.at(-1)[0]).toContain("timed out")
  })

  it("shows failed steps and test titles, with a graceful annotation fallback", async () => {
    const client = {
      jobs: async () => [
        {
          name: "verify",
          conclusion: "failure",
          check_run_url:
            "https://api.github.com/repos/example/course-helper/check-runs/99",
          steps: [{ name: "npm run verify:all", conclusion: "failure" }],
        },
      ],
      annotations: async () => [
        {
          annotation_level: "failure",
          title: "[Pixel 7] › smoke.spec.ts › opens the course",
          path: "tests/e2e/smoke.spec.ts",
          start_line: 10,
        },
      ],
    }
    const lines = await failedDetails(
      client,
      repo,
      run({ conclusion: "failure" }),
    )
    expect(lines).toContain("  Step: npm run verify:all (failure)")
    expect(lines.some((line) => line.includes("opens the course"))).toBe(true)
    client.annotations = async () => {
      throw new Error("unavailable")
    }
    expect((await failedDetails(client, repo, run())).at(-1)).toContain(
      "annotations unavailable",
    )
  })

  it("retains a FAIL when optional diagnostics cannot be fetched", async () => {
    const code = await ciStatus({
      client: {
        runs: async () => [run({ conclusion: "failure" })],
        jobs: async () => {
          throw new Error("offline")
        },
      },
      repo,
      sha,
      write: () => {},
    })
    expect(code).toBe(1)
  })
})

describe("CI tiers", () => {
  const quick = (extra = {}) =>
    run({ display_title: "Quick verification · abc", ...extra })

  it("treats only runs named quick as quick, so older runs stay full", () => {
    expect(isFullRun(quick())).toBe(false)
    expect(isFullRun(run({ display_title: "Full verification · abc" }))).toBe(
      true,
    )
    expect(isFullRun(run({ display_title: "D4: hand over" }))).toBe(true)
    expect(isFullRun(run())).toBe(true)
  })

  it("never lets a quick run stand in for a full one", async () => {
    const client = { runs: async () => [quick({ head_branch: "other" })] }
    expect(
      await alreadyVerified(client, repo, sha, { ...pushEnv, CI_TIER: "full" }),
    ).toBe(false)
    expect(await alreadyVerified(client, repo, sha, pushEnv)).toBe(false)
    expect(
      await alreadyVerified(client, repo, sha, {
        ...pushEnv,
        CI_TIER: "quick",
      }),
    ).toBe(true)
  })

  it("says which tier a status line reports", async () => {
    const lines = []
    await ciStatus({
      client: { runs: async () => [quick()] },
      repo,
      sha,
      write: (line) => lines.push(line),
    })
    expect(lines[0]).toContain("(quick)")
  })
})
