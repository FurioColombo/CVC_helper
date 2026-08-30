import {
  ChevronLeft,
  CircleAlert,
  Plus,
  Sailboat,
  Trash2,
  Wrench,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BOAT_TYPES,
  type BoatAvailability,
  type BoatType,
} from "@/domain/config"
import {
  getBoatOperationalState,
  getDefaultBoatType,
  parseBoatNumbers,
} from "@/domain/boat"
import { validateBoatRecords } from "@/domain/invariants"
import { FaultCard } from "@/features/boats/FaultCard"
import { FaultForm } from "@/features/boats/FaultForm"
import type { CourseRecord } from "@/persistence/courses"
import {
  createBoat,
  createBoats,
  deleteBoat,
  listBoats,
  listFaults,
  setBoatAvailability,
  type BoatRecord,
  type CourseFaultRecord,
} from "@/persistence/boats"

type BoatScreen =
  | { kind: "list" }
  | { kind: "configure" }
  | { kind: "create" }
  | { kind: "detail"; boatId: string }
  | { kind: "fault"; boatId: string }

type LoadState = "loading" | "ready" | "error"

async function readValidBoatData(courseId: string) {
  const [boats, faults] = await Promise.all([
    listBoats(courseId),
    listFaults(courseId),
  ])
  if (validateBoatRecords(boats, faults).length > 0) {
    throw new Error("Persisted boat state violates invariants")
  }
  return { boats, faults }
}

