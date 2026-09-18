import { useEffect, useRef } from "react"

const BAR_COUNT = 28
const BAR_WIDTH = 2
const BAR_GAP = 2
const HEIGHT = 20
const WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP

/**
 * A compact level history for the open microphone.
 *
 * It draws straight to a canvas from an animation frame rather than through
 * React state: the level changes about sixty times a second and must not
 * re-render the note editor around it. The element is decorative, so it is
 * hidden from assistive technology; the recording state is already announced
 * by the button and the panel's status text.
 */
export function DictationMeter({
  stream,
  className,
}: {
  stream: MediaStream | null
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!stream || !canvas) return

    const canvasContext = canvas.getContext("2d")
    if (!canvasContext) return
    const context = canvasContext

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches

    // Read once: resolving a computed style every frame is needless work.
    const barColor = getComputedStyle(canvas).color

    const ratio = Math.min(3, window.devicePixelRatio || 1)
    canvas.width = WIDTH * ratio
    canvas.height = HEIGHT * ratio
    context.scale(ratio, ratio)

    const AudioContextConstructor =
      typeof AudioContext !== "undefined"
        ? AudioContext
        : (
            globalThis as typeof globalThis & {
              webkitAudioContext?: typeof AudioContext
            }
          ).webkitAudioContext
    if (!AudioContextConstructor) return

    const audio = new AudioContextConstructor()
    const analyser = audio.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.7
    const source = audio.createMediaStreamSource(stream)
    source.connect(analyser)
    void audio.resume().catch(() => undefined)

    const samples = new Uint8Array(analyser.fftSize)
    const levels = new Array<number>(BAR_COUNT).fill(0)
    let frame = 0
    let last = 0

    function draw(now: number) {
      frame = requestAnimationFrame(draw)
      // Reduced motion still shows the level, just far less often.
      const interval = reduceMotion ? 200 : 45
      if (now - last < interval) return
      last = now

      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) {
        const centred = (sample - 128) / 128
        sum += centred * centred
      }
      // Speech sits low in a linear scale, so lift it into a readable range.
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 3.2)
      levels.push(level)
      levels.shift()

      context.clearRect(0, 0, WIDTH, HEIGHT)
      context.fillStyle = barColor
      for (const [index, value] of levels.entries()) {
        const height = Math.max(2, value * HEIGHT)
        const x = index * (BAR_WIDTH + BAR_GAP)
        const y = (HEIGHT - height) / 2
        // Older samples fade, so the eye follows the current level.
        context.globalAlpha = 0.25 + 0.75 * (index / (BAR_COUNT - 1))
        context.beginPath()
        context.roundRect(x, y, BAR_WIDTH, height, BAR_WIDTH / 2)
        context.fill()
      }
      context.globalAlpha = 1
    }

    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      analyser.disconnect()
      void audio.close().catch(() => undefined)
    }
  }, [stream])

  if (!stream) return null

  return (
    <canvas
      aria-hidden="true"
      className={className}
      ref={canvasRef}
      style={{ width: WIDTH, height: HEIGHT }}
    />
  )
}
