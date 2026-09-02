import { ChevronLeft, Plus, Wrench } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { validateBoatRecords } from "@/domain/invariants"
import { FaultCard } from "@/features/boats/FaultCard"
import { FaultForm } from "@/features/boats/FaultForm"
import {
  listBoats,
  listFaults,
  type BoatRecord,
  type CourseFaultRecord,
} from "@/persistence/boats"

async function readValidFaultData(courseId: string) {
  const [boats, faults] = await Promise.all([
    listBoats(courseId),
    listFaults(courseId),
  ])
  if (validateBoatRecords(boats, faults).length > 0) {
    throw new Error("Persisted fault state violates invariants")
  }
  return { boats, faults }
}

export function FaultManagement({
  courseId,
  onHome,
  onOpenBoats,
}: {
  courseId: string
  onHome: () => void
  onOpenBoats: () => void
}) {
  const [boats, setBoats] = useState<BoatRecord[]>([])
  const [faults, setFaults] = useState<CourseFaultRecord[]>([])
  const [screen, setScreen] = useState<"list" | "create">("list")
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )

  async function refresh() {
    try {
      const data = await readValidFaultData(courseId)
      setBoats(data.boats)
      setFaults(data.faults)
      setLoadState("ready")
    } catch {
      setLoadState("error")
    }
  }

  useEffect(() => {
    let active = true
    readValidFaultData(courseId)
      .then((data) => {
        if (!active) return
        setBoats(data.boats)
        setFaults(data.faults)
        setLoadState("ready")
      })
      .catch(() => {
        if (active) setLoadState("error")
      })
    return () => {
      active = false
    }
  }, [courseId])

  if (loadState === "loading") {
    return (
      <p className="py-12 text-center text-sm font-semibold">
        Apertura avarie…
      </p>
    )
  }
  if (loadState === "error") {
    return (
      <section className="rounded-3xl border bg-card p-5">
        <h1 className="text-xl font-black">Avarie non disponibili</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Non riesco a leggere l’archivio locale.
        </p>
        <Button className="mt-5" onClick={() => void refresh()}>
          Riprova
        </Button>
      </section>
    )
  }

  if (screen === "create") {
    return (
      <>
        <div className="mb-5 flex items-center gap-1">
          <button
            aria-label="Indietro da Nuova avaria"
            className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            onClick={() => setScreen("list")}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <h1 className="text-2xl font-black tracking-tight">Nuova avaria</h1>
        </div>
        <FaultForm
          boats={boats}
          onCancel={() => setScreen("list")}
          onSaved={async () => {
            await refresh()
            setScreen("list")
          }}
        />
      </>
    )
  }

  const unresolved = faults.filter(({ state }) => state !== "resolved")
  const resolved = faults.filter(({ state }) => state === "resolved")

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <button
            aria-label="Indietro da Avarie"
            className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            onClick={onHome}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <h1 className="text-2xl font-black tracking-tight">Avarie</h1>
        </div>
        {boats.length > 0 && faults.length > 0 && (
          <Button
            aria-label="Segnala avaria"
            className="size-11 px-0"
            onClick={() => setScreen("create")}
          >
            <Plus aria-hidden="true" className="size-5" />
          </Button>
        )}
      </div>

      {boats.length === 0 ? (
        <section className="rounded-3xl border bg-card p-5 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff1d6] text-[#9a5b00]">
            <Wrench aria-hidden="true" className="size-7" />
          </span>
          <h2 className="mt-4 text-xl font-black">Prima configura le barche</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ogni avaria deve essere associata a una barca del corso.
          </p>
          <Button className="mt-6 w-full" onClick={onOpenBoats} size="lg">
            Configura barche
          </Button>
        </section>
      ) : faults.length === 0 ? (
        <section className="rounded-3xl border bg-card p-5 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e9f5eb] text-[#176b2c]">
            <Wrench aria-hidden="true" className="size-7" />
          </span>
          <h2 className="mt-4 text-xl font-black">Nessuna avaria</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tutte le barche risultano senza segnalazioni.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => setScreen("create")}
            size="lg"
          >
            Segnala avaria
          </Button>
        </section>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-black">
              Da gestire · {unresolved.length}
            </h2>
            {unresolved.length === 0 ? (
              <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                Nessuna avaria non risolta.
              </p>
            ) : (
              <div className="mt-3 grid gap-2.5">
                {unresolved.map((fault) => (
                  <FaultCard
                    boatLabel={`${fault.boatType} ${fault.boatNumber}`}
                    fault={fault}
                    key={fault.id}
                    onChanged={refresh}
                  />
                ))}
              </div>
            )}
          </section>
          {resolved.length > 0 && (
            <section className="mt-6">
              <h2 className="text-base font-black">Storico risolte</h2>
              <div className="mt-3 grid gap-2.5">
                {resolved.map((fault) => (
                  <FaultCard
                    boatLabel={`${fault.boatType} ${fault.boatNumber}`}
                    fault={fault}
                    key={fault.id}
                    onChanged={refresh}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}
