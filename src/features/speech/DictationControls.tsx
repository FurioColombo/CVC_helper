import {
  Check,
  LoaderCircle,
  Mic,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  dictationProgressSuffix as progressSuffix,
  isDictationBusy,
  type Dictation,
  type DictationNaming,
} from "@/features/speech/dictationState"
import { DictationMeter } from "@/features/speech/DictationMeter"

/**
 * The start/stop control and the live level, for the row that labels the
 * field. The caller keeps its own row so each screen can place this where its
 * layout already puts an action.
 */
export function DictationTrigger({
  dictation,
  naming,
  className = "",
}: {
  dictation: Dictation
  naming: DictationNaming
  className?: string
}) {
  const recording = dictation.status === "recording"
  const busy = isDictationBusy(dictation)
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      {recording && (
        <DictationMeter
          className="text-[#b42318]"
          stream={dictation.mediaStream}
        />
      )}
      <Button
        aria-label={
          recording ? `Termina dettatura ${naming.subject}` : naming.start
        }
        className={`h-11 shrink-0 px-3 text-xs ${recording ? "border-[#d92d20] text-[#b42318]" : ""}`}
        disabled={!dictation.supported || busy || dictation.status === "review"}
        onClick={() => (recording ? dictation.stop() : void dictation.start())}
        type="button"
        variant="secondary"
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : recording ? (
          <Square aria-hidden="true" className="size-3.5 fill-current" />
        ) : (
          <Mic aria-hidden="true" className="size-4" />
        )}
        {recording
          ? "Termina"
          : dictation.status === "permission"
            ? "Permesso…"
            : dictation.status === "loading"
              ? `Caricamento${progressSuffix(dictation)}`
              : dictation.status === "processing"
                ? "Elaborazione…"
                : "Detta"}
      </Button>
    </span>
  )
}

/**
 * Everything dictation shows below the field: the note when the browser cannot
 * record, the live status with its cancel, the transcript review, and the
 * failure with its retry. `reviewHint` and `unsupportedHint` stay with the
 * caller because what happens to the text on accept differs by screen.
 */
export function DictationPanels({
  dictation,
  naming,
  reviewHint,
  unsupportedHint,
  className = "",
}: {
  dictation: Dictation
  naming: DictationNaming
  reviewHint: string
  unsupportedHint: string
  className?: string
}) {
  const showStatus =
    isDictationBusy(dictation) || dictation.status === "recording"
  return (
    <>
      {!dictation.supported && dictation.status === "idle" && (
        <p className={`text-xs text-muted-foreground ${className}`}>
          {unsupportedHint}
        </p>
      )}

      {showStatus && (
        <div
          aria-live="polite"
          className={`flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2 ${className}`}
          role="status"
        >
          <p className="text-xs font-semibold text-muted-foreground">
            {dictation.status === "permission"
              ? "Attendo il permesso del microfono…"
              : dictation.status === "recording"
                ? "Registrazione in corso"
                : dictation.status === "loading"
                  ? `Caricamento del modello vocale${progressSuffix(dictation)}…`
                  : "Elaborazione locale dell’audio…"}
          </p>
          <Button
            aria-label={`Annulla dettatura ${naming.subject}`}
            className="size-10 shrink-0 p-0"
            onClick={dictation.cancel}
            type="button"
            variant="secondary"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}

      {dictation.status === "review" && (
        <div
          className={`rounded-xl border border-primary/30 bg-primary/5 p-3 ${className}`}
        >
          <p className="text-xs leading-5 text-muted-foreground">
            {reviewHint}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              aria-label={`Scarta trascrizione ${naming.subject}`}
              onClick={dictation.cancel}
              type="button"
              variant="secondary"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Scarta
            </Button>
            <Button
              aria-label={`Usa trascrizione ${naming.subject}`}
              onClick={dictation.accept}
              type="button"
            >
              <Check aria-hidden="true" className="size-4" />
              Usa testo
            </Button>
          </div>
        </div>
      )}

      {dictation.status === "error" && (
        <div
          className={`flex items-start justify-between gap-3 ${className}`}
          role="alert"
        >
          <p className="text-xs font-semibold text-[#b42318]">
            {dictation.error === "permission"
              ? "Permesso microfono non concesso. Il testo è rimasto invariato."
              : "Dettatura non riuscita. Il testo è rimasto invariato."}
          </p>
          {dictation.supported && (
            <Button
              aria-label={`Riprovare dettatura ${naming.subject}`}
              className="h-10 shrink-0 px-3 text-xs"
              onClick={() => void dictation.start()}
              type="button"
              variant="secondary"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Riprova
            </Button>
          )}
        </div>
      )}
    </>
  )
}
