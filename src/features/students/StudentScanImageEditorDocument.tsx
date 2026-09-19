import {
  Check,
  LoaderCircle,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Ruler,
  X,
} from "lucide-react"
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
  normalizedLineAngle,
  prepareStudentScanImage,
  updateNormalizedCrop,
  type CropGesture,
  type NormalizedCrop,
  type NormalizedPoint,
} from "@/features/students/studentImageCrop"

interface PointerGesture {
  pointerId: number
  gesture: CropGesture | "pan"
  startX: number
  startY: number
  crop: NormalizedCrop
  offset: { x: number; y: number }
}

interface StraightenLine {
  start: NormalizedPoint
  end: NormalizedPoint
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25
const FINE_ANGLE_STEP = 0.1

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

function clampAngle(value: number) {
  const rounded = Math.round(value * 10) / 10
  if (rounded > 180) return rounded - 360
  if (rounded < -180) return rounded + 360
  return rounded
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

/**
 * Pan is expressed in stage widths so it survives a resize. The image may not
 * be dragged away from the frame: at fit there is nothing to pan, and at higher
 * zoom the travel is exactly the part of the image pushed outside the stage.
 */
function clampOffset(offset: { x: number; y: number }, zoom: number) {
  const travel = Math.max(0, (zoom - 1) / (2 * zoom))
  return {
    x: Math.min(travel, Math.max(-travel, offset.x)),
    y: Math.min(travel, Math.max(-travel, offset.y)),
  }
}

/**
 * The full-frame document workspace: no rotation slider, direct crop, zoom and
 * pan, and straightening taken from a line drawn along a rule on the sheet.
 */
export function StudentScanImageEditorDocument({
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
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [straightening, setStraightening] = useState(false)
  const [line, setLine] = useState<StraightenLine | null>(null)
  const [preview, setPreview] = useState<{
    url: string
    width: number
    height: number
  }>()
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState(false)
  const dialogRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const pointerGestureRef = useRef<PointerGesture | null>(null)
  const linePointerRef = useRef<number | null>(null)
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

  function stagePoint(event: ReactPointerEvent<HTMLElement>): NormalizedPoint {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return { x: 0, y: 0 }
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    }
  }

  function beginPointerGesture(
    event: ReactPointerEvent<HTMLElement>,
    gesture: CropGesture | "pan",
  ) {
    if (straightening) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      gesture,
      startX: event.clientX,
      startY: event.clientY,
      crop,
      offset,
    }
  }

  function movePointer(event: ReactPointerEvent<HTMLElement>) {
    const gesture = pointerGestureRef.current
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!gesture || !bounds || gesture.pointerId !== event.pointerId) return
    // Pointer travel is divided by the zoom so a drag keeps up with the
    // fingertip instead of racing ahead of it when the view is magnified.
    const deltaX = (event.clientX - gesture.startX) / (bounds.width * zoom)
    const deltaY = (event.clientY - gesture.startY) / (bounds.height * zoom)
    if (gesture.gesture === "pan") {
      setOffset(
        clampOffset(
          { x: gesture.offset.x + deltaX, y: gesture.offset.y + deltaY },
          zoom,
        ),
      )
      return
    }
    setCrop(updateNormalizedCrop(gesture.crop, gesture.gesture, deltaX, deltaY))
  }

  function finishPointer(event: ReactPointerEvent<HTMLElement>) {
    if (pointerGestureRef.current?.pointerId === event.pointerId)
      pointerGestureRef.current = null
  }

  function beginLine(event: ReactPointerEvent<HTMLElement>) {
    if (!straightening) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    linePointerRef.current = event.pointerId
    const point = stagePoint(event)
    setLine({ start: point, end: point })
  }

  function extendLine(event: ReactPointerEvent<HTMLElement>) {
    if (linePointerRef.current !== event.pointerId) return
    setLine((current) =>
      current ? { ...current, end: stagePoint(event) } : current,
    )
  }

