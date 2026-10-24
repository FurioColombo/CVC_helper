import { describe, expect, it } from "vitest"

import {
  APP_CHANNEL_CONFIG,
  getAppChannelConfig,
  parseAppChannel,
} from "@/appChannel"

describe("app channel storage configuration", () => {
  it("preserves the regular app's existing storage and cache names", () => {
    expect(getAppChannelConfig("regular")).toMatchObject({
      databaseFilename: "cvc-helper.db",
      crewDisplayColumnsKey: "cvc-helper.crew-display-columns",
      scanNameOrderPrefix: "cvc-helper.scan-name-order.",
      installedVersionKey: "cvc-helper.installed-version",
      resetPendingKey: "cvc-helper.reset-pending",
      syncModeKey: "cvc-helper.sync-mode",
      workboxCacheId: null,
      ocrRuntimeCacheName: "cvc-ocr-runtime",
      ocrLanguageCachePath: ".",
      speechRuntimeCacheName: "cvc-speech-runtime",
      speechModelCacheName: "transformers-cache",
      manifestName: "CVC Helper",
      manifestShortName: "CVC Helper",
      documentTitle: "CVC Helper",
    })
  })

  it("keeps every test-channel database, preference and cache namespace distinct", () => {
    const regular = getAppChannelConfig("regular")
    const test = getAppChannelConfig("test")

    expect(regular.versionBaseline).toBeNull()
    expect(test.versionBaseline).toBe("0.5.0")
    expect(test.databaseFilename).not.toBe(regular.databaseFilename)
    expect(test.crewDisplayColumnsKey).not.toBe(regular.crewDisplayColumnsKey)
    expect(test.scanNameOrderPrefix).not.toBe(regular.scanNameOrderPrefix)
    expect(test.installedVersionKey).not.toBe(regular.installedVersionKey)
    expect(test.resetPendingKey).not.toBe(regular.resetPendingKey)
    expect(test.syncModeKey).not.toBe(regular.syncModeKey)
    expect(test.workboxCacheId).toBe("cvc-helper-test")
    expect(test.ocrRuntimeCacheName).not.toBe(regular.ocrRuntimeCacheName)
    expect(test.ocrLanguageCachePath).toBe("cvc-helper-test-ocr")
    expect(test.ocrLanguageCachePath).not.toBe(regular.ocrLanguageCachePath)
    expect(test.speechRuntimeCacheName).not.toBe(regular.speechRuntimeCacheName)
    expect(test.speechModelCacheName).not.toBe(regular.speechModelCacheName)
    expect(test.manifestName).toBe("CVC Helper Test")
    expect(test.manifestShortName).toBe("CVC Helper Test")
    expect(test.documentTitle).toBe("CVC Helper Test")
  })

  it("allows only the regular and test build channels", () => {
    expect(Object.keys(APP_CHANNEL_CONFIG)).toEqual(["regular", "test"])
    expect(parseAppChannel(undefined)).toBe("regular")
    expect(parseAppChannel("test")).toBe("test")
    expect(() => parseAppChannel("preview")).toThrow(/regular, test/)
  })
})
