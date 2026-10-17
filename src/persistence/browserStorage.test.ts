import { afterEach, describe, expect, it, vi } from "vitest"

import { getAppChannelConfig, type AppChannel } from "@/appChannel"

const APP_ORIGIN = "https://cvc-helper.test"
const REGULAR = getAppChannelConfig("regular")
const TEST = getAppChannelConfig("test")

class MemoryStorage {
  readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

function makeIndexedDb(
  initialKeys: string[],
  options: { databaseExists?: boolean; databasesApi?: boolean } = {},
) {
  const storedKeys = new Set(initialKeys)
  const deletedKeys: string[] = []
  const databaseExists = options.databaseExists ?? true
  const database = {
    objectStoreNames: {
      contains: vi.fn((name: string) => name === "keyval"),
    },
    transaction: vi.fn(() => {
      const transaction = {
        oncomplete: null as ((event: Event) => void) | null,
        onabort: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        objectStore: vi.fn(() => ({
          delete: vi.fn((key: string) => {
            deletedKeys.push(key)
            storedKeys.delete(key)
            queueMicrotask(() =>
              transaction.oncomplete?.(new Event("complete")),
            )
          }),
        })),
      }
      return transaction as unknown as IDBTransaction
    }),
    close: vi.fn(),
  } as unknown as IDBDatabase

  const factory: {
    databases?: () => Promise<IDBDatabaseInfo[]>
    open: ReturnType<typeof vi.fn>
  } = {
    open: vi.fn(() => {
      const request = {
        result: database,
        error: null,
        transaction: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBOpenDBRequest
      queueMicrotask(() => {
        const handler = request.onsuccess as ((event: Event) => void) | null
        handler?.(new Event("success"))
      })
      return request
    }),
  }
  if (options.databasesApi !== false) {
    factory.databases = vi.fn(async () =>
      databaseExists ? [{ name: "keyval-store", version: 1 }] : [],
    )
  }

  return {
    factory: factory as unknown as IDBFactory,
    storedKeys,
    deletedKeys,
    database,
  }
}

function makeCacheStorage(initialNames: string[]) {
  const cacheNames = new Set(initialNames)
  const deleteCache = vi.fn(async (name: string) => cacheNames.delete(name))
  return {
    api: {
      keys: vi.fn(async () => [...cacheNames]),
      delete: deleteCache,
    } as unknown as CacheStorage,
    cacheNames,
    deleteCache,
  }
}

function makeRegistration(scope: string) {
  return {
    scope,
    unregister: vi.fn(async () => true),
  } as unknown as ServiceWorkerRegistration & {
    unregister: ReturnType<typeof vi.fn>
  }
}

async function loadStorage(channel: AppChannel) {
  vi.resetModules()
  vi.doMock("@/runtimeConfig", () => ({
    appChannelConfig: getAppChannelConfig(channel),
  }))
  return import("./browserStorage")
}

function setBrowserGlobals(options: {
  localStorage?: MemoryStorage
  caches?: CacheStorage
  indexedDB?: IDBFactory
  navigator?: object
}) {
  vi.stubGlobal("location", { origin: APP_ORIGIN })
  vi.stubGlobal("localStorage", options.localStorage ?? new MemoryStorage())
  vi.stubGlobal("caches", options.caches ?? makeCacheStorage([]).api)
  vi.stubGlobal("indexedDB", options.indexedDB ?? makeIndexedDb([]).factory)
  vi.stubGlobal("navigator", options.navigator ?? {})
}

afterEach(() => {
  vi.doUnmock("@/runtimeConfig")
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe("browser storage helpers", () => {
  it("reports persistent-storage support and catches request errors as denied", async () => {
    setBrowserGlobals({
      navigator: { storage: { persist: vi.fn(async () => true) } },
    })
    const { requestPersistentStorage, persistentStorageStatus } =
      await loadStorage("regular")

    await expect(requestPersistentStorage()).resolves.toBe("granted")
    await expect(persistentStorageStatus()).resolves.toBe("unsupported")

    vi.stubGlobal("navigator", {})
    await expect(requestPersistentStorage()).resolves.toBe("unsupported")
    await expect(persistentStorageStatus()).resolves.toBe("unsupported")

    vi.stubGlobal("navigator", {
      storage: {
        persist: vi.fn(async () => false),
        persisted: vi.fn(async () => true),
      },
    })
    await expect(requestPersistentStorage()).resolves.toBe("denied")
    await expect(persistentStorageStatus()).resolves.toBe("granted")

    vi.stubGlobal("navigator", {
      storage: {
        persist: vi.fn(async () => {
          throw new Error("permission query failed")
        }),
        persisted: vi.fn(async () => {
          throw new Error("status query failed")
        }),
      },
    })
    await expect(requestPersistentStorage()).resolves.toBe("denied")
    await expect(persistentStorageStatus()).resolves.toBe("denied")
  })

  it("selects only the exact channel cache names and Workbox scope", async () => {
    const { appOwnedCacheNames, appServiceWorkerScope } =
      await loadStorage("regular")
    const regularScope = appServiceWorkerScope("/CVC_helper/", APP_ORIGIN)
    const testScope = appServiceWorkerScope("/CVC_helper_test/", APP_ORIGIN)
    const rootScope = appServiceWorkerScope("/", APP_ORIGIN)
    const names = [
      REGULAR.ocrRuntimeCacheName,
      REGULAR.speechRuntimeCacheName,
      REGULAR.speechModelCacheName,
      TEST.ocrRuntimeCacheName,
      TEST.speechRuntimeCacheName,
      TEST.speechModelCacheName,
      `workbox-precache-v2-${regularScope}`,
      `workbox-precache-v1-${regularScope}`,
      `workbox-runtime-${regularScope}`,
      `workbox-precache-v2-${rootScope}`,
      `cvc-helper-test-precache-v2-${testScope}`,
      `cvc-helper-test-precache-v1-${testScope}`,
      `cvc-helper-test-precache-v2-${rootScope}`,
    ]

    expect(appOwnedCacheNames(names, TEST, testScope)).toEqual([
      TEST.ocrRuntimeCacheName,
      TEST.speechRuntimeCacheName,
      TEST.speechModelCacheName,
      `cvc-helper-test-precache-v2-${testScope}`,
      `cvc-helper-test-precache-v1-${testScope}`,
    ])
    expect(appOwnedCacheNames(names, REGULAR, regularScope)).toEqual([
      REGULAR.ocrRuntimeCacheName,
      REGULAR.speechRuntimeCacheName,
      REGULAR.speechModelCacheName,
      `workbox-precache-v2-${regularScope}`,
      `workbox-precache-v1-${regularScope}`,
      `workbox-runtime-${regularScope}`,
    ])
  })

  it.each([
    ["regular", REGULAR, TEST, "./ita.traineddata"],
    ["test", TEST, REGULAR, "cvc-helper-test-ocr/ita.traineddata"],
  ] as const)(
    "clears only %s channel preferences, caches, registration and OCR key",
    async (channel, selected, other, selectedOcrKey) => {
      const {
        appOwnedCacheNames,
        appServiceWorkerScope,
        clearAppBrowserStorage,
      } = await loadStorage(channel)
      const scope = appServiceWorkerScope(import.meta.env.BASE_URL, APP_ORIGIN)
      const otherScope = appServiceWorkerScope(
        channel === "regular" ? "/CVC_helper_test/" : "/CVC_helper/",
        APP_ORIGIN,
      )
      const local = new MemoryStorage()
      local.setItem(selected.crewDisplayColumnsKey, "3")
      local.setItem(selected.installedVersionKey, "0.4.0")
      local.setItem(`${selected.scanNameOrderPrefix}first`, "surname-first")
      local.setItem(other.crewDisplayColumnsKey, "2")
      local.setItem(other.installedVersionKey, "0.4.0")
      local.setItem(`${other.scanNameOrderPrefix}first`, "given-first")
      local.setItem("unrelated.preference", "keep")

      const scopeCacheName = `${selected.workboxCacheId ?? "workbox"}-precache-v2-${scope}`
      const otherScopeCacheName = `${other.workboxCacheId ?? "workbox"}-precache-v2-${otherScope}`
      const rootTestSibling = `cvc-helper-test-precache-v2-${appServiceWorkerScope("/", APP_ORIGIN)}`
      const initialCacheNames = [
        selected.ocrRuntimeCacheName,
        selected.speechRuntimeCacheName,
        selected.speechModelCacheName,
        other.ocrRuntimeCacheName,
        other.speechRuntimeCacheName,
        other.speechModelCacheName,
        scopeCacheName,
        otherScopeCacheName,
        rootTestSibling,
      ]
      const cacheStorage = makeCacheStorage(initialCacheNames)
      const indexed = makeIndexedDb([
        "./ita.traineddata",
        "cvc-helper-test-ocr/ita.traineddata",
        "unrelated.model",
      ])
      const selectedRegistration = makeRegistration(scope)
      const otherRegistration = makeRegistration(otherScope)
      const rootScope = appServiceWorkerScope("/", APP_ORIGIN)
      const rootRegistration =
        rootScope === scope || rootScope === otherScope
          ? undefined
          : makeRegistration(rootScope)
      const serviceWorker = {
        getRegistrations: vi.fn(async () => [
          selectedRegistration,
          otherRegistration,
          ...(rootRegistration ? [rootRegistration] : []),
        ]),
      }
      setBrowserGlobals({
        localStorage: local,
        caches: cacheStorage.api,
        indexedDB: indexed.factory,
        navigator: { serviceWorker },
      })

      await clearAppBrowserStorage()

      expect(local.values).toEqual(
        new Map([
          [other.crewDisplayColumnsKey, "2"],
          [other.installedVersionKey, "0.4.0"],
          [`${other.scanNameOrderPrefix}first`, "given-first"],
          ["unrelated.preference", "keep"],
        ]),
      )
      expect(cacheStorage.cacheNames).toEqual(
        new Set(
          initialCacheNames.filter(
            (name) =>
              !appOwnedCacheNames(initialCacheNames, selected, scope).includes(
                name,
              ),
          ),
        ),
      )
      expect(indexed.deletedKeys).toEqual([selectedOcrKey])
      expect(indexed.storedKeys).toEqual(
        new Set([
          selectedOcrKey === "./ita.traineddata"
            ? "cvc-helper-test-ocr/ita.traineddata"
            : "./ita.traineddata",
          "unrelated.model",
        ]),
      )
      expect(selectedRegistration.unregister).toHaveBeenCalledOnce()
      expect(otherRegistration.unregister).not.toHaveBeenCalled()
      if (rootRegistration) {
        expect(rootRegistration.unregister).not.toHaveBeenCalled()
      }
    },
  )

  it("does not create the shared Tesseract database when databases() reports it absent", async () => {
    const { clearAppBrowserStorage } = await loadStorage("regular")
    const indexed = makeIndexedDb([], { databaseExists: false })
    setBrowserGlobals({ indexedDB: indexed.factory })

    await expect(clearAppBrowserStorage()).resolves.toBeUndefined()
    expect(indexed.factory.open).not.toHaveBeenCalled()
  })

  it("aborts a fallback open of an absent shared Tesseract database", async () => {
    const { clearAppBrowserStorage } = await loadStorage("regular")
    const abort = vi.fn()
    let requestError: DOMException | null = null
    const request = {
      result: { close: vi.fn() },
      get error() {
        return requestError
      },
      transaction: { abort },
      onupgradeneeded: null as ((event: IDBVersionChangeEvent) => void) | null,
      onsuccess: null as ((event: Event) => void) | null,
      onerror: null as ((event: Event) => void) | null,
    } as unknown as IDBOpenDBRequest
    abort.mockImplementation(() => {
      requestError = new DOMException("aborted new database", "AbortError")
      queueMicrotask(() => {
        const handler = request.onerror as ((event: Event) => void) | null
        handler?.(new Event("error"))
      })
    })
    const factory = {
      open: vi.fn(() => {
        queueMicrotask(() => {
          const handler = request.onupgradeneeded as
            ((event: IDBVersionChangeEvent) => void) | null
          handler?.({ oldVersion: 0 } as IDBVersionChangeEvent)
        })
        return request
      }),
    } as unknown as IDBFactory
    setBrowserGlobals({ indexedDB: factory })

    await expect(clearAppBrowserStorage()).resolves.toBeUndefined()
    expect(abort).toHaveBeenCalledOnce()
  })

  it("rejects when cache deletion fails, so the reset can be retried", async () => {
    const {
      appOwnedCacheNames,
      appServiceWorkerScope,
      clearAppBrowserStorage,
    } = await loadStorage("regular")
    const scope = appServiceWorkerScope(import.meta.env.BASE_URL, APP_ORIGIN)
    const failedName = REGULAR.ocrRuntimeCacheName
    const names = appOwnedCacheNames(
      [failedName, REGULAR.speechRuntimeCacheName],
      REGULAR,
      scope,
    )
    const cacheNames = new Set(names)
    let shouldFail = true
    const deleteCache = vi.fn(async (name: string) => {
      if (name === failedName && shouldFail) {
        shouldFail = false
        throw new Error("cache deletion failed")
      }
      return cacheNames.delete(name)
    })
    const cacheApi = {
      keys: vi.fn(async () => [...cacheNames]),
      delete: deleteCache,
    } as unknown as CacheStorage
    setBrowserGlobals({ caches: cacheApi })

    await expect(clearAppBrowserStorage()).rejects.toThrow(
      "cache deletion failed",
    )
    await expect(clearAppBrowserStorage()).resolves.toBeUndefined()
    expect(cacheNames).toEqual(new Set())
  })
})