  function commitLine(event: ReactPointerEvent<HTMLElement>) {
    if (linePointerRef.current !== event.pointerId) return
    linePointerRef.current = null
    setLine((current) => {
      if (!current) return null
      const travelled =
        Math.abs(current.end.x - current.start.x) +
        Math.abs(current.end.y - current.start.y)
      // A tap is not a line. Ignore it rather than snapping to a wild angle.
      if (travelled < 0.05) return null
      const angle = normalizedLineAngle(current.start, current.end)
      setRotation((value) => clampAngle(value - angle))
      return null
    })
    setStraightening(false)
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
      if (straightening) {
        setStraightening(false)
        setLine(null)
        return
      }
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

  function resetAll() {
    setRotation(0)
    setCrop(DEFAULT_STUDENT_SCAN_CROP)
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
    setLine(null)
    setStraightening(false)
  }

  function changeZoom(next: number) {
    const nextZoom = clampZoom(next)
    setZoom(nextZoom)
    setOffset((current) => clampOffset(current, nextZoom))
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

  const controlClass =
    "size-11 border-white/25 bg-white/10 p-0 text-white hover:bg-white/15"

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
          className={controlClass}
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
          aria-label="Ripristina foto"
          className={controlClass}
          disabled={preparing}
          onClick={resetAll}
          type="button"
          variant="secondary"
        >
          <Redo2 aria-hidden="true" className="size-5" />
        </Button>
      </header>

      {/* The stage owns the whole frame and clips its own dimming, so the mask
          can never spill over the controls below it. */}
      <div
        aria-label="Area di lavoro foto"
        className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
        onPointerCancel={(event) => {
          finishPointer(event)
          commitLine(event)
        }}
        onPointerDown={(event) => {
          if (straightening) beginLine(event)
          else beginPointerGesture(event, "pan")
        }}
        onPointerMove={(event) => {
          movePointer(event)
          extendLine(event)
        }}
        onPointerUp={(event) => {
          finishPointer(event)
          commitLine(event)
        }}
        ref={stageRef}
      >
        {preview ? (
          <div
            className="absolute inset-0 grid place-items-center"
            style={{
              transform: `translate(${offset.x * 100}%, ${offset.y * 100}%) scale(${zoom})`,
            }}
          >
            <div
              className="relative max-h-full max-w-full"
              style={{ aspectRatio: `${preview.width} / ${preview.height}` }}
            >
              <img
                alt="Anteprima foto da ritagliare"
                className="absolute inset-0 size-full object-contain"
                draggable={false}
                src={preview.url}
              />
              <div
                aria-label="Area di ritaglio. Trascina o usa le frecce per spostarla"
                className="absolute cursor-move border-2 border-white outline outline-[9999px] outline-[rgb(3_12_25/0.58)]"
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
                    style={{ transform: `scale(${1 / zoom})` }}
                    type="button"
                  >
                    <span className="size-2 rounded-full bg-white" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid size-full place-items-center">
            <LoaderCircle
              aria-label="Preparo anteprima"
              className="size-8 animate-spin text-white/80"
            />
          </div>
        )}

        {straightening && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-3 text-center text-xs font-semibold text-white">
              Traccia una linea lungo una riga del foglio
            </div>
            {line && (
              <svg className="absolute inset-0 size-full">
                <line
                  stroke="#70a8ff"
                  strokeWidth={2}
                  x1={`${line.start.x * 100}%`}
                  x2={`${line.end.x * 100}%`}
                  y1={`${line.start.y * 100}%`}
                  y2={`${line.end.y * 100}%`}
                />
              </svg>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/15 px-3 py-3">
        <div className="mx-auto grid w-full max-w-xl gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              aria-label="Ruota 90 gradi a sinistra"
              className={controlClass}
              disabled={preparing}
              onClick={() =>
                setRotation((current) => rotateByQuarterTurn(current, -1))
              }
              type="button"
              variant="secondary"
            >
              <RotateCcw aria-hidden="true" className="size-5" />
            </Button>
            <Button
              aria-label="Ruota 90 gradi a destra"
              className={controlClass}
              disabled={preparing}
              onClick={() =>
                setRotation((current) => rotateByQuarterTurn(current, 1))
              }
              type="button"
              variant="secondary"
            >
              <RotateCw aria-hidden="true" className="size-5" />
            </Button>
            <Button
              aria-label="Raddrizza con una linea"
              aria-pressed={straightening}
              className={`min-h-11 px-3 text-xs ${straightening ? "bg-white text-[#09182b]" : "border-white/25 bg-white/10 text-white hover:bg-white/15"}`}
              disabled={preparing || !preview}
              onClick={() => {
                setLine(null)
                setStraightening((current) => !current)
              }}
              type="button"
              variant="secondary"
            >
              <Ruler aria-hidden="true" className="size-4" />
              Linea
            </Button>
            <Button
              aria-label="Riduci ingrandimento"
              className={controlClass}
              disabled={preparing || zoom <= MIN_ZOOM}
              onClick={() => changeZoom(zoom - ZOOM_STEP)}
              type="button"
              variant="secondary"
            >
              <Minus aria-hidden="true" className="size-5" />
            </Button>
            <output className="min-w-14 text-center text-xs font-bold">
              {Math.round(zoom * 100)}%
            </output>
            <Button
              aria-label="Aumenta ingrandimento"
              className={controlClass}
              disabled={preparing || zoom >= MAX_ZOOM}
              onClick={() => changeZoom(zoom + ZOOM_STEP)}
              type="button"
              variant="secondary"
            >
              <Plus aria-hidden="true" className="size-5" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              aria-label="Ruota di un decimo di grado a sinistra"
              className={controlClass}
              disabled={preparing}
              onClick={() =>
                setRotation((current) => clampAngle(current - FINE_ANGLE_STEP))
              }
              type="button"
              variant="secondary"
            >
              −
            </Button>
            <label className="grid gap-1 text-xs font-bold">
              <span className="sr-only">Angolo in gradi</span>
              <input
                aria-label="Angolo in gradi"
                className="h-11 w-24 rounded-xl border border-white/25 bg-white/10 px-2 text-center text-sm text-white"
                disabled={preparing}
                inputMode="decimal"
                max={180}
                min={-180}
                onChange={(event) =>
                  setRotation(clampAngle(Number(event.target.value) || 0))
                }
                step={FINE_ANGLE_STEP}
                type="number"
                value={rotation}
              />
            </label>
            <Button
              aria-label="Ruota di un decimo di grado a destra"
              className={controlClass}
              disabled={preparing}
              onClick={() =>
                setRotation((current) => clampAngle(current + FINE_ANGLE_STEP))
              }
              type="button"
              variant="secondary"
            >
              +
            </Button>
          </div>

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
