import {
  blendForecast,
  type BlendedHour,
  type WindForecast,
} from "@/domain/wind"
import { WIND_ZONES, type WindZoneId } from "@/domain/windConfig"

export type PlaceHours = {
  point: (typeof WIND_ZONES)[WindZoneId]["points"][number]
  hours: BlendedHour[]
}

/** Each forecast point's own blend: the map's markers and the list under it. */
export function placeHours(
  forecast: WindForecast,
  now: number,
  zone: WindZoneId,
): PlaceHours[] {
  return WIND_ZONES[zone].points.map((point) => ({
    point,
    hours: blendForecast(forecast, now, [point.id]),
  }))
}
