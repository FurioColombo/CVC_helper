import { Wind } from "lucide-react"

/**
 * What Vento sends and to whom, in Impostazioni (03 §3.4): the one part of the
 * app that connects without sign-in, and only while its screen is open.
 */
export function WeatherDisclosure() {
  return (
    <section
      aria-labelledby="weather-disclosure-title"
      className="mt-6 border-t pt-5"
    >
      <h2
        className="flex items-center gap-2 text-sm font-bold text-primary"
        id="weather-disclosure-title"
      >
        <Wind aria-hidden="true" className="size-4 shrink-0" />
        Previsioni del vento
      </h2>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">
        Quando apri Vento, l’app chiede le previsioni a Open-Meteo e la mappa a
        LaMMA, anche senza accesso. Invia solo le coordinate fisse dell’area di
        navigazione, nessun dato del corso; quei servizi vedono l’indirizzo
        della rete del telefono e l’ora. La Home non si collega.
      </p>
    </section>
  )
}
