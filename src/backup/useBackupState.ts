import { useEffect, useState } from "react"

import { backupState, type BackupState, onBackupState } from "@/backup/session"

/** The backup's state, for screens outside Impostazioni's section. */
export function useBackupState() {
  const [state, setState] = useState<BackupState>(backupState)
  useEffect(() => onBackupState(setState), [])
  return state
}
