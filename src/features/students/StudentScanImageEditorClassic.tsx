/**
 * The adjustment surface as it shipped in the UG1 release candidate: a small
 * preview with a rotation slider. Kept verbatim and buildable so it can be
 * reinstated for comparison by flipping STUDENT_SCAN_EDITOR, the same way the
 * previous dictation pipeline is kept as a benchmark.
 */
import { Check, Crop, LoaderCircle, RotateCcw, RotateCw, X } from "lucide-react"
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { Button } from "@/components/ui/button"
import {
  createStudentScanPreview,
  DEFAULT_STUDENT_SCAN_CROP,
  prepareStudentScanImage,
  updateNormalizedCrop,
  type CropGesture,
  type NormalizedCrop,
} from "@/features/students/studentImageCrop"

interface PointerGesture {
  pointerId: number
  gesture: CropGesture
  startX: number
  startY: number
  crop: NormalizedCrop
}

const CROP_HANDLES: Array<{
  gesture: Exclude<CropGesture, "move">
  label: string
  className: string
}> = [
  {
    gesture: "north-west",
    label: "Ridimensiona ritaglio dall’angolo in alto a sinistra",
    className: "-left-5 -top-5 cursor-nwse-resize",
  },
  {
    gesture: "north-east",
    label: "Ridimensiona ritaglio dall’angolo in alto a destra",
    className: "-right-5 -top-5 cursor-nesw-resize",
  },
  {
    gesture: "south-west",
    label: "Ridimensiona ritaglio dall’angolo in basso a sinistra",
    className: "-bottom-5 -left-5 cursor-nesw-resize",
  },
  {
    gesture: "south-east",
    label: "Ridimensiona ritaglio dall’angolo in basso a destra",
    className: "-bottom-5 -right-5 cursor-nwse-resize",
  },
]

function rotateByQuarterTurn(current: number, direction: -1 | 1) {
  const next = current + direction * 90
  return next > 180 ? next - 360 : next < -180 ? next + 360 : next
}

