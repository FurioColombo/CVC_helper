import { test } from "@playwright/test"

/** A cold timing case owns a browser process and retains its project options. */
export const isolatedTest = test.extend({
  browser: [
    async (
      { browserName, playwright, headless, channel, launchOptions },
      provideBrowser,
    ) => {
      const browser = await playwright[browserName].launch({
        ...launchOptions,
        ...(headless !== undefined ? { headless } : {}),
        ...(channel !== undefined ? { channel } : {}),
      })
      try {
        await provideBrowser(browser)
      } finally {
        await browser.close()
      }
    },
    { scope: "worker" },
  ],
})
