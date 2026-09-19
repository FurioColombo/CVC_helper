import { Check, LoaderCircle, RotateCcw, Ruler } from "lucide-react"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"

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

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const MAX_TILT = 45
const TILT_STEP = 0.1
/** Pixels of ruler travel per degree, the spacing the Photos dial uses. */
const PIXELS_PER_DEGREE = 6

const CROP_CORNERS: Array<{
  gesture: Exclude<CropGesture, "move">
  label: string
  position: string
  bracket: string
}> = [
  {
    gesture: "north-west",
    label: "Ridimensiona ritaglio dall’angolo in alto a sinistra",
    position: "left-0 top-0",
    bracket: "border-l-[3px] border-t-[3px] rounded-tl-sm",
  },
  {
    gesture: "north-east",
    label: "Ridimensiona ritaglio dall’angolo in alto a destra",
    position: "right-0 top-0",
    bracket: "border-r-[3px] border-t-[3px] rounded-tr-sm",
  },
  {
    gesture: "south-west",
    label: "Ridimensiona ritaglio dall’angolo in basso a sinistra",
    position: "bottom-0 left-0",
    bracket: "border-b-[3px] border-l-[3px] rounded-bl-sm",
  },
  {
    gesture: "south-east",
    label: "Ridimensiona ritaglio dall’angolo in basso a destra",
    position: "right-0 bottom-0",
    bracket: "border-r-[3px] border-b-[3px] rounded-br-sm",
  },
]

