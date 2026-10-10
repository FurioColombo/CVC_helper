/**
 * D3: after an update the app says so once ("Aggiornata alla versione …").
 * The last version that ran on this device is kept in the browser's storage;
 * a different one now means this start follows an update. The first start
 * on a device says nothing.
 */
const KEY = "cvc-helper.installed-version"

export function noteInstalledVersion(
  current: string,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalStorage(),
): string | null {
  if (!storage) return null
  try {
    const previous = storage.getItem(KEY)
    storage.setItem(KEY, current)
    return previous && previous !== current ? previous : null
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
