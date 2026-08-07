import type { Condition } from '../../shared/weather.ts'

/**
 * How each sky is drawn on the Today screen.
 *
 * Split out from the component so the mapping is exhaustive by construction —
 * `Record<Condition, …>` means adding a condition to `shared/weather.ts` fails
 * the typecheck here until it's given a look, rather than silently falling back
 * to a default nobody notices.
 *
 * `icon` names a lucide component rather than a hand-drawn SVG: the app already
 * uses lucide everywhere, and a bespoke weather set would sit awkwardly beside
 * it. The character comes from the colour treatment around it instead.
 */
export type WeatherIconName =
  | 'sun' | 'cloud-sun' | 'cloud' | 'cloud-fog'
  | 'cloud-rain' | 'snowflake' | 'cloud-lightning'

export interface WeatherVisual {
  icon: WeatherIconName
  /** Fit Check's own plain words for the sky. */
  words: string
}

export const WEATHER_VISUALS: Record<Condition, WeatherVisual> = {
  clear: { icon: 'sun', words: 'clear' },
  'partly-cloudy': { icon: 'cloud-sun', words: 'a bit cloudy' },
  overcast: { icon: 'cloud', words: 'grey' },
  fog: { icon: 'cloud-fog', words: 'foggy' },
  rain: { icon: 'cloud-rain', words: 'raining' },
  snow: { icon: 'snowflake', words: 'snowing' },
  thunder: { icon: 'cloud-lightning', words: 'stormy' },
}

/** Never throws on an unmapped value — an unknown sky falls back to overcast's
 *  neutral treatment rather than rendering a blank orb. */
export function weatherVisual(condition: Condition | null | undefined): WeatherVisual {
  if (!condition) return WEATHER_VISUALS.overcast
  return WEATHER_VISUALS[condition] ?? WEATHER_VISUALS.overcast
}

/**
 * A one-word feel for the temperature, shown under the number.
 *
 * Deliberately matches `targetWarmth`'s boundaries in lib/recommend.ts (22°C
 * and 12°C): the words on screen and the warmth the recommender is actually
 * aiming for should never tell different stories.
 */
export function temperatureWord(temp: number | null): string {
  if (temp === null) return ''
  if (temp >= 28) return 'hot'
  if (temp >= 22) return 'warm'
  if (temp >= 12) return 'mild'
  if (temp >= 4) return 'chilly'
  return 'cold'
}
