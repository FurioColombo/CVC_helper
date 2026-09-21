# M0 local database spike

## Scope

The bounded spike compared the required PowerSync-first path with the authorized
Dexie fallback. It used PowerSync Web 2.2.0 and Dexie 4.4.5 package metadata,
then exercised PowerSync in a temporary Vite page with one local-only table.

## PowerSync result

- Browser: Playwright Chromium 151 on macOS arm64.
- Schema: one `Table.createLocalOnly` table with an integer value.
- Operations: initialize, insert/replace, select, reload, select again.
- Result: CRUD PASS; reload persistence PASS; no page or console errors.
- Machine-readable result: `powersync-spike-result.json`.

PowerSync's Vite integration bundled its worker and SQLite WASM without custom
asset plumbing. Local-only tables avoid an upload queue while the MVP has no
backend. The application schema therefore uses granular local-only records and
does not call `connect()`.

## Decision

Retain PowerSync. The prescribed first choice proved straightforward in the
actual target browser, so the Dexie fallback is not authorized by the spike
outcome. The production Playwright persistence journey separately verifies a
write after a real page reload.

## Known limitations

- PowerSync adds several worker/WASM assets; the production PWA precaches them
  so offline initialization is possible.
- Multi-tab support was unavailable in the pinned browser test context. It must
  be validated before multi-tab, multi-editor, or synchronized use.
- WebKit/iPhone persistence remains scheduled for the M14 compatibility gate.
- No sync connector, Supabase client, authentication, or upload behavior is in
  MVP scope.

References inspected: PowerSync's official JavaScript Web SDK and local-only
usage documentation, plus Dexie's official IndexedDB/React documentation.
