import { UpdateCheckButton } from "@/components/UpdateCheckButton"

/**
 * D3: this version is older than the data's minimum writer, so it only reads
 * (src/domain/compatibility.ts). Shown above every screen, in the page flow
 * rather than floating, so it covers nothing (rulebook R12).
 */
export function ReadOnlyNotice() {
  return (
    <section
      aria-labelledby="read-only-title"
      className="mx-5 mt-3 rounded-2xl border border-[#e7c66b] bg-[#fff3cd] p-4 text-[#5c3d00] max-[350px]:mx-[12px]"
    >
      <h2 className="text-base font-black" id="read-only-title">
        Solo lettura: aggiorna l’app
      </h2>
      <p className="mt-1 text-sm leading-5">
        Questo corso è stato salvato da una versione più recente di CVC Helper.
        Puoi consultarlo, ma le modifiche non vengono salvate finché non
        aggiorni l’app.
      </p>
      <UpdateCheckButton className="mt-3" label="Aggiorna l’app" />
    </section>
  )
}
