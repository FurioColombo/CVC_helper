import { parseVersion } from "@/domain/compatibility"

/**
 * This build's version, from package.json (vite.config.ts `define`). Under
 * `import.meta.env` rather than a bare global: the dev server injects these
 * into every module, so a test page with its own HTML reads them too.
 */
export const APP_VERSION_TEXT = import.meta.env.VITE_APP_VERSION
export const APP_VERSION = parseVersion(APP_VERSION_TEXT)
