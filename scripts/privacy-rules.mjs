// Rules for what must never be committed: real course data and secrets.
// scripts/check-staged.mjs applies them to the staged diff from the pre-commit
// hook, so they run for every agent and person who commits, not only for one
// agent's own hooks. The real roster leak that forced the 0.3.0 history rewrite
// went through evidence and archived plans; these rules exist so the shared
// database work, which brings dumps, exports and keys, cannot repeat it.

/** Paths refused outright, whatever they contain. */
export const FORBIDDEN_PATHS = [
  [/^data\//, "data/ holds private rosters, recordings and experiments"],
  [
    /\.(?:db|sqlite3?|db-wal|db-shm|db-journal)$/i,
    "a database file can hold real course data",
  ],
  [/\.(?:dump|backup)$/i, "a database dump or backup can hold real data"],
  [/\.jsonl$/i, "an agent transcript or log can quote raw OCR"],
  [/\.har$/i, "a network capture can carry pasted rosters and tokens"],
  [/(?:^|\/)\.env(?:\.(?!example$)[^/]+)?$/, "environment files hold keys"],
  [/\.(?:pem|key|p12|pfx)$/i, "a private key or certificate"],
]

/** Secrets refused in any added line. */
export const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [
    /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/,
    "a JWT (a Supabase service key is one; keep keys in environment variables)",
  ],
  [/\bsb_secret_[\w-]{10,}/, "a Supabase secret key"],
  [/\bpostgres(?:ql)?:\/\/[^:\s/]+:[^@\s]+@/, "a database URL with a password"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "a GitHub token"],
  [/\bsk-(?:ant-)?[A-Za-z0-9_-]{24,}/, "an API key"],
  [
    /\b[A-Z][A-Z0-9_]*(?:SECRET|PASSWORD|SERVICE_ROLE)[A-Z0-9_]*\s*[:=]\s*['"]?[^\s'"<>{}$]{8,}/,
    "a secret assigned in clear",
  ],
]

/**
 * Italian mobile numbers, the phone format of the centre's rosters. Hex runs
 * (hashes, commit ids) are excluded by the boundaries.
 */
const PHONE =
  /(?<![0-9A-Fa-f.])(?:\+39[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4}(?![0-9A-Fa-f.])/g

/** The invented numbers the synthetic fixtures use; anything else is suspect. */
export const SYNTHETIC_PHONES = new Set([
  "3331234567",
  "3339876543",
  "3205550142",
])

/**
 * Prose, evidence and archives are where real data leaked before; tests and
 * fixtures are synthetic and checked by the denylist instead.
 */
export function isRecordPath(path) {
  return (
    path.startsWith(".evidence/") ||
    path.startsWith("docs/") ||
    path.startsWith("archive/") ||
    /^[^/]+\.md$/.test(path)
  )
}

export function pathProblem(path) {
  for (const [pattern, reason] of FORBIDDEN_PATHS) {
    if (pattern.test(path)) return reason
  }
  return null
}

/**
 * Lowercased denylist entries from data/private/privacy-denylist.txt: real
 * surnames, given names and phone numbers taken from the private rosters, one
 * per line, `#` for comments. The file never leaves the machine.
 */
export function parseDenylist(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3 && !line.startsWith("#"))
    .map((line) => line.toLocaleLowerCase("it-IT"))
}

function containsWord(haystack, word) {
  let from = 0
  for (;;) {
    const at = haystack.indexOf(word, from)
    if (at === -1) return false
    const before = haystack[at - 1]
    const after = haystack[at + word.length]
    const isLetterOrDigit = (char) =>
      char !== undefined && /[\p{L}\p{N}]/u.test(char)
    if (!isLetterOrDigit(before) && !isLetterOrDigit(after)) return true
    from = at + 1
  }
}

/**
 * Problems in one added line. Reasons never repeat the matched text, so a hit
 * on a real name or key is not copied into a terminal or transcript.
 */
export function lineProblems(path, line, denylist = []) {
  const problems = []
  for (const [pattern, reason] of SECRET_PATTERNS) {
    if (pattern.test(line)) problems.push(reason)
  }
  if (isRecordPath(path)) {
    for (const match of line.matchAll(PHONE)) {
      // A bare JSON number (a review's seed, a size) is not a phone: stored
      // phones are strings.
      const jsonNumber =
        /^\d+$/.test(match[0]) &&
        /"\s*:\s*$/.test(line.slice(0, match.index)) &&
        /^\s*[,}\]]?\s*$/.test(line.slice(match.index + match[0].length))
      if (jsonNumber) continue
      const digits = match[0].replace(/\D/g, "").replace(/^39(?=3\d{9}$)/, "")
      if (!SYNTHETIC_PHONES.has(digits)) {
        problems.push(
          "a phone number that is not one of the synthetic fixtures'",
        )
        break
      }
    }
  }
  if (denylist.length > 0) {
    const lower = line.toLocaleLowerCase("it-IT")
    if (denylist.some((entry) => containsWord(lower, entry))) {
      problems.push("a name or number from the private denylist")
    }
  }
  return problems
}

/** Added lines per file from `git diff --cached -U0` output. */
export function addedLines(diff) {
  const files = new Map()
  let current = null
  let lineNumber = 0
  let previous = ""
  for (const raw of diff.split("\n")) {
    const header = raw.startsWith("+++ ") && previous.startsWith("--- ")
    previous = raw
    // An added line that itself starts with "++ " also reads "+++ "; only the
    // line right after "--- " is a file header.
    if (header) {
      // Git ends a header whose path has a space with a TAB.
      current = raw === "+++ /dev/null" ? null : raw.slice(6).replace(/\t$/, "")
      if (current && !files.has(current)) files.set(current, [])
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
    if (hunk) {
      lineNumber = Number(hunk[1])
      continue
    }
    if (!current) continue
    if (raw.startsWith("+")) {
      files.get(current).push({ lineNumber, text: raw.slice(1) })
      lineNumber += 1
    }
  }
  return files
}
