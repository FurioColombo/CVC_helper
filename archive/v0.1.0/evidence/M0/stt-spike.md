# M0 local Italian STT spike

## Scope

The spike transcribed a 3.48-second Italian note generated with the macOS Alice
voice at 16 kHz:

> Mario ha buona sensibilità al timone ma deve anticipare le manovre.

Inference ran locally through Transformers.js 4.2.0 with quantized ONNX Whisper
models after the model files were cached.

## Approaches evaluated

1. Browser `SpeechRecognition`: present in pinned Chromium, but its processing
   location/offline behavior is not guaranteed and therefore does not satisfy
   the required local implementation contract.
2. Transformers.js with multilingual `onnx-community/whisper-tiny`, q8.
3. Transformers.js with multilingual `onnx-community/whisper-base`, q8.
4. A custom whisper.cpp/WASM build was considered but rejected because it adds
   a separate build/runtime toolchain without a demonstrated accuracy advantage
   for this MVP.

## Result

- Tiny: cached load 437 ms, inference 389 ms. It retained the subject and much
  of the intent but made several word errors.
- Base: first load 3318 ms, inference 514 ms. Accuracy improved only modestly on
  the synthetic sample and did not justify the larger model for MVP.
- Results: `stt-spike-result.json` and `stt-spike-base-result.json`.

## Decision

Use quantized multilingual Whisper-tiny through a provider-independent local
transcription capability when voice is integrated into the M3 note, M6 fault,
and M12 evaluation contexts. Italian must be set explicitly. The transcript is
always presented as editable draft text and audio is discarded. Keep the model
out of the M0 production bundle.

## Known limitations

- The synthetic voice is only a feasibility baseline; outdoor noise, phone
  microphones, accents, model download/cache behavior, and target-phone memory
  need browser/device evidence when speech input is integrated.
- Accuracy is not sufficient for silent auto-commit. Editable review is a
  functional requirement, not optional polish.
- If target-phone evidence is inadequate, the provider boundary permits a
  changed local engine without changing domain or UI semantics.
