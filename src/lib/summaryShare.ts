import { cleanText, type SnapshotOptions } from "@/lib/pageSnapshot"

/**
 * What a summary's image is rendered with, shared by the crew and the
 * Comandate summaries: the screen's own cream background, and plain 16 px
 * above and below instead of the screen's safe-area inset and the room left
 * for the floating save button (both are about the phone, not the page).
 */
export const SUMMARY_SNAPSHOT_OPTIONS: SnapshotOptions = {
  background: "#fffdf8",
  rootStyle: {
    minHeight: "auto",
    margin: "0px",
    paddingTop: "16px",
    paddingBottom: "16px",
  },
}

/** A short, safe, lower-case filename from a free-text title, e.g. for
 *  `anchor.download`. Falls back to `fallback` when the title has no
 *  alphanumeric content at all. */
export function makeSummaryFilename(title: string, fallback: string): string {
  const slug = cleanText(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
  return `${slug || fallback}.png`
}

/** Starts a browser download of `png` as `filename`. */
export function downloadPngBlob(png: Blob, filename: string): void {
  const url = URL.createObjectURL(png)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.style.display = "none"
  try {
    document.body.appendChild(anchor)
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  } finally {
    anchor.remove()
  }
}

/** An iPhone or iPad (an iPad asks for the desktop site and says it is a Mac,
 *  but only a Mac that has a touch screen is an iPad). */
export function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/u.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
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

export type SummaryShareResult = {
  /** `download`: a file was started; `share`: the share sheet was opened (the
   *  person chooses Salva immagine there); `none`: nothing was saved. */
  saved: "download" | "share" | "none"
  copied: boolean
  /** The share sheet was wanted but the browser would not open it from this
   *  tap, so the `Condividi` button has to do it with a tap of its own. */
  shareBlocked: boolean
  /** The finished image, for `Condividi`; null when it could not be made. */
  file: File | null
}

function tryDownload(png: Blob, filename: string): "download" | "none" {
  try {
    downloadPngBlob(png, filename)
    return "download"
  } catch {
    return "none"
  }
}

/**
 * One tap, two results: the image goes to the clipboard and is saved. On a
 * phone from Apple a download lands in Files, not in Photos, so the share
 * sheet — whose `Salva immagine` puts it in Photos — takes its place; every
 * other browser downloads (an Android gallery shows its Download album).
 * `png` is usually already rendered, which keeps the share inside the tap.
 */
export async function saveAndCopySummaryImage(input: {
  png: Promise<Blob>
  filename: string
}): Promise<SummaryShareResult> {
  const copying = copyImageToClipboard(input.png)
  let blob: Blob
  try {
    blob = await input.png
  } catch {
    // Whatever the clipboard made of a promise that failed, nothing was copied.
    await copying
    return { saved: "none", copied: false, shareBlocked: false, file: null }
  }
  const file = new File([blob], input.filename, { type: "image/png" })

  let saved: SummaryShareResult["saved"]
  let shareBlocked = false
  if (isIosDevice() && canShareFile(file)) {
    const outcome = await shareImageFile(file)
    if (outcome === "blocked") {
      saved = "none"
      shareBlocked = true
    } else if (outcome === "failed") {
      saved = tryDownload(blob, input.filename)
    } else {
      saved = "share"
    }
  } else {
    saved = tryDownload(blob, input.filename)
  }
  return { saved, copied: await copying, shareBlocked, file }
}
