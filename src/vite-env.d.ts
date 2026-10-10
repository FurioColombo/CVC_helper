/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** package.json's version, defined at build time (vite.config.ts). */
  readonly VITE_APP_VERSION: string
}
