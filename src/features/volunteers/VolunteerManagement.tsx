import { ChevronLeft, HandHeart, Pencil, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VolunteerRoleBadge } from "@/components/PersonBadges"
import { VOLUNTEER_ROLES, type VolunteerRole } from "@/domain/config"
import { validateVolunteerRecords } from "@/domain/invariants"
import {
  createVolunteer,
  listVolunteers,
  updateVolunteer,
  type VolunteerInput,
  type VolunteerRecord,
} from "@/persistence/volunteers"

type VolunteerScreen =
  { kind: "list" } | { kind: "create" } | { kind: "edit"; volunteerId: string }

type LoadState = "loading" | "ready" | "error"

async function readValidVolunteers(courseId: string) {
  const records = await listVolunteers(courseId)
  if (validateVolunteerRecords(records).length > 0) {
    throw new Error("Persisted volunteer state violates invariants")
  }
  return records
}

function VolunteerPageHeader({
  title,
  onBack,
  action,
}: {
  title: string
  onBack: () => void
  action?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1 max-[380px]:basis-full max-[380px]:flex-wrap">
        <button
          aria-label={`Indietro da ${title}`}
          className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 className="truncate text-2xl font-black tracking-tight max-[380px]:basis-full max-[380px]:whitespace-normal">
          {title}
        </h1>
      </div>
      {action}
    </div>
  )
}

