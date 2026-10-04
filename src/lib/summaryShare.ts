import type { SnapshotOptions } from "@/lib/pageSnapshot"

/**
 * What a summary's image is rendered with, shared by the crew and the
 * Comandate summaries: the screen's own cream background under the content.
 * The image itself is the content's width, with a plain 16 px above and below.
 */
export const SUMMARY_SNAPSHOT_OPTIONS: SnapshotOptions = {
  background: "#fffdf8",
}

/** A short, safe, lower-case filename from a free-text title, for the file the
 *  share sheet is given. Falls back to `fallback` when the title has no
 *  alphanumeric content at all. */
export function makeSummaryFilename(title: string, fallback: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
  return `${slug || fallback}.png`
}

/** Whether this browser can hand `file` to the system share sheet. */
export function canShareFile(file: File): boolean {
  try {
    return (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    )
  } catch {
    return false
  }
}

export type ShareOutcome = "shared" | "cancelled" | "blocked" | "failed"

/** Opens the share sheet with the image. Closing it is not an error; the
 *  browser refusing it because the tap that asked is too old (`blocked`) is
 *  the one case a second tap fixes. */
export async function shareImageFile(file: File): Promise<ShareOutcome> {
  try {
    await navigator.share({ files: [file] })
    return "shared"
  } catch (error) {
    // A DOMException by its name: not every environment makes it an Error.
    const name =
      typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : ""
    if (name === "AbortError") return "cancelled"
    if (name === "NotAllowedError") return "blocked"
    return "failed"
  }
}

/**
 * Puts the image on the clipboard as an image, never as text. Safari lets a
 * clipboard write start only inside a tap and finish later when the item's
 * data is a promise, so this has to be called straight from the handler,
 * before anything is awaited. A browser that does not take a promise for the
 * data gets the finished image instead. Never rejects: a failed copy is only
 * reported.
 */
export function copyImageToClipboard(png: Promise<Blob>): Promise<boolean> {
  const clipboard = navigator.clipboard
  if (!clipboard?.write || typeof ClipboardItem === "undefined") {
    return Promise.resolve(false)
  }
  const write = async (): Promise<boolean> => {
    try {
      await clipboard.write([new ClipboardItem({ "image/png": png })])
      return true
    } catch (error) {
      if (!(error instanceof TypeError)) return false
    }
    try {
      await clipboard.write([new ClipboardItem({ "image/png": await png })])
      return true
    } catch {
      return false
    }
  }
  return write()
}

export type SummaryCopyResult = {
  /** The image is on the clipboard, as an image. */
  copied: boolean
  /** The finished image, for `Condividi`; null when it could not be made. */
  file: File | null
}

/**
 * Test hook: Playwright's WebKit cannot read the clipboard back, so a journey
 * that sets `window.__CVC_TEST__ = {}` (in an init script) is handed the
 * finished image here. `import.meta.env.DEV` is false in a production build,
 * which removes this, so nothing the app makes is ever exposed to a page.
 */
function exposeImageToTests(png: Blob) {
  if (!import.meta.env.DEV) return
  const hook = (window as { __CVC_TEST__?: { summaryImage?: Blob } })
    .__CVC_TEST__
  if (hook) hook.summaryImage = png
}

/**
 * One tap, one result: the image goes to the clipboard, ready to paste into
 * WhatsApp. Nothing is saved or downloaded, and the share sheet is not opened
 * on its own; `file` is there for the `Condividi` button. `png` is usually
 * already rendered, which keeps the clipboard write inside the tap.
 */
export async function copySummaryImage(input: {
  png: Promise<Blob>
  filename: string
}): Promise<SummaryCopyResult> {
  const copying = copyImageToClipboard(input.png)
  let blob: Blob
  try {
    blob = await input.png
  } catch {
    // Whatever the clipboard made of a promise that failed, nothing was copied.
    await copying
    return { copied: false, file: null }
  }
  exposeImageToTests(blob)
  const file = new File([blob], input.filename, { type: "image/png" })
  return { copied: await copying, file }
}
