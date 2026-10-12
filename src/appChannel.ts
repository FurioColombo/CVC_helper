export const APP_CHANNEL_CONFIG = {
  regular: {
    versionBaseline: null,
    databaseFilename: "cvc-helper.db",
    crewDisplayColumnsKey: "cvc-helper.crew-display-columns",
    scanNameOrderPrefix: "cvc-helper.scan-name-order.",
    installedVersionKey: "cvc-helper.installed-version",
    workboxCacheId: null,
    ocrRuntimeCacheName: "cvc-ocr-runtime",
    speechRuntimeCacheName: "cvc-speech-runtime",
    speechModelCacheName: "transformers-cache",
    manifestName: "CVC Helper",
    manifestShortName: "CVC Helper",
    documentTitle: "CVC Helper",
  },
  test: {
    versionBaseline: "0.4.0",
    databaseFilename: "cvc-helper-test.db",
    crewDisplayColumnsKey: "cvc-helper-test.crew-display-columns",
    scanNameOrderPrefix: "cvc-helper-test.scan-name-order.",
    installedVersionKey: "cvc-helper-test.installed-version",
    workboxCacheId: "cvc-helper-test",
    ocrRuntimeCacheName: "cvc-helper-test-ocr-runtime",
    speechRuntimeCacheName: "cvc-helper-test-speech-runtime",
    speechModelCacheName: "cvc-helper-test-transformers-cache",
    manifestName: "CVC Helper Test",
    manifestShortName: "CVC Helper Test",
    documentTitle: "CVC Helper Test",
  },
} as const

export type AppChannel = keyof typeof APP_CHANNEL_CONFIG

export function parseAppChannel(value: string | undefined): AppChannel {
  const configured = value?.trim() || "regular"
  if (!Object.hasOwn(APP_CHANNEL_CONFIG, configured)) {
    throw new Error(
      `CVC_APP_CHANNEL ${configured} must be one of: ${Object.keys(APP_CHANNEL_CONFIG).join(", ")}`,
    )
  }
  return configured as AppChannel
}

export function getAppChannelConfig(channel: AppChannel) {
  return APP_CHANNEL_CONFIG[channel]
}
