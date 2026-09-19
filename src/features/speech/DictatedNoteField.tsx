import { useId } from "react"

import { transcribeAudio } from "@/capabilities/speech"
import {
  DictationPanels,
  DictationTrigger,
} from "@/features/speech/DictationControls"
import { type DictationNaming } from "@/features/speech/dictationState"
import {
  useDictation,
  type SpeechPrepare,
  type SpeechTranscribe,
} from "@/features/speech/useDictation"

/**
 * A free-text note that can be written or dictated. Screens that already had
 * dictation keep their own layout and compose `DictationTrigger` and
 * `DictationPanels` directly; this is for the plain labelled notes, so a field
 * gains dictation by being declared rather than by copying the panels again.
 */
export function DictatedNoteField({
  label,
  hint,
  value,
  onChange,
  naming,
  reviewHint,
  unsupportedHint,
  placeholder,
  className = "",
  textareaClassName = "min-h-24 w-full resize-y rounded-xl border bg-card px-3 py-2.5 text-base font-normal leading-6 outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30",
  transcribe = transcribeAudio,
  prepareSpeech,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  naming: DictationNaming
  reviewHint: string
  unsupportedHint: string
  placeholder?: string
  className?: string
  textareaClassName?: string
  transcribe?: SpeechTranscribe
  prepareSpeech?: SpeechPrepare
}) {
  const fieldId = useId()
  const dictation = useDictation({
    value,
    onDraft: onChange,
    onAccept: () => undefined,
    transcribe,
    prepare: prepareSpeech,
  })

  return (
    <div className={`grid min-w-0 gap-2 text-sm font-bold ${className}`}>
      {/* The label and the trigger wrap rather than widen the field: at 320px
          with 200% text they do not fit on one line, and a grid item sized by
          its content would push the whole page sideways. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <label className="min-w-0" htmlFor={fieldId}>
          {label}
        </label>
        <DictationTrigger dictation={dictation} naming={naming} />
      </div>
      <textarea
        aria-label={label}
        className={textareaClassName}
        id={fieldId}
        onChange={(event) => {
          dictation.syncValue(event.target.value)
          onChange(event.target.value)
        }}
        placeholder={placeholder}
        value={value}
      />
      {hint && (
        <span className="text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      )}
      <DictationPanels
        dictation={dictation}
        naming={naming}
        reviewHint={reviewHint}
        unsupportedHint={unsupportedHint}
      />
    </div>
  )
}