export function StudentScanImageEditorClassic({
  file,
  source,
  onCancel,
  onUse,
}: {
  file: File
  source: "camera" | "gallery"
  onCancel: () => void
  onUse: (image: Blob) => void
}) {
  const [rotation, setRotation] = useState(0)
  const [crop, setCrop] = useState(DEFAULT_STUDENT_SCAN_CROP)
  const [preview, setPreview] = useState<{
    url: string
    width: number
    height: number
  }>()
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState(false)
  const dialogRef = useRef<HTMLElement | null>(null)
  const previewStageRef = useRef<HTMLDivElement | null>(null)
  const pointerGestureRef = useRef<PointerGesture | null>(null)
  const previewSequenceRef = useRef(0)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  useEffect(() => {
    const sequence = ++previewSequenceRef.current
    const timer = window.setTimeout(() => {
      void createStudentScanPreview(file, rotation)
        .then((nextPreview) => {
          if (sequence !== previewSequenceRef.current) {
            URL.revokeObjectURL(nextPreview.url)
            return
          }
          setError(false)
          setPreview((current) => {
            if (current) URL.revokeObjectURL(current.url)
            return nextPreview
          })
        })
        .catch(() => {
          if (sequence === previewSequenceRef.current) setError(true)
        })
    }, 120)
    return () => {
      window.clearTimeout(timer)
      previewSequenceRef.current += 1
    }
  }, [file, rotation])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url)
    },
    [preview],
  )

  function beginPointerGesture(
    event: ReactPointerEvent<HTMLElement>,
    gesture: CropGesture,
  ) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      gesture,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    }
  }

  function movePointer(event: ReactPointerEvent<HTMLElement>) {
    const gesture = pointerGestureRef.current
    const stage = previewStageRef.current
    if (!gesture || !stage || gesture.pointerId !== event.pointerId) return
    const bounds = stage.getBoundingClientRect()
    setCrop(
      updateNormalizedCrop(
        gesture.crop,
        gesture.gesture,
        (event.clientX - gesture.startX) / bounds.width,
        (event.clientY - gesture.startY) / bounds.height,
      ),
    )
  }

  function finishPointer(event: ReactPointerEvent<HTMLElement>) {
    if (pointerGestureRef.current?.pointerId === event.pointerId)
      pointerGestureRef.current = null
  }

  function moveHandleWithKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    gesture: Exclude<CropGesture, "move">,
  ) {
    event.stopPropagation()
    const amount = event.shiftKey ? 0.05 : 0.01
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-amount, 0],
      ArrowRight: [amount, 0],
      ArrowUp: [0, -amount],
      ArrowDown: [0, amount],
    }
    const delta = deltas[event.key]
    if (!delta) return
    event.preventDefault()
    setCrop((current) =>
      updateNormalizedCrop(current, gesture, delta[0], delta[1]),
    )
  }

  function moveCropWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const amount = event.shiftKey ? 0.05 : 0.01
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-amount, 0],
      ArrowRight: [amount, 0],
      ArrowUp: [0, -amount],
      ArrowDown: [0, amount],
    }
    const delta = deltas[event.key]
    if (!delta) return
    event.preventDefault()
    setCrop((current) =>
      updateNormalizedCrop(current, "move", delta[0], delta[1]),
    )
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      onCancel()
      return
    }
    if (event.key !== "Tab") return
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    )
    const first = focusable.at(0)
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function handleUseArea() {
    setPreparing(true)
    setError(false)
    try {
      const prepared = await prepareStudentScanImage(file, rotation, crop)
      if (activeRef.current) onUse(prepared)
    } catch {
      if (activeRef.current) {
        setError(true)
        setPreparing(false)
      }
    }
  }

  const previewAspect = preview ? preview.width / preview.height : 1

  return (
    <section
      aria-label="Raddrizza e ritaglia foto"
      aria-modal="true"
      className="fixed inset-0 z-70 flex flex-col overflow-hidden bg-[#09182b] text-white"
      onKeyDown={handleDialogKeyDown}
      ref={dialogRef}
      role="dialog"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 px-3 py-2">
        <Button
          aria-label="Chiudi regolazione foto"
          autoFocus
          className="size-11 border-white/25 bg-white/10 p-0 text-white hover:bg-white/15"
          onClick={onCancel}
          type="button"
          variant="secondary"
        >
          <X aria-hidden="true" className="size-5" />
        </Button>
        <div className="min-w-0 text-center">
          <h2 className="truncate text-base font-black">
            Raddrizza e ritaglia
          </h2>
          <p className="text-[0.7rem] text-white/70">
            {source === "camera" ? "Foto appena scattata" : "Dalla galleria"}
          </p>
        </div>
        <Button
          aria-label="Ripristina ritaglio"
          className="size-11 border-white/25 bg-white/10 p-0 text-white hover:bg-white/15"
          disabled={preparing}
          onClick={() => {
            setRotation(0)
            setCrop(DEFAULT_STUDENT_SCAN_CROP)
          }}
          type="button"
          variant="secondary"
        >
          <Crop aria-hidden="true" className="size-5" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
        <div className="flex min-h-52 flex-1 items-center justify-center overflow-visible p-5">
          {preview ? (
            <div
              className="relative touch-none select-none"
              onPointerCancel={finishPointer}
              onPointerMove={movePointer}
              onPointerUp={finishPointer}
              ref={previewStageRef}
              style={{
                aspectRatio: `${preview.width} / ${preview.height}`,
                width: `min(100%, ${Math.max(18, previewAspect * 56)}dvh)`,
              }}
            >
              <img
                alt="Anteprima foto da ritagliare"
                className="absolute inset-0 size-full object-fill"
                draggable={false}
                src={preview.url}
              />
              <div
                aria-label="Area di ritaglio. Trascina o usa le frecce per spostarla"
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgb(3_12_25/0.58)]"
                onKeyDown={moveCropWithKeyboard}
                onPointerDown={(event) => beginPointerGesture(event, "move")}
                role="group"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`,
                }}
                tabIndex={0}
              >
                {CROP_HANDLES.map((handle) => (
                  <button
                    aria-label={handle.label}
                    className={`absolute grid size-10 place-items-center rounded-full border-2 border-white bg-primary shadow-lg ${handle.className}`}
                    key={handle.gesture}
                    onKeyDown={(event) =>
                      moveHandleWithKeyboard(event, handle.gesture)
                    }
                    onPointerDown={(event) =>
                      beginPointerGesture(event, handle.gesture)
                    }
                    type="button"
                  >
                    <span className="size-2 rounded-full bg-white" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <LoaderCircle
              aria-label="Preparo anteprima"
              className="size-8 animate-spin text-white/80"
            />
          )}
        </div>

        <div className="mx-auto mt-4 grid w-full max-w-xl gap-3">
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
            <Button
              aria-label="Ruota 90 gradi a sinistra"
              className="size-11 border-white/25 bg-white/10 p-0 text-white hover:bg-white/15"
              disabled={preparing}
              onClick={() =>
                setRotation((current) => rotateByQuarterTurn(current, -1))
              }
              type="button"
              variant="secondary"
            >
              <RotateCcw aria-hidden="true" className="size-5" />
            </Button>
            <label className="grid min-w-0 gap-1 text-xs font-bold">
              <span className="flex justify-between gap-2">
                <span>Rotazione libera</span>
                <output>{rotation}°</output>
              </span>
              <input
                aria-label="Rotazione foto da meno 180 a 180 gradi"
                className="h-10 w-full accent-[#70a8ff]"
                disabled={preparing}
                max={180}
                min={-180}
                onChange={(event) => setRotation(Number(event.target.value))}
                step={1}
                type="range"
                value={rotation}
              />
            </label>
            <Button
              aria-label="Ruota 90 gradi a destra"
              className="size-11 border-white/25 bg-white/10 p-0 text-white hover:bg-white/15"
              disabled={preparing}
              onClick={() =>
                setRotation((current) => rotateByQuarterTurn(current, 1))
              }
              type="button"
              variant="secondary"
            >
              <RotateCw aria-hidden="true" className="size-5" />
            </Button>
          </div>
          <p className="text-center text-xs leading-5 text-white/70">
            Trascina il riquadro e i quattro angoli. Includi soltanto le righe
            degli allievi.
          </p>
          {error && (
            <p
              className="text-center text-xs font-semibold text-[#ffb4ab]"
              role="alert"
            >
              Non riesco a preparare questa foto. Scegline un’altra.
            </p>
          )}
          <Button
            className="w-full"
            disabled={!preview || preparing}
            onClick={() => void handleUseArea()}
            size="lg"
            type="button"
          >
            {preparing ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
            ) : (
              <Check aria-hidden="true" className="size-5" />
            )}
            {preparing ? "Preparo l’area…" : "Usa questa area"}
          </Button>
        </div>
      </div>
    </section>
  )
}
