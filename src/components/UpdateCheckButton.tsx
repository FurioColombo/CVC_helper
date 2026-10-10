import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { UpdateCheck } from "@/navigation/updateChecks"
import { useUpdates } from "@/navigation/updates"

const RESULT: Record<UpdateCheck, string> = {
  offered: "È pronta una nuova versione.",
  none: "Questa è l’ultima versione.",
  offline: "Sei offline: cerca di nuovo quando c’è rete.",
  failed: "Non riesco a cercare ora. Riprova più tardi.",
}

/**
 * Looks for a new version on request (D3), and applies one that is ready.
 * A check that finds one leaves it to the service worker; once it is ready
 * the same button becomes `Aggiorna` and goes through the leave guard.
 */
export function UpdateCheckButton({
  label = "Cerca aggiornamenti",
  className,
}: {
  label?: string
  className?: string
}) {
  const { offered, apply, check } = useUpdates()
  const [state, setState] = useState<UpdateCheck | "checking" | null>(null)

  if (offered) {
    return (
      <div className={className}>
        <Button className="w-full" onClick={apply}>
          Aggiorna alla nuova versione
        </Button>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {RESULT.offered}
        </p>
      </div>
    )
  }
  return (
    <div className={className}>
      <Button
        className="w-full"
        disabled={state === "checking"}
        onClick={async () => {
          setState("checking")
          setState(await check())
        }}
        variant="secondary"
      >
        {label}
      </Button>
      <p
        aria-live="polite"
        className="mt-2 min-h-5 text-sm leading-5 text-muted-foreground"
      >
        {state === "checking" ? "Ricerca in corso…" : state && RESULT[state]}
      </p>
    </div>
  )
}
