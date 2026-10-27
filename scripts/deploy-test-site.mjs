import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import {
  githubClient,
  isFullRun,
  latestPushRun,
  repositoryFromRemote,
} from "./ci-status.mjs"

import { assertTestPublicationAllowed } from "./test-site-contract.mjs"

// Deliberate publication only. This does not run on ordinary source pushes.
const root = resolve(import.meta.dirname, "..")
const pinPath = join(root, ".milestones/test-site.json")
const git = (parameters, cwd = root) =>
  execFileSync("git", parameters, {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim()
// The pin and the owner results that permit publication are the committed
// ones, never an uncommitted local edit (D4 security review SP-R4-2).
assert.equal(
  git(["status", "--porcelain", "--", ".milestones"]),
  "",
  "Commit the pin and owner checks before publishing",
)
const committed = (path) => JSON.parse(git(["show", `HEAD:${path}`]))
const pin = committed(".milestones/test-site.json")
const args = process.argv.slice(2)
const argument = (name) => args[args.indexOf(name) + 1]
assert(
  args.includes("--source") && args.includes("--version"),
  "Supply --source <full verified commit> --version <patch version>",
)
assert(args.length === 4, "Only --source and --version are accepted")
const source = argument("--source")
const version = argument("--version")
const ownerChecks = committed(".milestones/owner-checks.json")
assertTestPublicationAllowed(pin, source, version, ownerChecks)
git(["merge-base", "--is-ancestor", source, "HEAD"])
const sourceRepository = repositoryFromRemote(
  git(["remote", "get-url", "origin"]),
)
assert.equal(sourceRepository, "FurioColombo/CVC_helper")
assert.equal(pin.repository, "FurioColombo/CVC_helper_test")
assert.equal(pin.testUrl, "https://furiocolombo.github.io/CVC_helper_test/")
assert.equal(pin.basePath, "CVC_helper_test")

// Reuse configured Git credentials in memory; never print or store a token.
const credential = execFileSync("git", ["credential", "fill"], {
  cwd: root,
  input: "protocol=https\nhost=github.com\n\n",
  encoding: "utf8",
  stdio: ["pipe", "pipe", "ignore"],
})
const token = credential
  .split("\n")
  .find((line) => line.startsWith("password="))
  ?.slice(9)
  .trim()
assert(token, "A configured GitHub Git credential is required")
const client = githubClient({ env: { GITHUB_TOKEN: token } })
const run = latestPushRun(await client.runs(sourceRepository, source), source)
assert(
  run?.status === "completed" && run.conclusion === "success",
  "Only green push CI for the exact source commit permits publication",
)
assert(isFullRun(run), "The source commit needs a full CI run, not a quick one")

async function api(route, method = "GET", body) {
  const send = () =>
    fetch(`https://api.github.com${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    })
  // The connection kept from before the minutes-long build can be gone; a
  // request that failed while being written never reached GitHub, so it is
  // sent once more on a new one.
  const unsent = (error) =>
    ["ECONNABORTED", "ECONNRESET", "EPIPE"].includes(error?.cause?.code) &&
    error?.cause?.syscall === "write"
  const response = await send().catch((error) => {
    if (!unsent(error)) throw error
    return send()
  })
  if (response.status === 404 && method === "GET") return null
  assert(response.ok, `GitHub ${method} ${route}: HTTP ${response.status}`)
  return response.status === 204 ? null : response.json()
}
const workspace = mkdtempSync(join(tmpdir(), "cvc-test-publish-"))
assert.equal(
  dirname(resolve(workspace)),
  resolve(tmpdir()),
  "Scratch checkout must stay in the OS temporary directory",
)
const snapshot = join(workspace, "source")
const output = join(workspace, "published")
try {
  mkdirSync(snapshot)
  const archive = join(workspace, "source.tar")
  git(["archive", "--format=tar", "--output", archive, source])
  execFileSync("tar", ["-xf", archive, "-C", snapshot])
  const files = git(["ls-tree", "-r", "--name-only", source])
    .split("\n")
    .filter(
      (file) =>
        !file.startsWith(".evidence/") &&
        !file.startsWith(".milestones/") &&
        !file.endsWith(".md"),
    )
    .sort()
  const hash = createHash("sha256")
  for (const file of files) {
    hash
      .update(file)
      .update("\0")
      .update(
        createHash("sha256")
          .update(readFileSync(join(snapshot, file)))
          .digest("hex"),
      )
      .update("\n")
  }
  const digest = hash.digest("hex")
  const manifest = JSON.parse(
    readFileSync(join(snapshot, ".milestones/manifest.json"), "utf8"),
  )
  const milestone = manifest.milestones.find(
    (entry) => entry.id === pin.milestone,
  )
  const evidence = JSON.parse(
    readFileSync(
      join(snapshot, `.evidence/${pin.milestone}/verification.json`),
      "utf8",
    ),
  )
  // Git's LF archive can differ from a verified Windows CRLF checkout.
  // Require the recorder's clean commit and unchanged source tree, and keep
  // both the recorded digest and the canonical archived digest.
  assert.equal(
    evidence.workingTreeClean,
    true,
    "Verification must identify a clean committed source",
  )
  assert.equal(evidence.status, "PASS", "Recorded verification must pass")
  assert.equal(
    evidence.recorder,
    "scripts/record-verification.mjs@3",
    "Use the repository evidence recorder",
  )
  assert(
    /^[a-f\d]{40}$/.test(evidence.gitCommit),
    "Verification must name its source checkpoint",
  )
  git(["merge-base", "--is-ancestor", evidence.gitCommit, source])
  git([
    "diff",
    "--quiet",
    evidence.gitCommit,
    source,
    "--",
    ".",
    ":!.evidence",
    ":!.milestones",
    ":(exclude)**/*.md",
    ":(exclude)*.md",
  ])
  assert(
    evidence.checks.every((check) => check.status === "PASS"),
    `${pin.milestone} verification must all pass`,
  )
  for (const script of milestone.verificationScripts) {
    assert(
      evidence.checks.some(
        (check) =>
          check.command === `npm run ${script}` && check.status === "PASS",
      ),
      `Missing verification: ${script}`,
    )
  }
  for (const file of milestone.requiredEvidence.filter(
    (file) => !milestone.ownerEvidence.includes(file),
  )) {
    assert(existsSync(join(snapshot, file)), `Missing agent evidence: ${file}`)
  }
  for (const file of milestone.requiredReviews) {
    const review = JSON.parse(readFileSync(join(snapshot, file), "utf8"))
    assert(
      ["PASS", "PASS_WITH_FINDINGS"].includes(review.verdict) &&
        review.blockers.length === 0,
      `Review has blockers: ${file}`,
    )
  }
  if (pin.gitSourceDigest)
    assert.equal(digest, pin.gitSourceDigest, "Pinned source digest changed")
  const npmCli = process.env.npm_execpath
  assert(npmCli, "Run through npm run test-site:publish")
  // npm run hands package.json's allowScripts to its children as
  // npm_config_allow_scripts, which npm 11's own install then refuses as a
  // command-line flag; the snapshot's package.json carries the same list.
  const inherited = { ...process.env }
  delete inherited.npm_config_allow_scripts
  const npm = (parameters, env = {}) =>
    execFileSync(process.execPath, [npmCli, ...parameters], {
      cwd: snapshot,
      env: { ...inherited, ...env },
      stdio: "inherit",
    })
  npm(["ci", "--ignore-scripts"])
  // From 0.5.0 the test app carries the development backup (B3): its three
  // public values come from this working copy's .env, never committed.
  const backupEnvFile = join(root, ".env")
  const withBackup = !version.startsWith("0.4.")
  if (withBackup)
    assert(existsSync(backupEnvFile), "The test build needs .env (B3)")
  npm(["run", "build"], {
    CVC_APP_CHANNEL: "test",
    CVC_BASE_PATH: pin.basePath,
    CVC_APP_VERSION: version,
    ...(withBackup ? { CVC_BACKUP_ENV_FILE: backupEnvFile } : {}),
  })
  if (withBackup) {
    const supabaseUrl = /^SUPABASE_URL=(.*)$/m
      .exec(readFileSync(backupEnvFile, "utf8"))?.[1]
      ?.trim()
    assert(supabaseUrl, "The test build needs SUPABASE_URL in .env")
    const bundles = execFileSync(
      "git",
      ["grep", "-l", "--no-index", "-F", supabaseUrl, "--", "dist/assets"],
      {
        cwd: snapshot,
        encoding: "utf8",
      },
    )
    assert(bundles.trim(), "The test build lacks the backup configuration")
  }
  const builtManifest = JSON.parse(
    readFileSync(join(snapshot, "dist/manifest.webmanifest"), "utf8"),
  )
  assert.equal(builtManifest.name, "CVC Helper Test")
  assert.equal(builtManifest.scope, `/${pin.basePath}/`)
  assert.equal(builtManifest.id, `/${pin.basePath}/`)
  let remote = await api(`/repos/${pin.repository}`)
  if (!remote) {
    remote = await api("/user/repos", "POST", {
      name: "CVC_helper_test",
      description:
        "Permanent isolated CVC Helper Test PWA; verified source snapshots only.",
      private: false,
      has_issues: false,
      has_wiki: false,
      has_projects: false,
    })
  }
  assert.equal(remote.full_name, pin.repository)
  assert(
    !remote.private,
    "GitHub Pages test outputs must be publicly accessible",
  )
  if (git(["ls-remote", "--heads", remote.clone_url, "refs/heads/main"])) {
    git([
      "clone",
      "--branch",
      "main",
      "--single-branch",
      remote.clone_url,
      output,
    ])
    // The build on the site must be the one the pin says is live, or the
    // owner's installed build could change unnoticed (SP-R4-1).
    const live = JSON.parse(
      readFileSync(join(output, "build-info.json"), "utf8"),
    )
    assert.equal(
      live.version,
      pin.activeVersion,
      "The live test build differs from the pin's active version",
    )
    // Only this freshly cloned scratch checkout is cleared; source is untouched.
    assert.equal(dirname(resolve(output)), resolve(workspace))
    git(["rm", "-r", "--ignore-unmatch", "."], output)
  } else {
    mkdirSync(output)
    git(["init", "--initial-branch=main"], output)
    git(["remote", "add", "origin", remote.clone_url], output)
  }
  cpSync(join(snapshot, "dist"), output, { recursive: true })
  const info = {
    sourceCommit: source,
    sourceDigest: evidence.sourceDigest,
    gitSourceDigest: digest,
    version,
    channel: "test",
    testUrl: pin.testUrl,
    ciUrl: run.html_url,
    builtAt: new Date().toISOString(),
  }
  writeFileSync(join(output, ".nojekyll"), "")
  writeFileSync(
    join(output, "build-info.json"),
    `${JSON.stringify(info, null, 2)}\n`,
  )
  git(["add", "--all"], output)
  git(
    [
      "commit",
      "-m",
      `CVC Helper Test ${version}: verified ${pin.milestone} ${source.slice(0, 12)}`,
    ],
    output,
  )
  git(["push", "origin", "main"], output)
  const publishedCommit = git(["rev-parse", "HEAD"], output)
  const pages = await api(`/repos/${pin.repository}/pages`)
  if (!pages)
    await api(`/repos/${pin.repository}/pages`, "POST", {
      build_type: "legacy",
      source: { branch: "main", path: "/" },
    })
  else {
    assert.equal(pages.source?.branch, "main", "Unexpected test Pages source")
    assert.equal(pages.source?.path, "/", "Unexpected test Pages folder")
    assert.equal(pages.build_type, "legacy", "Unexpected test Pages build type")
  }
  Object.assign(pin, {
    sourceCommit: source,
    sourceDigest: evidence.sourceDigest,
    gitSourceDigest: digest,
    activeVersion: version,
    publishedCommit,
    ciUrl: run.html_url,
    phase:
      pin.versions.indexOf(version) < pin.versions.length - 1
        ? "AWAITING_INSTALL"
        : "AWAITING_FEEDBACK",
    publishedAt: new Date().toISOString(),
  })
  writeFileSync(pinPath, `${JSON.stringify(pin, null, 2)}\n`)
  // In the repository's own format, or the next commit fails the format
  // check in CI (seen after the 0.5.1 publication).
  execFileSync(
    process.execPath,
    [join(root, "node_modules/prettier/bin/prettier.cjs"), "--write", pinPath],
    { cwd: root, stdio: "ignore" },
  )
  console.log(
    `Published ${version} from ${source} to ${pin.testUrl}; wait for HTTPS smoke verification before READY.`,
  )
} finally {
  // Validate the absolute target before recursive removal on Windows.
  assert.equal(dirname(resolve(workspace)), resolve(tmpdir()))
  assert(workspace.startsWith(join(tmpdir(), "cvc-test-publish-")))
  rmSync(workspace, { recursive: true, force: true })
}
