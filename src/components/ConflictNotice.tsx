/**
 * A calm one-line note that two phones edited the same thing offline and the
 * latest edit stayed (owner decision 12). It is information, not an error: no
 * action is needed, so it carries no button and no alarm colour.
 */
export function ConflictNotice({
  what = "questa sessione",
}: {
  what?: string
}) {
  return (
    <p
      className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground"
      role="status"
    >
      Due telefoni hanno cambiato {what} senza connessione: resta l’ultima
      modifica.
    </p>
  )
}
