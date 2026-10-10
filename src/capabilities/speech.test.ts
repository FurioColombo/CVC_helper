import { beforeEach, describe, expect, it, vi } from "vitest"

const { pipelineMock } = vi.hoisted(() => ({ pipelineMock: vi.fn() }))

vi.mock("@huggingface/transformers", () => ({
  pipeline: pipelineMock,
  // `configureLocalOnnxRuntime` reads this shape off the real module's `env`
  // export to point onnxruntime-web at local WASM assets (RR-6); the mock
  // needs the same shape so the named import resolves at all.
  env: { backends: { onnx: { wasm: {} } } },
}))

import {
  createLocalItalianSpeechProvider,
  PRODUCTION_SPEECH_CONFIG,
  type SpeechTranscriber,
} from "@/capabilities/speech"

describe("local Italian speech provider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("reports real load/processing phases and reuses the loaded model", async () => {
    const decode = vi.fn().mockResolvedValue(new Float32Array([0.2, -0.1]))
    const transcriber = vi
      .fn<SpeechTranscriber>()
      .mockResolvedValue({ text: "  Timone più leggero  " })
    const loadTranscriber = vi.fn(
      async (onProgress: (value?: number) => void) => {
        onProgress(37)
        onProgress(100)
        return transcriber
      },
    )
    const provider = createLocalItalianSpeechProvider({
      decode,
      loadTranscriber,
    })
    const prepareProgress: string[] = []

    await provider.prepare({
      onProgress: ({ phase, percent }) =>
        prepareProgress.push(`${phase}:${percent ?? "unknown"}`),
    })

    const firstProgress: string[] = []

    await expect(
      provider.transcribeAudio(new Blob(["fixture-audio"]), {
        onProgress: ({ phase, percent }) =>
          firstProgress.push(`${phase}:${percent ?? "unknown"}`),
      }),
    ).resolves.toBe("Timone più leggero")

    const secondProgress: string[] = []
    await provider.transcribeAudio(new Blob(["second-fixture"]), {
      onProgress: ({ phase }) => secondProgress.push(phase),
    })

    expect(prepareProgress).toEqual([
      "loading:unknown",
      "loading:37",
      "loading:100",
    ])
    expect(firstProgress).toEqual(["processing:unknown"])
    expect(secondProgress).toEqual(["processing"])
    expect(loadTranscriber).toHaveBeenCalledOnce()
    expect(decode).toHaveBeenCalledTimes(2)
    // The repetition brakes travel with every request: without them Whisper
    // turns a short note into hundreds of repeated words.
    expect(transcriber).toHaveBeenCalledWith(new Float32Array([0.2, -0.1]), {
      language: "italian",
      task: "transcribe",
      ...PRODUCTION_SPEECH_CONFIG.generationOptions,
    })
  })

  it("rejects empty audio before loading assets", async () => {
    const loadTranscriber = vi.fn()
    const provider = createLocalItalianSpeechProvider({ loadTranscriber })

    await expect(provider.transcribeAudio(new Blob())).rejects.toThrow(
      "Cannot transcribe empty audio",
    )
    expect(loadTranscriber).not.toHaveBeenCalled()
  })

  it("reports only aggregate model progress and ignores per-file percentages", async () => {
    const transcriber = vi
      .fn<SpeechTranscriber>()
      .mockResolvedValue({ text: "pronto" })
    pipelineMock.mockImplementation(
      async (
        _task: string,
        _model: string,
        options: { progress_callback: (event: unknown) => void },
      ) => {
        options.progress_callback({ status: "progress", progress: 100 })
        options.progress_callback({ status: "progress_total", progress: 41.6 })
        options.progress_callback({ status: "ready" })
        return transcriber
      },
    )
    const provider = createLocalItalianSpeechProvider({
      decode: vi.fn().mockResolvedValue(new Float32Array([0.1])),
    })
    const progress: Array<number | undefined> = []

    await provider.prepare({
      onProgress: (event) => progress.push(event.percent),
    })

    expect(progress).toEqual([undefined, 42, 100])
    expect(pipelineMock).toHaveBeenCalledWith(
      "automatic-speech-recognition",
      PRODUCTION_SPEECH_CONFIG.modelId,
      expect.objectContaining({ dtype: PRODUCTION_SPEECH_CONFIG.dtype }),
    )
  })

  it("chunks a dictation longer than 30 seconds instead of silently truncating it", async () => {
    const transcriber = vi
      .fn<SpeechTranscriber>()
      .mockResolvedValue({ text: "nota lunga" })
    // 31 seconds at Whisper's 16 kHz mono sample rate.
    const longAudio = new Float32Array(31 * 16_000)
    const decode = vi.fn().mockResolvedValue(longAudio)
    const provider = createLocalItalianSpeechProvider({
      decode,
      loadTranscriber: vi.fn().mockResolvedValue(transcriber),
    })

    await provider.transcribeAudio(new Blob(["fixture-audio"]))

    expect(transcriber).toHaveBeenCalledWith(longAudio, {
      language: "italian",
      task: "transcribe",
      ...PRODUCTION_SPEECH_CONFIG.generationOptions,
      chunk_length_s: 30,
      stride_length_s: 5,
    })
  })

  it("keeps the plain, unchunked call for a clip of 30 seconds or less", async () => {
    const transcriber = vi
      .fn<SpeechTranscriber>()
      .mockResolvedValue({ text: "nota breve" })
    const shortAudio = new Float32Array(30 * 16_000)
    const decode = vi.fn().mockResolvedValue(shortAudio)
    const provider = createLocalItalianSpeechProvider({
      decode,
      loadTranscriber: vi.fn().mockResolvedValue(transcriber),
    })

    await provider.transcribeAudio(new Blob(["fixture-audio"]))

    expect(transcriber).toHaveBeenCalledWith(shortAudio, {
      language: "italian",
      task: "transcribe",
      ...PRODUCTION_SPEECH_CONFIG.generationOptions,
    })
  })

  it("allows a model load to be retried after a transient failure", async () => {
    const transcriber = vi
      .fn<SpeechTranscriber>()
      .mockResolvedValue({ text: "recuperato" })
    const loadTranscriber = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(transcriber)
    const provider = createLocalItalianSpeechProvider({
      decode: vi.fn().mockResolvedValue(new Float32Array([0.1])),
      loadTranscriber,
    })
    const audio = new Blob(["fixture"])

    await expect(provider.transcribeAudio(audio)).rejects.toThrow("offline")
    await expect(provider.transcribeAudio(audio)).resolves.toBe("recuperato")
    expect(loadTranscriber).toHaveBeenCalledTimes(2)
  })

  // F1F-6: the test environment's own `navigator` must not decide the branch:
  // jsdom's default vendor ("Apple Computer, Inc.") satisfies
  // `isSafariBrowser()` on its own, and Node's navigator has no vendor at all.
  // A non-Apple vendor and a Chrome userAgent are set explicitly so the
  // asyncify pair this branch actually assigns is what gets asserted.
  it("loads the pinned model with the ONNX runtime from the app's own files", async () => {
    Object.defineProperty(navigator, "vendor", {
      configurable: true,
      value: "Google Inc.",
    })
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    })
    try {
      pipelineMock.mockResolvedValue(vi.fn().mockResolvedValue({ text: "ok" }))
      const provider = createLocalItalianSpeechProvider({
        decode: vi.fn().mockResolvedValue(new Float32Array([0.1])),
      })

      await provider.prepare()

      const { env } = await import("@huggingface/transformers")
      const wasmPaths = (
        env as { backends: { onnx: { wasm: { wasmPaths?: unknown } } } }
      ).backends.onnx.wasm.wasmPaths as { mjs: string; wasm: string }
      // Never the jsDelivr default: executable code comes from this build.
      expect(JSON.stringify(wasmPaths)).not.toMatch(/jsdelivr|https?:/)
      // The exact asyncify pair this branch assigns (see the ternary in
      // `configureLocalOnnxRuntime`), not just the prefix the Safari
      // branch's own files share with these: a regex matching that shared
      // prefix alone would pass just as well against the non-asyncify pair.
      expect(wasmPaths.mjs).toMatch(
        /ort-wasm-simd-threaded\.asyncify\.mjs(\?.*)?$/,
      )
      expect(wasmPaths.wasm).toMatch(
        /ort-wasm-simd-threaded\.asyncify\.wasm(\?.*)?$/,
      )
      expect(pipelineMock).toHaveBeenCalledWith(
        "automatic-speech-recognition",
        PRODUCTION_SPEECH_CONFIG.modelId,
        expect.objectContaining({
          revision: PRODUCTION_SPEECH_CONFIG.revision,
        }),
      )
      expect(PRODUCTION_SPEECH_CONFIG.revision).toMatch(/^[0-9a-f]{40}$/)
    } finally {
      Reflect.deleteProperty(navigator, "vendor")
      Reflect.deleteProperty(navigator, "userAgent")
    }
  })

  // F1 review round 3, F1R3-7/F1R-14: the Safari and non-Safari branches use
  // different pre-built ONNX runtime pairs (`isSafariBrowser`/
  // `configureLocalOnnxRuntime` in speech.ts); this proves the Safari one
  // never points at jsDelivr either, and that it is truly the non-asyncify
  // pair rather than merely matching a prefix the asyncify files share.
  it("also avoids jsDelivr on the Safari branch of the local ONNX runtime paths", async () => {
    Object.defineProperty(navigator, "vendor", {
      configurable: true,
      value: "Apple Computer, Inc.",
    })
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    })
    try {
      pipelineMock.mockResolvedValue(vi.fn().mockResolvedValue({ text: "ok" }))
      const provider = createLocalItalianSpeechProvider({
        decode: vi.fn().mockResolvedValue(new Float32Array([0.1])),
      })

      await provider.prepare()

      const { env } = await import("@huggingface/transformers")
      const wasmPaths = (
        env as { backends: { onnx: { wasm: { wasmPaths?: unknown } } } }
      ).backends.onnx.wasm.wasmPaths as { mjs: string; wasm: string }
      expect(JSON.stringify(wasmPaths)).not.toMatch(/jsdelivr|https?:/)
      // The exact non-asyncify pair this branch assigns, and never the
      // asyncify one: the shared "ort-wasm-simd-threaded" prefix alone would
      // pass against either file, which is exactly what let this assertion
      // stay green regardless of which pair actually got chosen.
      expect(wasmPaths.mjs).toMatch(/ort-wasm-simd-threaded\.mjs(\?.*)?$/)
      expect(wasmPaths.wasm).toMatch(/ort-wasm-simd-threaded\.wasm(\?.*)?$/)
      expect(wasmPaths.mjs).not.toContain("asyncify")
      expect(wasmPaths.wasm).not.toContain("asyncify")
    } finally {
      Reflect.deleteProperty(navigator, "vendor")
      Reflect.deleteProperty(navigator, "userAgent")
    }
  })
})
