import { expect, test } from "@playwright/test"

import {
  DOUBLE_NAME_SESSION,
  seedDoubleNameCourse,
} from "./fixtures/crew-summary"
import { COPIED_NOTE, expectCopyButtonLayout } from "./summary-image-checks"

test("contains the copy status and native share control at 320 px / 200% text", async ({
  page,
  context,
  browserName,
}, testInfo) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
  }
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    })
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        document.documentElement.dataset.cvcNativeShare = "called"
      },
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 1" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await seedDoubleNameCourse(page)
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page
    .getByRole("combobox", { name: "Sessione" })
    .selectOption(DOUBLE_NAME_SESSION)
  await page.getByRole("button", { name: "Apri vista lettura" }).click()

  await page.setViewportSize({ width: 320, height: 664 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })

  const copy = page.getByRole("button", {
    name: "Copia immagine riepilogo",
  })
  // Linux's wider font sends the icon onto its own flex line at this width.
  // Reproduce that pressure without changing the captured summary typography.
  await copy.evaluate((button) => {
    button.style.letterSpacing = "0.03em"
  })
  await expectCopyButtonLayout(
    page.getByRole("dialog", { name: "Vista lettura equipaggi" }),
    "copy controls at 320 px / 200% text with wider label metrics",
  )
  await copy.click()
  const status = page.getByRole("status")
  const share = status.getByRole("button", { name: "Condividi" })
  await expect(status).toBeVisible()
  await expect(status.locator("p")).toHaveText(COPIED_NOTE)
  await expect(share).toBeVisible()
  await expect(share).toBeEnabled()
  await expect(copy).toBeVisible()
  await expect(copy).toBeEnabled()
  await share.focus()
  await expect(share).toBeFocused()

  const wrapper = page
    .locator('[data-snapshot-exclude="true"]')
    .filter({ has: status })
  await expect(wrapper).toHaveCount(1)
  const bounds = await wrapper.evaluate((root) => {
    const rect = (element: Element | null) => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      }
    }
    const statusElement = root.querySelector('[role="status"]')
    const shareElement = statusElement?.querySelector("button") ?? null
    const copyElement = root.querySelector(
      'button[aria-label="Copia immagine riepilogo"]',
    )
    const canReceivePointer = (element: Element | null) => {
      if (!element) return false
      const box = element.getBoundingClientRect()
      const target = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return Boolean(target && (target === element || element.contains(target)))
    }
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      wrapper: rect(root),
      status: rect(statusElement),
      share: rect(shareElement),
      copy: rect(copyElement),
      shareReceivesPointer: canReceivePointer(shareElement),
      copyReceivesPointer: canReceivePointer(copyElement),
    }
  })
  await testInfo.attach("copy-status-bounds.json", {
    body: Buffer.from(JSON.stringify(bounds, null, 2)),
    contentType: "application/json",
  })

  const contains = (
    parent: { left: number; top: number; right: number; bottom: number } | null,
    child: { left: number; top: number; right: number; bottom: number } | null,
  ) =>
    parent !== null &&
    child !== null &&
    child.left >= parent.left - 1 &&
    child.top >= parent.top - 1 &&
    child.right <= parent.right + 1 &&
    child.bottom <= parent.bottom + 1

  expect(bounds.viewport.width).toBe(320)
  expect(contains(bounds.wrapper, bounds.status), JSON.stringify(bounds)).toBe(
    true,
  )
  expect(contains(bounds.wrapper, bounds.copy), JSON.stringify(bounds)).toBe(
    true,
  )
  expect(contains(bounds.status, bounds.share), JSON.stringify(bounds)).toBe(
    true,
  )
  for (const element of [
    bounds.wrapper,
    bounds.status,
    bounds.share,
    bounds.copy,
  ]) {
    expect(element, JSON.stringify(bounds)).not.toBeNull()
    expect(element!.left, JSON.stringify(bounds)).toBeGreaterThanOrEqual(0)
    expect(element!.top, JSON.stringify(bounds)).toBeGreaterThanOrEqual(0)
    expect(element!.right, JSON.stringify(bounds)).toBeLessThanOrEqual(
      bounds.viewport.width + 1,
    )
    expect(element!.bottom, JSON.stringify(bounds)).toBeLessThanOrEqual(
      bounds.viewport.height + 1,
    )
  }
  expect(bounds.shareReceivesPointer, JSON.stringify(bounds)).toBe(true)
  expect(bounds.copyReceivesPointer, JSON.stringify(bounds)).toBe(true)
  expect(bounds.share!.bottom - bounds.share!.top).toBeGreaterThanOrEqual(44)
  expect(bounds.copy!.bottom - bounds.copy!.top).toBeGreaterThanOrEqual(48)
  expect(bounds.status!.bottom).toBeLessThanOrEqual(bounds.copy!.top)
  await page.screenshot({ path: testInfo.outputPath("copy-status.png") })
  await share.click()
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.cvcNativeShare),
    )
    .toBe("called")
  await expect(status).toBeEmpty()
})
