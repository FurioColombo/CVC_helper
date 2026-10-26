import { CloudUpload, TriangleAlert } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"

import { backupConfig } from "@/backup/config"
import {
  backupState,
  type BackupState,
  onBackupState,
  sendSignInLink,
  setBackupState,
  signOutOfBackup,
  startBackup,
} from "@/backup/session"
import { Button } from "@/components/ui/button"
import {
  databaseConnected,
  onDatabaseStatus,
  pendingUploads,
} from "@/persistence/backupLink"

/**
 * B3: the online backup in Impostazioni. Absent when the build has no backup
 * (the regular app until production exists). Signed out, one email field and
 * one action; signed in, the account, what is still to send, and sign-out,
 * which keeps the course on the device.
 */
export function OnlineBackup() {
  const configured = backupConfig() !== null
  const [state, setState] = useState<BackupState>(backupState)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => onBackupState(setState), [])
  if (!configured || state.kind === "unavailable") return null

  const run = async (action: () => Promise<BackupState>) => {
    setBusy(true)
    try {
      setBackupState(await action())
    } catch {
      setBackupState({
        kind: "error",
        message: "Backup non raggiungibile. Riprova con la connessione.",
      })
    } finally {
      setBusy(false)
    }
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    if (email.trim()) void run(() => sendSignInLink(email.trim()))
  }

  return (
    <section
      aria-labelledby="online-backup-title"
      className="mt-6 border-t pt-5"
    >
      <h2
        className="flex items-center gap-2 text-sm font-bold text-primary"
        id="online-backup-title"
      >
        <CloudUpload aria-hidden="true" className="size-4 shrink-0" />
        Backup online
      </h2>
      {state.kind === "signed-out" && (
        <form className="mt-2" onSubmit={send}>
          <p className="text-sm leading-5 text-muted-foreground">
            Accedi con la tua email per copiare il corso online e ritrovarlo su
            un altro telefono. Senza accesso l’app funziona come sempre, solo su
            questo telefono.
          </p>
          <label
            className="mt-3 block text-sm font-semibold"
            htmlFor="backup-email"
          >
            Email
          </label>
          <input
            autoComplete="email"
            className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 text-base"
            id="backup-email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <Button className="mt-3" disabled={busy} type="submit">
            Invia il link di accesso
          </Button>
        </form>
      )}
      {state.kind === "link-sent" && (
        <div className="mt-2" role="status">
          <p className="text-sm leading-5">
            Link inviato a{" "}
            <span className="font-bold [overflow-wrap:anywhere]">
              {state.email}
            </span>
            . Aprilo su questo telefono per accedere.
          </p>
          <Button
            className="mt-3"
            onClick={() => setBackupState({ kind: "signed-out" })}
            variant="secondary"
          >
            Usa un’altra email
          </Button>
        </div>
      )}
      {state.kind === "connected" && (
        <Connected
          busy={busy}
          email={state.email}
          onSignOut={() => void run(signOutOfBackup)}
        />
      )}
      {state.kind === "reopen" && (
        <div className="mt-2" role="status">
          <p className="text-sm leading-5">
            Backup attivato. Riapri l’app per continuare.
          </p>
          <Button className="mt-3" onClick={() => window.location.reload()}>
            Riapri l’app
          </Button>
        </div>
      )}
      {state.kind === "other-course" && (
        <Notice>
          Questo account ha già un altro corso online. Il corso di questo
          telefono resta solo qui.
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() => void run(signOutOfBackup)}
            variant="secondary"
          >
            Esci dall’account
          </Button>
        </Notice>
      )}
      {state.kind === "error" && (
        <Notice>
          {state.message}
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() => void run(startBackup)}
            variant="secondary"
          >
            Riprova
          </Button>
        </Notice>
      )}
    </section>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex gap-2 text-sm leading-5" role="alert">
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-[#b45309]"
      />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Connected({
  email,
  busy,
  onSignOut,
}: {
  email: string
  busy: boolean
  onSignOut: () => void
}) {
  const [line, setLine] = useState("Verifica della copia online…")

  useEffect(() => {
    let active = true
    const refresh = async () => {
      const waiting = await pendingUploads()
      const connected = databaseConnected()
      if (!active) return
      setLine(
        !connected
          ? waiting > 0
            ? `In attesa di connessione: ${waiting} modifiche da inviare.`
            : "In attesa di connessione."
          : waiting > 0
            ? `Invio in corso: ${waiting} modifiche da inviare.`
            : "Copia online aggiornata.",
      )
    }
    void refresh()
    const stop = onDatabaseStatus(() => void refresh())
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => {
      active = false
      stop()
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="mt-2">
      <p className="text-sm leading-5">
        Accesso:{" "}
        <span className="font-bold [overflow-wrap:anywhere]">{email}</span>
      </p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground" role="status">
        {line}
      </p>
      <Button
        className="mt-3"
        disabled={busy}
        onClick={onSignOut}
        variant="secondary"
      >
        Esci
      </Button>
      <p className="mt-1 text-xs leading-4 text-muted-foreground">
        Il corso resta su questo telefono.
      </p>
    </div>
  )
}
