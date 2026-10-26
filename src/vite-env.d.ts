/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** package.json's version, defined at build time (vite.config.ts). */
  readonly VITE_APP_VERSION: string
  /** Storage and PWA namespace selected by CVC_APP_CHANNEL at build time. */
  readonly VITE_APP_CHANNEL: "regular" | "test"
}

interface ImportMetaEnv {
  /** B3: public backup addresses, defined for CVC Helper Test builds only. */
  readonly VITE_BACKUP_SUPABASE_URL: string
  readonly VITE_BACKUP_SUPABASE_KEY: string
  readonly VITE_BACKUP_POWERSYNC_URL: string
}
