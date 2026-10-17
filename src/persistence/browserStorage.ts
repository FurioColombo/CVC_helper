import { appChannelConfig } from "@/runtimeConfig"
import { type AppChannel, APP_CHANNEL_CONFIG } from "@/appChannel"

export type PersistentStorageStatus = "granted" | "denied" | "unsupported"

type AppChannelConfig = (typeof APP_CHANNEL_CONFIG)[AppChannel]

const TESSERACT_DATABASE = "keyval-store"
const TESSERACT_OBJECT_STORE = "keyval"
const TESSERACT_LANGUAGE_MODEL_KEY = `${appChannelConfig.ocrLanguageCachePath}/ita.traineddata`

export function appServiceWorkerScope(baseUrl: string, origin: string): string {
  return new URL(baseUrl, origin).href
}

export function appOwnedCacheNames(
  availableNames: readonly string[],
  config: AppChannelConfig,
  scope: string,
): string[] {
  const workboxPrefix = config.workboxCacheId ?? "workbox"
  const ownedNames = new Set<string>([
    config.ocrRuntimeCacheName,
    config.speechRuntimeCacheName,
    config.speechModelCacheName,
  ])

  return availableNames.filter(
    (name) =>
      ownedNames.has(name) ||
      (name.startsWith(`${workboxPrefix}-`) && name.endsWith(`-${scope}`)),
  )
}

export async function requestPersistentStorage(): Promise<PersistentStorageStatus> {
  if (typeof navigator === "undefined") return "unsupported"

  try {
    const storage = navigator.storage
    if (typeof storage?.persist !== "function") return "unsupported"
    return (await storage.persist()) ? "granted" : "denied"
  } catch {
    return "denied"
  }
}

export async function persistentStorageStatus(): Promise<PersistentStorageStatus> {
  if (typeof navigator === "undefined") return "unsupported"

  try {
    const storage = navigator.storage
    if (typeof storage?.persisted !== "function") return "unsupported"
    return (await storage.persisted()) ? "granted" : "denied"
  } catch {
    return "denied"
  }
}

export async function clearAppBrowserStorage(): Promise<void> {
  if (typeof location === "undefined" || !location.origin) {
    throw new Error("The app storage scope is unavailable.")
  }
  if (typeof caches === "undefined") {
    throw new Error(
      "Cache Storage is unavailable; app caches could not be cleared.",
    )
  }
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "IndexedDB is unavailable; the OCR cache could not be cleared.",
    )
  }

  const scope = appServiceWorkerScope(import.meta.env.BASE_URL, location.origin)

  // Workbox includes both its configured cache prefix and the exact service
  // worker scope in the precache name. This keeps sibling folders and a root
  // scope on the same origin outside the deletion set.
  const availableCacheNames = await caches.keys()
  const cacheNamesToDelete = appOwnedCacheNames(
    availableCacheNames,
    appChannelConfig,
    scope,
  )

  const failures: unknown[] = []
  const registrations = await selectedServiceWorkerRegistrations(scope).catch(
    (error: unknown) => {
      failures.push(error)
      return []
    },
  )

  const unregisterResults = await Promise.allSettled(
    registrations.map((registration) => registration.unregister()),
  )
  failures.push(
    ...unregisterResults.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    ),
  )

  const cleanupResults = await Promise.allSettled([
    clearSelectedLocalStorage(),
    deleteSelectedCaches(cacheNamesToDelete),
    deleteTesseractLanguageModel(indexedDB, TESSERACT_LANGUAGE_MODEL_KEY),
  ])
  failures.push(
    ...cleanupResults.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    ),
  )

  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(
      failures,
      "Some app browser storage could not be cleared.",
    )
  }
}

async function selectedServiceWorkerRegistrations(
  scope: string,
): Promise<ServiceWorkerRegistration[]> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return []

  const getRegistrations = navigator.serviceWorker.getRegistrations
  if (typeof getRegistrations !== "function") return []

  return (await getRegistrations.call(navigator.serviceWorker)).filter(
    (registration) => registration.scope === scope,
  )
}

function clearSelectedLocalStorage(): void {
  if (typeof localStorage === "undefined") {
    throw new Error(
      "Local Storage is unavailable; app preferences could not be cleared.",
    )
  }

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (
      key === appChannelConfig.crewDisplayColumnsKey ||
      key === appChannelConfig.installedVersionKey ||
      (key !== null && key.startsWith(appChannelConfig.scanNameOrderPrefix))
    ) {
      localStorage.removeItem(key)
    }
  }
}

async function deleteSelectedCaches(
  cacheNames: readonly string[],
): Promise<void> {
  await Promise.all(cacheNames.map((name) => caches.delete(name)))
}

async function deleteTesseractLanguageModel(
  factory: IDBFactory,
  key: string,
): Promise<void> {
  const database = await openExistingTesseractDatabase(factory)
  if (!database) return

  try {
    if (!database.objectStoreNames.contains(TESSERACT_OBJECT_STORE)) return

    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction
      try {
        transaction = database.transaction(TESSERACT_OBJECT_STORE, "readwrite")
        transaction.oncomplete = () => resolve()
        transaction.onabort = () =>
          reject(
            transaction.error ??
              new Error("The OCR language model cache could not be updated."),
          )
        transaction.onerror = () => {
          // The abort event carries the transaction's final error.
        }
        transaction.objectStore(TESSERACT_OBJECT_STORE).delete(key)
      } catch (error) {
        reject(error)
      }
    })
  } finally {
    database.close()
  }
}

async function openExistingTesseractDatabase(
  factory: IDBFactory,
): Promise<IDBDatabase | null> {
  if (typeof factory.databases === "function") {
    const databases = await factory.databases()
    if (!databases.some((database) => database.name === TESSERACT_DATABASE)) {
      return null
    }
  }

  return new Promise((resolve, reject) => {
    let absentDatabase = false
    const request = factory.open(TESSERACT_DATABASE)

    request.onupgradeneeded = (event) => {
      if ((event as IDBVersionChangeEvent).oldVersion === 0) {
        // Opening a missing database starts an upgrade transaction. Aborting
        // it leaves no empty database behind as a side effect of the reset.
        absentDatabase = true
        request.transaction?.abort()
      }
    }
    request.onsuccess = () => {
      if (absentDatabase) {
        request.result.close()
        resolve(null)
      } else {
        resolve(request.result)
      }
    }
    request.onerror = () => {
      if (absentDatabase && request.error?.name === "AbortError") {
        resolve(null)
      } else {
        reject(
          request.error ??
            new Error("The OCR language model cache could not be opened."),
        )
      }
    }
  })
}
