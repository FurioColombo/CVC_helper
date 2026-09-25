;(() => {
  const SAMPLE_RATE = 16000
  const production = window.__productionSpeechConfig
  if (!production) throw new Error("production speech config was not provided")

  let activePipeline
  let activeGroupKey

  function groupKey(spec) {
    return `${spec.model}|${spec.dtype}`
  }

  const SPECS = {
    current: {
      model: production.modelId,
      dtype: production.dtype,
      dsp: [],
      gen: production.generationOptions,
    },
    currenttrim: {
      model: production.modelId,
      dtype: production.dtype,
      dsp: ["trim"],
      gen: production.generationOptions,
    },
    currentdsp: {
      model: production.modelId,
      dtype: production.dtype,
      dsp: ["dc", "highpass", "normalize", "trim"],
      gen: production.generationOptions,
    },
    currentq4: {
      model: production.modelId,
      dtype: "q4",
      dsp: [],
      gen: production.generationOptions,
    },
    tinyguard: {
      model: "onnx-community/whisper-tiny",
      dtype: "q8",
      dsp: [],
      gen: production.generationOptions,
    },
    currentchunked: {
      model: production.modelId,
      dtype: production.dtype,
      dsp: [],
      gen: {
        ...production.generationOptions,
        chunk_length_s: 8,
        stride_length_s: 2,
      },
    },
    baseline: { model: "onnx-community/whisper-tiny", dtype: "q8", dsp: [] },
    dsp: {
      model: "onnx-community/whisper-tiny",
      dtype: "q8",
      dsp: ["dc", "highpass", "normalize", "trim"],
    },
    hp: {
      model: "onnx-community/whisper-tiny",
      dtype: "q8",
      dsp: ["dc", "highpass"],
    },
    norm: {
      model: "onnx-community/whisper-tiny",
      dtype: "q8",
      dsp: ["dc", "normalize"],
    },
    base: { model: "onnx-community/whisper-base", dtype: "q8", dsp: [] },
    guard: {
      model: "onnx-community/whisper-tiny",
      dtype: "q8",
      dsp: [],
      gen: production.generationOptions,
    },
    dspguard: {
      model: "onnx-community/whisper-tiny",
      dtype: "q8",
      dsp: ["dc", "highpass", "normalize", "trim"],
      gen: production.generationOptions,
    },
    baseguard: {
      model: "onnx-community/whisper-base",
      dtype: "q8",
      dsp: ["dc", "normalize", "trim"],
      gen: production.generationOptions,
    },
    dspbase: {
      model: "onnx-community/whisper-base",
      dtype: "q8",
      dsp: ["dc", "highpass", "normalize", "trim"],
    },
  }

  async function transformers() {
    if (window.__speechBenchPipelineFactory) {
      return { pipeline: window.__speechBenchPipelineFactory }
    }
    const direct = "/node_modules/.vite/deps/@huggingface_transformers.js"
    try {
      return await import(direct)
    } catch {
      const found = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((n) => n.includes("@huggingface_transformers"))
      if (!found) throw new Error("transformers module not found")
      return await import(found)
    }
  }

  function removeDc(input) {
    let mean = 0
    for (const v of input) mean += v
    mean /= input.length || 1
    const out = new Float32Array(input.length)
    for (let i = 0; i < input.length; i += 1) out[i] = input[i] - mean
    return out
  }

  /** One-pole high pass at 80 Hz: removes handling rumble and wind body. */
  function highPass(input, cutoff = 80) {
    const rc = 1 / (2 * Math.PI * cutoff)
    const dt = 1 / SAMPLE_RATE
    const a = rc / (rc + dt)
    const out = new Float32Array(input.length)
    let prevIn = input[0] ?? 0
    let prevOut = 0
    for (let i = 0; i < input.length; i += 1) {
      prevOut = a * (prevOut + input[i] - prevIn)
      prevIn = input[i]
      out[i] = prevOut
    }
    return out
  }

  /** Bring quiet recordings up to a consistent level without clipping. */
  function normalize(input, target = 0.08, maxGain = 12) {
    let sum = 0
    for (const v of input) sum += v * v
    const rms = Math.sqrt(sum / (input.length || 1))
    if (rms < 1e-6) return input
    let peak = 0
    for (const v of input) peak = Math.max(peak, Math.abs(v))
    const gain = Math.min(
      maxGain,
      target / rms,
      peak > 0 ? 0.97 / peak : maxGain,
    )
    if (!Number.isFinite(gain) || gain <= 0) return input
    const out = new Float32Array(input.length)
    for (let i = 0; i < input.length; i += 1) out[i] = input[i] * gain
    return out
  }

  /** Drop leading and trailing silence so the model spends its window on speech. */
  function trim(input) {
    const frame = Math.round(0.02 * SAMPLE_RATE)
    let peak = 0
    for (const v of input) peak = Math.max(peak, Math.abs(v))
    const floor = peak * 0.02
    let first = -1
    let last = -1
    for (let start = 0; start < input.length; start += frame) {
      let energy = 0
      const end = Math.min(input.length, start + frame)
      for (let i = start; i < end; i += 1)
        energy = Math.max(energy, Math.abs(input[i]))
      if (energy > floor) {
        if (first < 0) first = start
        last = end
      }
    }
    if (first < 0 || last <= first) return input
    const pad = Math.round(0.1 * SAMPLE_RATE)
    return input.slice(
      Math.max(0, first - pad),
      Math.min(input.length, last + pad),
    )
  }

  const STAGES = { dc: removeDc, highpass: highPass, normalize, trim }

  async function decode(audioBytes) {
    const bytes = new Uint8Array(audioBytes)
    const context = new AudioContext({ sampleRate: SAMPLE_RATE })
    try {
      const buffer = await context.decodeAudioData(bytes.buffer)
      const mono = new Float32Array(buffer.length)
      for (let c = 0; c < buffer.numberOfChannels; c += 1) {
        const data = buffer.getChannelData(c)
        for (let i = 0; i < buffer.length; i += 1) {
          mono[i] += data[i] / buffer.numberOfChannels
        }
      }
      return mono
    } finally {
      await context.close()
    }
  }

  async function disposeActivePipeline() {
    if (!activePipeline) return
    const previous = activePipeline
    try {
      await previous.dispose?.()
    } finally {
      activePipeline = undefined
      activeGroupKey = undefined
    }
  }

  window.__getVariantGroups = (names) => {
    const groups = new Map()
    names.forEach((name, variantIndex) => {
      const spec = SPECS[name]
      if (!spec) throw new Error(`unknown variant ${name}`)
      const key = groupKey(spec)
      let group = groups.get(key)
      if (!group) {
        group = { key, variants: [] }
        groups.set(key, group)
      }
      group.variants.push({ variant: name, variantIndex })
    })
    return [...groups.values()]
  }

  window.__prepareVariant = async (name) => {
    const spec = SPECS[name]
    if (!spec) throw new Error(`unknown variant ${name}`)
    const key = groupKey(spec)
    if (activePipeline && activeGroupKey === key) return true
    await disposeActivePipeline()
    const { pipeline } = await transformers()
    activePipeline = await pipeline(
      "automatic-speech-recognition",
      spec.model,
      { dtype: spec.dtype },
    )
    activeGroupKey = key
    return true
  }

  window.__releaseVariantGroup = async (name) => {
    const spec = SPECS[name]
    if (!spec) throw new Error(`unknown variant ${name}`)
    if (activeGroupKey === groupKey(spec)) await disposeActivePipeline()
  }

  window.__runVariant = async (name, audioBytes) => {
    const spec = SPECS[name]
    if (!spec) throw new Error(`unknown variant ${name}`)
    if (!activePipeline || activeGroupKey !== groupKey(spec)) {
      throw new Error(`variant group is not active: ${name}`)
    }
    let audio = await decode(audioBytes)
    for (const stage of spec.dsp) audio = STAGES[stage](audio)
    const result = await activePipeline(audio, {
      language: "italian",
      task: "transcribe",
      ...(spec.gen ?? {}),
    })
    return (result?.text ?? "").trim()
  }
})()