function clampTilt(value: number) {
  return Math.min(MAX_TILT, Math.max(-MAX_TILT, Math.round(value * 10) / 10))
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

/**
 * Pan is expressed in stage widths. At fit there is nothing to pan; above it the
 * travel is exactly the part of the image the zoom pushes outside the frame.
 */
function clampOffset(offset: { x: number; y: number }, zoom: number) {
  const travel = Math.max(0, (zoom - 1) / (2 * zoom))
  return {
    x: Math.min(travel, Math.max(-travel, offset.x)),
    y: Math.min(travel, Math.max(-travel, offset.y)),
  }
}

/**
 * Fit a picture inside the stage. The box is computed rather than left to CSS:
 * an aspect-ratio box with no resolvable length collapses to nothing, which is
 * how this surface once rendered an invisible photograph.
 */
function fitInside(
  stage: { width: number; height: number },
  aspect: number,
): { width: number; height: number } {
  if (stage.width <= 0 || stage.height <= 0 || !Number.isFinite(aspect)) {
    return { width: 0, height: 0 }
  }
  const byWidth = { width: stage.width, height: stage.width / aspect }
  if (byWidth.height <= stage.height) return byWidth
  return { width: stage.height * aspect, height: stage.height }
}

const TICKS = Array.from({ length: MAX_TILT * 2 + 1 }, (_, i) => i - MAX_TILT)

/**
 * The adjustment surface: the picture fills the frame, a translucent ruler
 * carries the inclination, and the controls stay out of the way.
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
  const [quarter, setQuarter] = useState(0)
  const [tilt, setTilt] = useState(0)
  const [crop, setCrop] = useState(DEFAULT_STUDENT_SCAN_CROP)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [straightening, setStraightening] = useState(false)
  const [line, setLine] = useState<{
    start: NormalizedPoint
    end: NormalizedPoint
  } | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
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
  const rulerPointerRef = useRef<{
    pointerId: number
    startX: number
    tilt: number
  } | null>(null)
  const pinchRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null)
  const previewSequenceRef = useRef(0)
  const activeRef = useRef(true)

  const rotation = quarter + tilt

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const bounds = stage.getBoundingClientRect()
      setStageSize({ width: bounds.width, height: bounds.height })
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
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

  const fitted = preview
    ? fitInside(stageSize, preview.width / preview.height)
    : { width: 0, height: 0 }

  function stagePoint(event: ReactPointerEvent<HTMLElement>): NormalizedPoint {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds || !bounds.width || !bounds.height) return { x: 0, y: 0 }
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
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setAdjusting(true)
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
    if (pinchRef.current.has(event.pointerId)) {
      pinchRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
      const points = [...pinchRef.current.values()]
      if (points.length === 2 && pinchStartRef.current) {
        const distance = Math.hypot(
          points[0]!.x - points[1]!.x,
          points[0]!.y - points[1]!.y,
        )
        const next = clampZoom(
          (pinchStartRef.current.zoom * distance) /
            pinchStartRef.current.distance,
        )
        setZoom(next)
        setOffset((current) => clampOffset(current, next))
        return
      }
    }
    const gesture = pointerGestureRef.current
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!gesture || !bounds || gesture.pointerId !== event.pointerId) return
    if (!bounds.width || !bounds.height) return
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
    pinchRef.current.delete(event.pointerId)
    if (pinchRef.current.size < 2) pinchStartRef.current = null
    if (pointerGestureRef.current?.pointerId === event.pointerId) {
      pointerGestureRef.current = null
    }
    if (!pointerGestureRef.current && !rulerPointerRef.current)
      setAdjusting(false)
  }

  function trackPinch(event: ReactPointerEvent<HTMLElement>) {
    pinchRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    const points = [...pinchRef.current.values()]
    if (points.length === 2) {
      pinchStartRef.current = {
        distance: Math.hypot(
          points[0]!.x - points[1]!.x,
          points[0]!.y - points[1]!.y,
        ),
        zoom,
      }
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!preview) return
    const next = clampZoom(zoom - event.deltaY / 500)
    setZoom(next)
    setOffset((current) => clampOffset(current, next))
  }

  function beginLine(event: ReactPointerEvent<HTMLElement>) {
    if (!straightening) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
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
      setTilt((value) => clampTilt(value - angle))
      return null
    })
    setStraightening(false)
  }

  function beginRuler(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    rulerPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      tilt,
    }
    setAdjusting(true)
  }

  function moveRuler(event: ReactPointerEvent<HTMLDivElement>) {
    const ruler = rulerPointerRef.current
    if (!ruler || ruler.pointerId !== event.pointerId) return
    // Dragging left reveals larger angles, as the dial under a thumb would.
    setTilt(
      clampTilt(
        ruler.tilt - (event.clientX - ruler.startX) / PIXELS_PER_DEGREE,
      ),
    )
  }

  function finishRuler(event: ReactPointerEvent<HTMLDivElement>) {
    if (rulerPointerRef.current?.pointerId !== event.pointerId) return
    rulerPointerRef.current = null
    if (!pointerGestureRef.current) setAdjusting(false)
  }

  function rulerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 1 : TILT_STEP
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault()
      setTilt((current) => clampTilt(current - step))
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault()
      setTilt((current) => clampTilt(current + step))
    } else if (event.key === "Home") {
      event.preventDefault()
      setTilt(0)
    }
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
    setQuarter(0)
    setTilt(0)
    setCrop(DEFAULT_STUDENT_SCAN_CROP)
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
    setLine(null)
    setStraightening(false)
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

  const ghost =
    "grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 active:scale-95 disabled:opacity-40"

  return (
    <section
      aria-label="Raddrizza e ritaglia foto"
      aria-modal="true"
      className="fixed inset-0 z-70 flex flex-col overflow-hidden bg-black text-white"
      onKeyDown={handleDialogKeyDown}
      ref={dialogRef}
      role="dialog"
    >
      <header className="flex shrink-0 items-center justify-between px-4 py-3 text-sm">
        <button
          aria-label="Chiudi regolazione foto"
          autoFocus
          className="min-h-11 rounded-full px-2 font-semibold text-white/85 transition hover:text-white"
          onClick={onCancel}
          type="button"
        >
          Annulla
        </button>
        <p className="truncate text-xs font-semibold text-white/60">
          {source === "camera" ? "Foto appena scattata" : "Dalla galleria"}
        </p>
        <button
          aria-label="Ripristina foto"
          className="min-h-11 rounded-full px-2 font-semibold text-white/85 transition hover:text-white disabled:opacity-40"
          disabled={preparing}
          onClick={resetAll}
          type="button"
        >
          Ripristina
        </button>
      </header>

      <div
        aria-label="Area di lavoro foto"
        className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
        onPointerCancel={(event) => {
          finishPointer(event)
          commitLine(event)
        }}
        onPointerDown={(event) => {
          trackPinch(event)
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
        onWheel={handleWheel}
        ref={stageRef}
      >
        {preview ? (
          <div className="absolute inset-0 grid place-items-center">
            <div
              className="relative"
              style={{
                width: fitted.width || undefined,
                height: fitted.height || undefined,
                transform: `translate(${offset.x * 100}%, ${offset.y * 100}%) scale(${zoom})`,
              }}
            >
              <img
                alt="Anteprima foto da ritagliare"
                className="absolute inset-0 size-full object-contain"
                draggable={false}
                src={preview.url}
              />
              <div
                aria-label="Area di ritaglio. Trascina o usa le frecce per spostarla"
                className="absolute cursor-move outline outline-[9999px] outline-black/55"
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
                <div className="absolute inset-0 border border-white/70" />
                {/* Thirds appear only while a gesture is live, as Photos does. */}
                <div
                  className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${adjusting ? "opacity-100" : "opacity-0"}`}
                >
                  <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
                  <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
                  <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
                  <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
                </div>
                {CROP_CORNERS.map((corner) => (
                  <button
                    aria-label={corner.label}
                    className={`absolute grid size-11 ${corner.position}`}
                    key={corner.gesture}
                    onKeyDown={(event) =>
                      moveHandleWithKeyboard(event, corner.gesture)
                    }
                    onPointerDown={(event) =>
                      beginPointerGesture(event, corner.gesture)
                    }
                    style={{ transform: `scale(${1 / zoom})` }}
                    type="button"
                  >
                    <span
                      className={`size-6 border-white ${corner.bracket} ${corner.position.includes("right") ? "justify-self-end" : ""} ${corner.position.includes("bottom") ? "self-end" : ""}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid size-full place-items-center">
            <LoaderCircle
              aria-label="Preparo anteprima"
              className="size-7 animate-spin text-white/70"
            />
          </div>
        )}

        {straightening && (
          <div className="pointer-events-none absolute inset-0">
            <p className="absolute inset-x-0 top-4 text-center text-xs font-semibold text-white/90">
              Traccia una linea lungo una riga del foglio
            </p>
            {line && (
              <svg className="absolute inset-0 size-full">
                <line
                  stroke="#f5c451"
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

      {/* Inclination: a translucent dial over the picture, not a control bar. */}
      <div className="relative shrink-0 px-4 pb-3">
        <div
          aria-label="Inclinazione in gradi"
          aria-valuemax={MAX_TILT}
          aria-valuemin={-MAX_TILT}
          aria-valuenow={tilt}
          aria-valuetext={`${tilt.toFixed(1).replace(".", ",")} gradi`}
          className="relative h-16 touch-none overflow-hidden select-none"
          onKeyDown={rulerKeyDown}
          onPointerCancel={finishRuler}
          onPointerDown={beginRuler}
          onPointerMove={moveRuler}
          onPointerUp={finishRuler}
          role="slider"
          tabIndex={0}
          style={{
            maskImage:
              "linear-gradient(90deg, transparent, black 18%, black 82%, transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, black 18%, black 82%, transparent)",
          }}
        >
          <div
            className="absolute top-6 left-1/2 flex items-end"
            style={{
              transform: `translateX(calc(-50% - ${tilt * PIXELS_PER_DEGREE}px))`,
            }}
          >
            {TICKS.map((tick) => (
              <span
                className="flex shrink-0 justify-center"
                key={tick}
                style={{ width: PIXELS_PER_DEGREE }}
              >
                <span
                  className={
                    tick % 5 === 0
                      ? "h-4 w-px bg-white/80"
                      : "h-2 w-px bg-white/30"
                  }
                />
              </span>
            ))}
          </div>
          <output className="absolute inset-x-0 top-0 text-center text-sm font-semibold tabular-nums text-white">
            {tilt === 0 ? "0°" : `${tilt.toFixed(1).replace(".", ",")}°`}
          </output>
          <span className="pointer-events-none absolute top-5 left-1/2 h-6 w-0.5 -translate-x-1/2 rounded-full bg-[#f5c451]" />
        </div>
      </div>

      <div className="shrink-0 px-4 pb-5">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <button
            aria-label="Ruota 90 gradi a sinistra"
            className={ghost}
            disabled={preparing}
            onClick={() => setQuarter((current) => (current - 90) % 360)}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-5" />
          </button>
          <button
            aria-label="Raddrizza con una linea"
            aria-pressed={straightening}
            className={`${ghost} ${straightening ? "bg-[#f5c451] text-black" : ""}`}
            disabled={preparing || !preview}
            onClick={() => {
              setLine(null)
              setStraightening((current) => !current)
            }}
            type="button"
          >
            <Ruler aria-hidden="true" className="size-5" />
          </button>
          <output
            aria-label="Ingrandimento"
            className="min-w-12 text-xs font-semibold tabular-nums text-white/60"
          >
            {Math.round(zoom * 100)}%
          </output>
          <button
            className="ml-auto grid min-h-12 flex-1 place-items-center rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-40"
            disabled={!preview || preparing}
            onClick={() => void handleUseArea()}
            type="button"
          >
            {preparing ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
            ) : (
              <span className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-4" />
                Usa questa area
              </span>
            )}
          </button>
        </div>
        {error && (
          <p
            className="mt-2 text-center text-xs font-semibold text-[#ffb4ab]"
            role="alert"
          >
            Non riesco a preparare questa foto. Scegline un’altra.
          </p>
        )}
      </div>
    </section>
  )
}
