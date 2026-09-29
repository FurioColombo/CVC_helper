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
 * The owner's final gommone mark (2026-09-28/29): a RIB seen from above,
 * tubes as a double line whose tails run past the transom, a softly pointed
 * bow, and the propeller as an ∞ between the tails, no shaft. Drawn bow right
 * in a 24×24 viewBox, where the ∞ stands upright; `gommoneTransform("vertical")`
 * rotates it -90° about the centre (12, 12) for bow-up use, where it lies
 * down. The one source both `GommoneIcon` (a live `<svg>`) and
 * `crewSummaryImage.ts` (a rasterised `<path>` string) draw from, so a future
 * change to the mark only has to happen once.
 */
export const GOMMONE_VIEW_BOX = "0 0 24 24"
export const GOMMONE_STROKE_WIDTH = 1.7
export const GOMMONE_HULL_PATHS: readonly string[] = [
  "M6.8 5.75H15C18.6 5.75 21.3 8 22.5 12 21.3 16 18.6 18.25 15 18.25H6.8",
  "M6.8 8.25H15C17.3 8.25 18.95 9.55 19.8 12 18.95 14.45 17.3 15.75 15 15.75H6.8",
  "M6.8 5.75a1.25 1.25 0 0 0 0 2.5",
  "M6.8 15.75a1.25 1.25 0 0 0 0 2.5",
  "M10.2 8.25v7.5",
]

/**
 * A lemniscate of Bernoulli standing upright at (cx, cy), half as long as
 * `a`: teardrop loops crossing in an X, which reads as ∞ where two circles
 * read as "oo" (owner, 2026-09-29).
 */
function upright8Path(cx: number, cy: number, a: number, steps = 48) {
  const round = (value: number) => Math.round(value * 100) / 100
  const points: string[] = []
  for (let index = 0; index <= steps; index += 1) {
    const t = (index / steps) * 2 * Math.PI
    const d = 1 + Math.sin(t) ** 2
    const along = (a * Math.cos(t)) / d
    const across = (a * Math.sin(t) * Math.cos(t)) / d
    points.push(`${round(cx + across)} ${round(cy + along)}`)
  }
  return `M${points.join("L")}z`
}

// Sized to fill the gap between the tube tails without touching them or
// the transom.
export const GOMMONE_PROPELLER_PATH = upright8Path(7.9, 12, 2.35)
export const GOMMONE_PROPELLER_STROKE_WIDTH = 1

export function gommoneTransform(
  orientation: "horizontal" | "vertical",
): string | undefined {
  return orientation === "vertical" ? "rotate(-90 12 12)" : undefined
}
