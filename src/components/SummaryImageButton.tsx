import { Copy, Share2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

import { renderElementToPng, waitForImages } from "@/lib/pageSnapshot"
import {
  SUMMARY_SNAPSHOT_OPTIONS,
  canShareFile,
  copySummaryImage,
  shareImageFile,
  type SummaryCopyResult,
} from "@/lib/summaryShare"

// How long a note stays up, unless a finger or the keyboard is on it.
const NOTE_VISIBLE_MS = 6000
// Rendering starts a moment after the view opens, once it has been painted,
// so opening is not what pays for it.
const PRERENDER_DELAY_MS = 250

type Note = { kind: "status" | "alert"; text: string; canShare: boolean }

const FAILED_NOTE: Note = {
  kind: "alert",
  text: "Impossibile creare l’immagine. Riprova.",
  canShare: false,
}

function noteFor(result: SummaryCopyResult): Note {
  if (!result.file) return FAILED_NOTE
  const canShare = canShareFile(result.file)
  if (result.copied) {
    return {
      kind: "status",
      text: "Immagine copiata. Incollala su WhatsApp.",
      canShare,
    }
  }
  // The copy failed but the image exists: where the phone can share files,
  // that is another way to send it.
  return {
    kind: canShare ? "status" : "alert",
    text: "Copia non riuscita.",
    canShare,
  }
}

/** What the picture depends on: the width and density it is drawn at and the
 *  content itself. A picture made for another key is made again. */
function snapshotKey(root: HTMLElement) {
  return [
    root.getBoundingClientRect().width,
    window.devicePixelRatio,
    getComputedStyle(document.documentElement).fontSize,
    root.innerHTML,
  ].join("|")
}

const nextFrame = () =>
  new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))

async function renderSummaryPng(root: HTMLElement): Promise<Blob> {
  await waitForImages(root)
  await nextFrame()
  return renderElementToPng(root, SUMMARY_SNAPSHOT_OPTIONS)
}

/**
 * The floating "Copia immagine" button of a summary view, and the note that
 * says what it did. One tap copies the summary as an image — a screenshot of
 * `captureRef`'s content — so it can be pasted into WhatsApp; where the phone
 * can share files the note offers `Condividi` too. The image is rendered ahead
 * of the tap, which keeps the tap instant and the clipboard write (which
 * Safari allows only inside the tap) inside the gesture that asked for it.
 *
 * The whole thing is left out of the image (`data-snapshot-exclude`); it sits
 * outside `captureRef`'s element as well.
 */
export function SummaryImageButton({
  captureRef,
  filename,
}: {
  captureRef: RefObject<HTMLElement | null>
  filename: string
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  const [focusInNote, setFocusInNote] = useState(false)
  const busyRef = useRef(false)
  const prepared = useRef<{ key: string; png: Promise<Blob> } | null>(null)
  const sharedFile = useRef<File | null>(null)

  const prepare = useCallback((): Promise<Blob> => {
    const root = captureRef.current
    if (!root) return Promise.reject(new Error("Riepilogo non disponibile."))
    const key = snapshotKey(root)
    if (prepared.current?.key === key) return prepared.current.png
    const png = renderSummaryPng(root)
    prepared.current = { key, png }
    // A failed render is not kept: the next tap tries again.
    png.catch(() => {
      if (prepared.current?.png === png) prepared.current = null
    })
    return png
  }, [captureRef])

  useEffect(() => {
    let timer = 0
    const schedule = (delay: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        prepare().catch(() => undefined)
      }, delay)
    }
    schedule(PRERENDER_DELAY_MS)
    // Turning the phone changes the width the image is a screenshot of.
    const onResize = () => schedule(PRERENDER_DELAY_MS + 150)
    window.addEventListener("resize", onResize)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("resize", onResize)
    }
  }, [prepare])

  useEffect(() => {
    if (!note || focusInNote) return
    const timer = window.setTimeout(() => setNote(null), NOTE_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [note, focusInNote])

  async function copy() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setNote(null)
    setFocusInNote(false)
    try {
      // `prepare` and the clipboard write both start inside this tap.
      const result = await copySummaryImage({
        png: prepare(),
        filename,
      })
      sharedFile.current = result.file
      setNote(noteFor(result))
    } catch {
      setNote(FAILED_NOTE)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function share() {
    const file = sharedFile.current
    if (!file) return
    const outcome = await shareImageFile(file)
    setNote(
      outcome === "blocked" || outcome === "failed"
        ? {
            kind: "alert",
            text: "Condivisione non riuscita. Riprova.",
            canShare: false,
          }
        : null,
    )
  }

  const status = note?.kind === "status" ? note : null
  const failure = note?.kind === "alert" ? note : null

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex max-w-[calc(100%-2rem)] flex-col items-end gap-2"
      data-snapshot-exclude="true"
    >
      {/* Always in the page, so a screen reader that watches it hears what
          arrives; the box is drawn only when there is something to say. */}
      <div
        aria-live="polite"
        className={
          status
            ? "pointer-events-auto rounded-2xl bg-[#102f3b] px-3.5 py-2.5 text-sm leading-5 font-bold text-white shadow-lg"
            : ""
        }
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocusInNote(false)
          }
        }}
        onFocus={() => setFocusInNote(true)}
        role="status"
      >
        {status && (
          <>
            <p>{status.text}</p>
            {status.canShare && (
              <button
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3.5 text-sm font-black text-[#0b526b] outline-none focus-visible:ring-3 focus-visible:ring-white/60"
                onClick={() => void share()}
                type="button"
              >
                <Share2 aria-hidden="true" className="size-4" />
                Condividi
              </button>
            )}
          </>
        )}
      </div>
      {failure && (
        <p
          className="pointer-events-auto rounded-2xl bg-[#fee4e2] px-3.5 py-2.5 text-sm leading-5 font-bold text-[#b42318] shadow-lg"
          role="alert"
        >
          {failure.text}
        </p>
      )}
      <button
        aria-busy={busy}
        aria-label={busy ? undefined : "Copia immagine riepilogo"}
        className="pointer-events-auto inline-flex min-h-12 items-center justify-center gap-[8px] rounded-full bg-[#0b526b] px-[18px] py-2.5 text-center text-sm leading-tight font-bold text-white shadow-[0_6px_18px_rgba(11,82,107,0.4)] outline-none focus-visible:ring-4 focus-visible:ring-[#0b526b]/40"
        onClick={() => void copy()}
        type="button"
      >
        <Copy aria-hidden="true" className="size-[20px] shrink-0" />
        {busy ? "Preparo…" : "Copia immagine"}
      </button>
    </div>
  )
}