function BoatPageHeader({
  title,
  onBack,
  action,
}: {
  title: string
  onBack: () => void
  action?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1">
        <button
          aria-label={`Indietro da ${title}`}
          className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 className="truncate text-2xl font-black tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  )
}

function BoatTypeField({
  value,
  onChange,
}: {
  value: BoatType | ""
  onChange: (value: BoatType) => void
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      <span>Tipo</span>
      <select
        className="h-12 min-w-0 rounded-xl border bg-card px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
        onChange={(event) => onChange(event.target.value as BoatType)}
        required
        value={value}
      >
        {!value && <option value="">Scegli tipo</option>}
        {BOAT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </label>
  )
}

function BoatEntryForm({
  course,
  multiple,
  onCancel,
  onSaved,
}: {
  course: CourseRecord
  multiple?: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const defaultType = getDefaultBoatType(course.family, course.level) ?? ""
  const [type, setType] = useState<BoatType | "">(defaultType)
  const [number, setNumber] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const numbers = useMemo(
    () =>
      multiple
        ? parseBoatNumbers(number)
        : number.trim()
          ? [number.trim()]
          : [],
    [multiple, number],
  )

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!type || numbers.length === 0) return
    setSaving(true)
    setError("")
    try {
      if (multiple) {
        await createBoats(
          course.id,
          numbers.map((boatNumber) => ({ type, number: boatNumber })),
        )
      } else {
        await createBoat(course.id, { type, number: numbers[0]! })
      }
      onSaved()
    } catch {
      setSaving(false)
      setError("Barca già presente o dati non validi.")
    }
  }

  return (
    <form className="grid gap-5" onSubmit={save}>
      <BoatTypeField onChange={setType} value={type} />
      <label className="grid gap-2 text-sm font-bold">
        <span>{multiple ? "Numeri barca" : "Numero barca"}</span>
        {multiple ? (
          <textarea
            autoFocus
            className="min-h-28 resize-y rounded-xl border bg-card px-3 py-2.5 text-base font-normal leading-6 outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
            onChange={(event) => setNumber(event.target.value)}
            placeholder="Es. 2, 7, 11"
            required
            value={number}
          />
        ) : (
          <Input
            autoFocus
            onChange={(event) => setNumber(event.target.value)}
            required
            value={number}
          />
        )}
      </label>
      {multiple && numbers.length > 0 && (
        <p className="rounded-2xl bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
          Verranno create {numbers.length} barche {type}.
        </p>
      )}
      {error && (
        <p className="text-sm font-semibold text-[#a2381b]" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onCancel} type="button" variant="secondary">
          Annulla
        </Button>
        <Button
          disabled={!type || numbers.length === 0 || saving}
          type="submit"
        >
          {saving ? "Salvataggio…" : multiple ? "Configura" : "Aggiungi"}
        </Button>
      </div>
    </form>
  )
}

const STATE_COPY = {
  clear: {
    label: "Nessuna avaria",
    dot: "bg-[#238636]",
    text: "text-[#176b2c]",
  },
  fault: {
    label: "Avaria aperta",
    dot: "bg-[#e0a31a]",
    text: "text-[#835900]",
  },
  unavailable: {
    label: "Non disponibile",
    dot: "bg-[#7b858a]",
    text: "text-muted-foreground",
  },
} as const

function BoatList({
  boats,
  faults,
  onOpen,
}: {
  boats: BoatRecord[]
  faults: CourseFaultRecord[]
  onOpen: (boatId: string) => void
}) {
  return (
    <section aria-label="Elenco barche" className="grid gap-2.5">
      {boats.map((boat) => {
        const boatFaults = faults.filter((fault) => fault.boatId === boat.id)
        const openCount = boatFaults.filter(
          ({ state }) => state !== "resolved",
        ).length
        const state = getBoatOperationalState(boat.availability, boatFaults)
        const copy = STATE_COPY[state]
        return (
          <button
            aria-label={`${boat.type} ${boat.number}, ${copy.label}${openCount ? `, ${openCount} ${openCount === 1 ? "non risolta" : "non risolte"}` : ""}`}
            className={`flex min-h-18 items-center gap-3 rounded-2xl border p-3.5 text-left shadow-[0_6px_18px_rgb(6_59_82/0.05)] outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 ${state === "unavailable" ? "bg-muted/70 text-muted-foreground" : "bg-card"}`}
            key={boat.id}
            onClick={() => onOpen(boat.id)}
            type="button"
          >
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-xl bg-muted ${state === "unavailable" ? "text-muted-foreground" : "text-primary"}`}
            >
              <Sailboat aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-black">
                {boat.type} {boat.number}
              </span>
              <span
                className={`mt-1 flex items-center gap-2 text-xs font-bold ${copy.text}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${copy.dot}`}
                />
                {copy.label}
                {openCount > 0 && ` · ${openCount}`}
              </span>
            </span>
            <ChevronLeft
              aria-hidden="true"
              className="size-4 rotate-180 text-muted-foreground"
            />
          </button>
        )
      })}
    </section>
  )
}

function EmptyBoats({ onConfigure }: { onConfigure: () => void }) {
  return (
    <section className="rounded-3xl border bg-card p-5 text-center shadow-[0_12px_32px_rgb(6_59_82/0.07)]">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e0edf1] text-primary">
        <Sailboat aria-hidden="true" className="size-7" />
      </span>
      <h2 className="mt-4 text-xl font-black">Nessuna barca</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Inserisci in una volta i numeri delle barche assegnate al corso.
      </p>
      <Button className="mt-6 w-full" onClick={onConfigure} size="lg">
        Configura barche
      </Button>
    </section>
  )
}

function BoatDetail({
  courseId,
  boat,
  faults,
  onBack,
  onAddFault,
  onRefresh,
  onDeleted,
}: {
  courseId: string
  boat: BoatRecord
  faults: CourseFaultRecord[]
  onBack: () => void
  onAddFault: () => void
  onRefresh: () => Promise<void>
  onDeleted: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState("")
  const unresolved = faults.filter(({ state }) => state !== "resolved")
  const resolved = faults.filter(({ state }) => state === "resolved")

  async function changeAvailability(availability: BoatAvailability) {
    setError("")
    try {
      await setBoatAvailability(boat.id, courseId, availability)
      await onRefresh()
    } catch {
      setError("Disponibilità non salvata. Riprova.")
    }
  }

  async function removeBoat() {
    setError("")
    try {
      await deleteBoat(boat.id, courseId)
      onDeleted()
    } catch {
      setConfirmDelete(false)
      setError(
        "La barca è già usata in uno storico e non può essere eliminata.",
      )
    }
  }

  return (
    <>
      <BoatPageHeader onBack={onBack} title={`${boat.type} ${boat.number}`} />
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-wide text-muted-foreground uppercase">
              Disponibilità
            </p>
            <p className="mt-1 text-sm font-bold">
              {boat.availability === "available"
                ? "Disponibile"
                : "Non disponibile"}
            </p>
          </div>
          <Button
            onClick={() =>
              void changeAvailability(
                boat.availability === "available" ? "unavailable" : "available",
              )
            }
            variant="secondary"
          >
            {boat.availability === "available"
              ? "Rendi indisponibile"
              : "Rendi disponibile"}
          </Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          La disponibilità è indipendente dalle avarie e non cancella lo
          storico.
        </p>
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Avarie aperte</h2>
          <Button className="h-11" onClick={onAddFault}>
            <Wrench aria-hidden="true" className="size-4" />
            Segnala
          </Button>
        </div>
        {unresolved.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Nessuna avaria non risolta.
          </p>
        ) : (
          <div className="mt-3 grid gap-2.5">
            {unresolved.map((fault) => (
              <FaultCard fault={fault} key={fault.id} onChanged={onRefresh} />
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="mt-6">
          <h2 className="text-base font-black">Storico risolte</h2>
          <div className="mt-3 grid gap-2.5">
            {resolved.map((fault) => (
              <FaultCard fault={fault} key={fault.id} onChanged={onRefresh} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-7 border-t pt-5">
        {confirmDelete ? (
          <div className="rounded-2xl border border-[#d92d20]/40 bg-[#fff1ed] p-4">
            <p className="text-sm font-bold">
              Eliminare questa barca inserita per errore?
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Verranno eliminate anche le sue avarie. Non usare questa azione
              per una barca temporaneamente indisponibile.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button
                onClick={() => setConfirmDelete(false)}
                variant="secondary"
              >
                Annulla
              </Button>
              <Button
                className="bg-[#a2381b]"
                onClick={() => void removeBoat()}
              >
                Elimina
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="w-full text-[#a2381b]"
            onClick={() => setConfirmDelete(true)}
            variant="secondary"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Elimina barca inserita per errore
          </Button>
        )}
      </section>
      {error && (
        <p
          className="mt-4 flex gap-2 text-sm font-semibold text-[#a2381b]"
          role="alert"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </>
  )
}

export function BoatManagement({
  course,
  onHome,
}: {
  course: CourseRecord
  onHome: () => void
}) {
  const [boats, setBoats] = useState<BoatRecord[]>([])
  const [faults, setFaults] = useState<CourseFaultRecord[]>([])
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [screen, setScreen] = useState<BoatScreen>({ kind: "list" })

  async function refresh() {
    try {
      const data = await readValidBoatData(course.id)
      setBoats(data.boats)
      setFaults(data.faults)
      setLoadState("ready")
    } catch {
      setLoadState("error")
    }
  }

  useEffect(() => {
    let active = true
    readValidBoatData(course.id)
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
  }, [course.id])

  const selectedBoat =
    screen.kind === "detail" || screen.kind === "fault"
      ? boats.find(({ id }) => id === screen.boatId)
      : undefined
  const selectedFaults = selectedBoat
    ? faults.filter(({ boatId }) => boatId === selectedBoat.id)
    : []

  if (loadState === "loading") {
    return (
      <p className="py-12 text-center text-sm font-semibold">
        Apertura barche…
      </p>
    )
  }
  if (loadState === "error") {
    return (
      <section className="rounded-3xl border bg-card p-5">
        <h1 className="text-xl font-black">Barche non disponibili</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Non riesco a leggere l’archivio locale.
        </p>
        <Button className="mt-5" onClick={() => void refresh()}>
          Riprova
        </Button>
      </section>
    )
  }

  if (screen.kind === "configure" || screen.kind === "create") {
    return (
      <>
        <BoatPageHeader
          onBack={() => setScreen({ kind: "list" })}
          title={
            screen.kind === "configure" ? "Configura barche" : "Nuova barca"
          }
        />
        <BoatEntryForm
          course={course}
          multiple={screen.kind === "configure"}
          onCancel={() => setScreen({ kind: "list" })}
          onSaved={() => {
            void refresh()
            setScreen({ kind: "list" })
          }}
        />
      </>
    )
  }

  if (screen.kind === "fault" && selectedBoat) {
    return (
      <>
        <BoatPageHeader
          onBack={() => setScreen({ kind: "detail", boatId: selectedBoat.id })}
          title="Nuova avaria"
        />
        <p className="mb-4 text-sm font-bold text-primary">
          {selectedBoat.type} {selectedBoat.number}
        </p>
        <FaultForm
          boats={[selectedBoat]}
          fixedBoatId={selectedBoat.id}
          onCancel={() =>
            setScreen({ kind: "detail", boatId: selectedBoat.id })
          }
          onSaved={() => {
            void refresh()
            setScreen({ kind: "detail", boatId: selectedBoat.id })
          }}
        />
      </>
    )
  }

  if (screen.kind === "detail" && selectedBoat) {
    return (
      <BoatDetail
        boat={selectedBoat}
        courseId={course.id}
        faults={selectedFaults}
        onAddFault={() => setScreen({ kind: "fault", boatId: selectedBoat.id })}
        onBack={() => setScreen({ kind: "list" })}
        onDeleted={() => {
          void refresh()
          setScreen({ kind: "list" })
        }}
        onRefresh={refresh}
      />
    )
  }

  return (
    <>
      <BoatPageHeader
        action={
          boats.length > 0 ? (
            <Button
              aria-label="Aggiungi barca"
              className="size-11 px-0"
              onClick={() => setScreen({ kind: "create" })}
            >
              <Plus aria-hidden="true" className="size-5" />
            </Button>
          ) : undefined
        }
        onBack={onHome}
        title="Barche"
      />
      {boats.length === 0 ? (
        <EmptyBoats onConfigure={() => setScreen({ kind: "configure" })} />
      ) : (
        <BoatList
          boats={boats}
          faults={faults}
          onOpen={(boatId) => setScreen({ kind: "detail", boatId })}
        />
      )}
    </>
  )
}