function VolunteerRoleChoice({
  role,
  onChange,
}: {
  role: VolunteerRole
  onChange: (role: VolunteerRole) => void
}) {
  return (
    <fieldset className="grid gap-2 text-sm font-bold">
      <legend>Ruolo</legend>
      <div className="grid grid-cols-3 gap-2">
        {VOLUNTEER_ROLES.map((option) => (
          <label className="cursor-pointer" key={option}>
            <input
              checked={role === option}
              className="peer sr-only"
              name="volunteer-role"
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            <span className="grid h-12 place-items-center rounded-xl border bg-card text-base font-black transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40">
              {option}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function VolunteerForm({
  courseId,
  volunteer,
  onCancel,
  onSaved,
}: {
  courseId: string
  volunteer?: VolunteerRecord
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(volunteer?.name ?? "")
  const [role, setRole] = useState<VolunteerRole>(volunteer?.role ?? "ADV")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    setSaving(true)
    setError(false)
    const input: VolunteerInput = { name: trimmedName, role }
    try {
      if (volunteer) {
        await updateVolunteer(volunteer.id, courseId, input)
      } else {
        await createVolunteer(courseId, input)
      }
      onSaved()
    } catch {
      setSaving(false)
      setError(true)
    }
  }

  return (
    <form className="grid gap-5" onSubmit={save}>
      <label className="grid gap-2 text-sm font-bold">
        <span>Nome completo</span>
        <Input
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </label>

      <VolunteerRoleChoice onChange={setRole} role={role} />

      {error && (
        <p className="text-sm font-semibold text-[#a2381b]" role="alert">
          La modifica non è stata salvata. Riprova.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 max-[380px]:grid-cols-1">
        <Button
          className="max-[380px]:h-auto max-[380px]:py-3"
          onClick={onCancel}
          type="button"
          variant="secondary"
        >
          Annulla
        </Button>
        <Button
          className="max-[380px]:h-auto max-[380px]:py-3"
          disabled={!name.trim() || saving}
          type="submit"
        >
          {saving ? "Salvataggio…" : "Salva volontario"}
        </Button>
      </div>
    </form>
  )
}

function EmptyVolunteers({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="rounded-3xl border bg-card p-5 text-center shadow-[0_12px_32px_rgb(6_59_82/0.07)]">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff1d6] text-[#9a5b00]">
        <HandHeart aria-hidden="true" className="size-7" />
      </span>
      <h2 className="mt-4 text-xl font-black">Nessun volontario</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Aggiungi chi può salire negli equipaggi del corso.
      </p>
      <Button className="mt-6 w-full" onClick={onAdd} size="lg">
        <Plus aria-hidden="true" className="size-5" />
        Aggiungi volontario
      </Button>
    </section>
  )
}

function VolunteerList({
  volunteers,
  onOpen,
}: {
  volunteers: VolunteerRecord[]
  onOpen: (volunteerId: string) => void
}) {
  return (
    <section aria-label="Elenco volontari" className="grid gap-2.5">
      {volunteers.map((volunteer) => (
        <button
          aria-label={`${volunteer.name}, ruolo ${volunteer.role}`}
          className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-3 py-2 text-left shadow-[0_6px_18px_rgb(6_59_82/0.05)] outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
          key={volunteer.id}
          onClick={() => onOpen(volunteer.id)}
          type="button"
        >
          {/* The role is the identity: ADV, IS or CT in place of one icon that
              said "volunteer" three times over. */}
          <VolunteerRoleBadge
            className="size-11 text-sm"
            role={volunteer.role}
          />
          <span className="min-w-0 flex-1 truncate text-base font-bold">
            {volunteer.name}
          </span>
          <Pencil aria-hidden="true" className="size-4 text-muted-foreground" />
        </button>
      ))}
    </section>
  )
}

export function VolunteerManagement({
  courseId,
  onHome,
}: {
  courseId: string
  onHome: () => void
}) {
  const [volunteers, setVolunteers] = useState<VolunteerRecord[]>([])
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [screen, setScreen] = useState<VolunteerScreen>({ kind: "list" })

  async function refreshVolunteers() {
    try {
      setVolunteers(await readValidVolunteers(courseId))
      setLoadState("ready")
    } catch {
      setLoadState("error")
    }
  }

  useEffect(() => {
    let active = true
    readValidVolunteers(courseId)
      .then((records) => {
        if (!active) return
        setVolunteers(records)
        setLoadState("ready")
      })
      .catch(() => {
        if (active) setLoadState("error")
      })
    return () => {
      active = false
    }
  }, [courseId])

  const selectedVolunteer = useMemo(() => {
    if (screen.kind !== "edit") return undefined
    return volunteers.find(({ id }) => id === screen.volunteerId)
  }, [screen, volunteers])

  if (loadState === "loading") {
    return (
      <p className="py-12 text-center text-sm font-semibold">
        Apertura volontari…
      </p>
    )
  }

  if (loadState === "error") {
    return (
      <section className="rounded-3xl border bg-card p-5">
        <h1 className="text-xl font-black">Volontari non disponibili</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Non riesco a leggere l’archivio locale.
        </p>
        <Button className="mt-5" onClick={refreshVolunteers}>
          Riprova
        </Button>
      </section>
    )
  }

  if (screen.kind === "create") {
    return (
      <>
        <VolunteerPageHeader
          onBack={() => setScreen({ kind: "list" })}
          title="Nuovo volontario"
        />
        <VolunteerForm
          courseId={courseId}
          onCancel={() => setScreen({ kind: "list" })}
          onSaved={() => {
            void refreshVolunteers()
            setScreen({ kind: "list" })
          }}
        />
      </>
    )
  }

  if (screen.kind === "edit" && selectedVolunteer) {
    return (
      <>
        <VolunteerPageHeader
          onBack={() => setScreen({ kind: "list" })}
          title="Modifica volontario"
        />
        <VolunteerForm
          courseId={courseId}
          key={selectedVolunteer.id}
          onCancel={() => setScreen({ kind: "list" })}
          onSaved={() => {
            void refreshVolunteers()
            setScreen({ kind: "list" })
          }}
          volunteer={selectedVolunteer}
        />
      </>
    )
  }

  return (
    <>
      <VolunteerPageHeader
        action={
          volunteers.length > 0 ? (
            <Button
              aria-label="Aggiungi volontario"
              className="size-11 px-0"
              onClick={() => setScreen({ kind: "create" })}
            >
              <Plus aria-hidden="true" className="size-5" />
            </Button>
          ) : undefined
        }
        onBack={onHome}
        title="Volontari"
      />
      {volunteers.length === 0 ? (
        <EmptyVolunteers onAdd={() => setScreen({ kind: "create" })} />
      ) : (
        <VolunteerList
          onOpen={(volunteerId) => setScreen({ kind: "edit", volunteerId })}
          volunteers={volunteers}
        />
      )}
    </>
  )
}
