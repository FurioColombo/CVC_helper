import { beforeEach, describe, expect, it, vi } from "vitest"

const { pipelineMock } = vi.hoisted(() => ({ pipelineMock: vi.fn() }))

vi.mock("@huggingface/transformers", () => ({ pipeline: pipelineMock }))

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
})
