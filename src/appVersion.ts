import { parseVersion } from "@/domain/compatibility"

/** This build's version, from package.json (vite.config.ts `define`). */
export const APP_VERSION_TEXT = __APP_VERSION__
export const APP_VERSION = parseVersion(APP_VERSION_TEXT)
