import { vi } from "vitest"

/**
 * The browser pieces the summary image's copy needs and jsdom lacks: the
 * clipboard and its item class. `stubSummaryImageBrowser` installs recording
 * fakes; `restoreSummaryImageBrowser` takes them away again.
 */

export class FakeClipboardItem {
  readonly items: Record<string, Blob | Promise<Blob>>
  constructor(items: Record<string, Blob | Promise<Blob>>) {
    this.items = items
  }
  get types() {
    return Object.keys(this.items)
  }
}

export function stubSummaryImageBrowser() {
  const clipboardWrite = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("ClipboardItem", FakeClipboardItem)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { write: clipboardWrite },
  })
  return { clipboardWrite }
}

export function restoreSummaryImageBrowser() {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  const target = navigator as unknown as Record<string, unknown>
  delete target.clipboard
  delete target.share
  delete target.canShare
}
