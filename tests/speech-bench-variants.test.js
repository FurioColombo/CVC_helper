import { readFileSync } from "node:fs"
import { cwd } from "node:process"
import { resolve } from "node:path"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

const variantsSource = readFileSync(
  resolve(cwd(), "scripts/speech-bench/variants.js"),
  "utf8",
)

const productionConfig = {
  modelId: "fixture/whisper-base",
  dtype: "q8",
  generationOptions: {
    no_repeat_ngram_size: 5,
    repetition_penalty: 1.15,
    temperature: 0,
    condition_on_previous_text: false,
  },
}

function createVariantsWindow(pipelineFactory) {
  const window = {
    __productionSpeechConfig: productionConfig,
    __speechBenchPipelineFactory: pipelineFactory,
  }

  class AudioContext {
    async decodeAudioData() {
      const samples = new Float32Array([0.1])
      return {
        length: samples.length,
        numberOfChannels: 1,
        getChannelData: () => samples,
      }
    }

    async close() {}
  }

  runInNewContext(variantsSource, {
    AudioContext,
    atob: () => "x",
    window,
  })

  return window
}

describe("speech benchmark variant pipelines", () => {
  it("shares one pipeline per model/dtype group and disposes before switching", async () => {
    const pipelines = []
    const pipelineFactory = vi.fn(async () => {
      const pipeline = vi.fn().mockResolvedValue({ text: "pronto" })
      pipeline.dispose = vi.fn(async () => {})
      pipelines.push(pipeline)
      return pipeline
    })
    const window = createVariantsWindow(pipelineFactory)
    const groups = window.__getVariantGroups([
      "current",
      "currenttrim",
      "currentq4",
      "tinyguard",
    ])

    expect(
      groups.map((group) =>
        group.variants.map(({ variant, variantIndex }) => [
          variant,
          variantIndex,
        ]),
      ),
    ).toEqual([
      [
        ["current", 0],
        ["currenttrim", 1],
      ],
      [["currentq4", 2]],
      [["tinyguard", 3]],
    ])

    await window.__prepareVariant("current")
    await window.__prepareVariant("currenttrim")
    expect(pipelineFactory).toHaveBeenCalledOnce()
    expect(pipelineFactory).toHaveBeenCalledWith(
      "automatic-speech-recognition",
      productionConfig.modelId,
      { dtype: productionConfig.dtype },
    )

    await window.__runVariant("current", new Uint8Array([0]))
    const generationOptions = pipelines[0].mock.calls[0][1]
    expect(generationOptions.language).toBe("italian")
    expect(generationOptions.task).toBe("transcribe")
    for (const [key, value] of Object.entries(
      productionConfig.generationOptions,
    )) {
      expect(generationOptions[key]).toBe(value)
    }

    await window.__prepareVariant("tinyguard")
    expect(pipelineFactory).toHaveBeenCalledTimes(2)
    expect(pipelines[0].dispose).toHaveBeenCalledOnce()
    await window.__releaseVariantGroup("tinyguard")
    expect(pipelines[1].dispose).toHaveBeenCalledOnce()
  })
})
