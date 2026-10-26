/**
 * B3: where online backup lives, or null when this build has none. The values
 * are public (a project address and a publishable key); they reach only
 * CVC Helper Test builds, from the ignored `.env` (vite.config.ts), so the
 * regular app shows no backup until production exists (UG4, owner decision
 * 13). In development a test sets them per page through
 * `window.__cvcBackupConfig`; production builds ignore that.
 */
export interface BackupConfig {
  supabaseUrl: string
  supabaseKey: string
  powersyncUrl: string
}

declare global {
  interface Window {
    __cvcBackupConfig?: BackupConfig
  }
}

export function backupConfig(): BackupConfig | null {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const override = window.__cvcBackupConfig
    if (override) return override
  }
  const supabaseUrl = import.meta.env.VITE_BACKUP_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_BACKUP_SUPABASE_KEY
  const powersyncUrl = import.meta.env.VITE_BACKUP_POWERSYNC_URL
  return supabaseUrl && supabaseKey && powersyncUrl
    ? { supabaseUrl, supabaseKey, powersyncUrl }
    : null
}
