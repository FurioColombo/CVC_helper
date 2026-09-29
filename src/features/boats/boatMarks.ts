import type { BoatType } from "@/domain/config"
import { assetPath } from "@/lib/assetPath"

/**
 * Manufacturer marks and the owner's gommone icon vocabulary, kept in their
 * own plain module rather than in `BoatIdentity.tsx`: a component file may
 * only export components under this project's Fast Refresh lint rule, and
 * `crewSummaryImage.ts` (no JSX, rasterises the PNG export) needs these exact
 * values too. `BoatIdentity.tsx`'s `BoatModelMark`, `BoatModelHeaderMark` and
 * `GommoneIcon` and the exported crew-summary PNG both draw from here, so the
 * live app and the image handed to an operator can never show a different
 * boat mark or a different gommone.
 *
 * The written model stays as the fallback wherever a logo is used: if an
 * asset is missing or fails to decode, the card still says which boat it is
 * rather than showing a gap. Each logo file is trimmed to its own artwork
 * rather than sharing one plate, so `object-fit: contain` normalises the
 * marks against each other instead of against empty margins — a narrow mark
 * such as J/80 would otherwise render at a fraction of the size of a wide one
 * such as RS Quest.
 */
export const BOAT_LOGOS: Record<BoatType, string> = {
  "RS Toura": assetPath("/brand/boats/rs-toura.png"),
  "RS Quest": assetPath("/brand/boats/rs-quest.png"),
  "Laser Vago": assetPath("/brand/boats/laser-vago.png"),
  "RS 500": assetPath("/brand/boats/rs-500.png"),
  "J/80": assetPath("/brand/boats/j80.png"),
  "First 25.7": assetPath("/brand/boats/first-25-7.png"),
  "First 27": assetPath("/brand/boats/first-27.png"),
}

/**
 * The owner's final gommone mark (2026-09-28, commit 629e09d): a RIB seen
 * from above, tubes as a double line whose tails run past the transom, a
 * softly pointed bow, and the propeller as an 8 between the tails, no shaft.
 * Drawn bow right in a 24×24 viewBox; `gommoneTransform("vertical")` rotates
 * it -90° about the centre (12, 12) for bow-up use. The one source both
 * `GommoneIcon` (a live `<svg>`) and `crewSummaryImage.ts` (a rasterised
 * `<path>` string) draw from, so a future change to the mark only has to
 * happen once.
 */
export const GOMMONE_VIEW_BOX = "0 0 24 24"
export const GOMMONE_STROKE_WIDTH = 1.7
export const GOMMONE_HULL_PATHS: readonly string[] = [
  "M6.8 5.75H15C18.6 5.75 21.3 8 22.5 12 21.3 16 18.6 18.25 15 18.25H6.8",
  "M6.8 8.35H15C17.3 8.35 18.9 9.6 19.7 12 18.9 14.4 17.3 15.65 15 15.65H6.8",
  "M6.8 5.75a1.3 1.3 0 0 0 0 2.6",
  "M6.8 15.65a1.3 1.3 0 0 0 0 2.6",
  "M10.2 8.35v7.3",
]
export const GOMMONE_PROPELLER_PATH =
  "M8 12c-.5-.35-.75-.65-.75-1a.75.75 0 0 1 1.5 0c0 .35-.25.65-.75 1s-.75.65-.75 1a.75.75 0 0 0 1.5 0c0-.35-.25-.65-.75-1z"
export const GOMMONE_PROPELLER_STROKE_WIDTH = 1.1

export function gommoneTransform(
  orientation: "horizontal" | "vertical",
): string | undefined {
  return orientation === "vertical" ? "rotate(-90 12 12)" : undefined
}
