import { Database, Sailboat } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  incrementPersistenceProbe,
  readPersistenceProbe,
} from "@/persistence/probe"

type StorageState =
  | { status: "loading" }
  | { status: "ready"; count: number }
  | { status: "error" }

export function App() {
  const [storage, setStorage] = useState<StorageState>({ status: "loading" })

  useEffect(() => {
    let active = true
    readPersistenceProbe()
      .then((count) => {
        if (active) setStorage({ status: "ready", count })
      })
      .catch(() => {
        if (active) setStorage({ status: "error" })
      })
    return () => {
      active = false
    }
  }, [])

  async function runPersistenceCheck() {
    try {
      const count = await incrementPersistenceProbe()
      setStorage({ status: "ready", count })
    } catch {
      setStorage({ status: "error" })
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8 sm:py-12">
      <div className="mb-8 flex items-center gap-3 text-primary">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Sailboat aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase">
            Caprera · modalità locale
          </p>
          <h1 className="text-2xl font-black tracking-tight">CVC Helper</h1>
        </div>
      </div>

      <section className="rounded-3xl border bg-card p-6 shadow-[0_18px_50px_rgb(6_59_82/0.08)]">
        <p className="mb-2 text-xs font-bold tracking-[0.16em] text-[#c34b27] uppercase">
          Fondazione applicativa
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          Pronta per il primo corso
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          La base offline è attiva. La creazione del corso sarà aggiunta nel
          prossimo traguardo.
        </p>

        <div
          aria-live="polite"
          className="mt-6 flex min-h-16 items-center gap-3 rounded-2xl bg-muted px-4 py-3"
        >
          <Database
            aria-hidden="true"
            className="size-5 shrink-0 text-primary"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {storage.status === "loading" && "Verifica archivio locale…"}
              {storage.status === "ready" && "Archivio locale pronto"}
              {storage.status === "error" && "Archivio locale non disponibile"}
            </p>
            {storage.status === "ready" && (
              <p className="text-xs text-muted-foreground">
                Verifiche persistenti: {storage.count}
              </p>
            )}
          </div>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={storage.status !== "ready"}
          onClick={runPersistenceCheck}
          size="lg"
        >
          Verifica persistenza
        </Button>
      </section>

      <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
        I dati operativi restano su questo dispositivo.
      </p>
    </main>
  )
}
