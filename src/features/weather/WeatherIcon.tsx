import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react"
import type { CSSProperties } from "react"

import type { WeatherKindId } from "@/domain/windConfig"

const ICONS: Record<WeatherKindId, typeof Sun> = {
  clear: Sun,
  partly: CloudSun,
  overcast: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
}

/** The sky's icon; words beside it or a screen-reader text say what it is. */
export function WeatherIcon({
  kind,
  className,
  stormColor = "#b42318",
}: {
  kind: WeatherKindId
  className?: string
  /** Thunder is red, except where red cannot be seen. */
  stormColor?: string
}) {
  const Icon = ICONS[kind]
  const style: CSSProperties | undefined =
    kind === "storm" ? { color: stormColor } : undefined
  return <Icon aria-hidden="true" className={className} style={style} />
}
