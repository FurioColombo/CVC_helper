import { compareVersions, parseVersion } from "@/domain/compatibility"
import { appChannelConfig } from "@/runtimeConfig"

/**
 * D3: after an update the app says so once ("Aggiornata alla versione …").
 * The last version that ran on this device is kept in the browser's storage;
 * a newer one now means this start follows an update. The first start on a
 * device, and an unreadable stored version, say nothing.
 */
const KEY = appChannelConfig.installedVersionKey

export function noteInstalledVersion(
  current: string,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalStorage(),
): string | null {
  if (!storage) return null
  try {
    const previous = storage.getItem(KEY)
    storage.setItem(KEY, current)
    // Only a newer version is an update: an older copy started after a newer
    // one says nothing (D3 review DI-Q2).
    return previous &&
      compareVersions(parseVersion(current), parseVersion(previous)) > 0
      ? previous
      : null
  } catch {
    return null
  }
}

function globalStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}
