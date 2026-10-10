import path from "node:path"
import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

// Unit tests run in Node. Only component tests and the few modules that read
// the DOM, the clipboard or browser storage get jsdom, whose start-up and the
// Testing Library setup took a third of the whole run (H1,
// .evidence/H1/test-timing.json). A test that needs the DOM and is missing
// from this list fails with "window is not defined" unless the module catches
// that error and falls back (crewDisplayPreference does): tests of such
// fallbacks belong here too.
const domTests = [
  "src/**/*.test.tsx",
  "src/capabilities/studentScan.worker.test.ts",
  "src/features/crews/crewDisplayPreference.test.ts",
  "src/lib/pageSnapshot.test.ts",
  "src/lib/summaryShare.test.ts",
  "src/navigation/applyUpdate.test.ts",
  "src/navigation/browserHistory.test.ts",
  "src/persistence/courses.test.ts",
]
const exclude = [...configDefaults.exclude, "tests/e2e/**", "dist/**"]

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    // Four workers: 287 s → 100 s on the 8-thread dev machine, three runs with
    // no flake (H1). The single worker set on 2026-09-01 predates the split.
    maxWorkers: 4,
    // A stray it.only must fail the run, not silently skip the rest.
    allowOnly: false,
    testTimeout: 10_000,
    coverage: {
      reporter: ["text", "json-summary"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "tests/*.test.{ts,js}",
            "scripts/**/*.test.mjs",
          ],
          exclude: [...exclude, ...domTests],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          css: true,
          include: domTests,
          exclude,
        },
      },
    ],
  },
})
