import { useMemo } from 'react'
import type { CurrentWeather } from '../../shared/weather.ts'
import { recommend, type RecommendContext } from '../lib/recommend.ts'
import { MOODS, type Mood } from '../lib/vocabulary.ts'
import { visibleGarments, type Wardrobe } from '../lib/wardrobes.ts'
import { useGarmentPhoto } from '../lib/useGarmentPhoto.ts'
import { thumbStyle } from './WardrobeGrid.tsx'
import type { Garment } from '../lib/types.ts'

/** Plain words for a sky. Fit Check's own voice — Touch Grass keeps its own. */
const SKY: Record<string, string> = {
  clear: 'clear', 'partly-cloudy': 'a bit cloudy', overcast: 'grey',
  fog: 'foggy', rain: 'raining', snow: 'snowing', thunder: 'stormy',
}

function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function Today({
  garments, wardrobes, filterId, weather, weatherLoading, mood, onMoodChange,
}: {
  garments: Garment[]
  wardrobes: Wardrobe[]
  filterId: string | null
  weather: CurrentWeather | null
  weatherLoading: boolean
  mood: Mood | null
  onMoodChange: (mood: Mood | null) => void
}) {
  const available = useMemo(
    () => visibleGarments(garments, wardrobes, filterId),
    [garments, wardrobes, filterId],
  )

  const outfits = useMemo(() => {
    const ctx: RecommendContext = {
      temp: weather?.temp ?? null,
      condition: weather?.condition ?? 'clear',
      wind: weather?.wind ?? 0,
      mood,
      today: todayIso(),
    }
    return recommend(available, ctx)
  }, [available, weather, mood])

  return (
    <>
      <p className="fc-weather">
        {weatherLoading
          ? 'Checking the weather…'
          : weather
            ? `${Math.round(weather.temp ?? 0)}°C and ${SKY[weather.condition] ?? weather.condition}.`
            : "Couldn't get the weather — these are just based on what you own."}
      </p>

      <section className="fc-tag-row">
        <p className="fc-settings-hint">How do you want to feel today?</p>
        <div className="fc-chips">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              className="fc-chip"
              role="radio"
              aria-checked={mood === m}
              data-selected={mood === m}
              // Tapping the chosen mood clears it, so "no particular mood" is
              // reachable without a seventh chip saying so.
              onClick={() => onMoodChange(mood === m ? null : m)}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      {outfits.length === 0 ? (
        <p className="fc-empty">
          {available.length === 0
            ? "Add a few things to your wardrobe and I'll put outfits together."
            : 'Not quite enough to build an outfit yet — a top, something to wear with it, and you’re away.'}
        </p>
      ) : (
        <div className="fc-outfits">
          {outfits.map((outfit) => (
            <article key={outfit.id} className="fc-outfit">
              <div className="fc-outfit-row">
                {outfit.garments.map((g) => <OutfitPiece key={g.id} garment={g} />)}
              </div>
              <p className="fc-outfit-why">{outfit.why}</p>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function OutfitPiece({ garment }: { garment: Garment }) {
  const photo = useGarmentPhoto(garment)
  return (
    <div className="fc-outfit-piece">
      <span className="fc-outfit-thumb" style={thumbStyle(garment.thumb)} aria-hidden="true">
        {photo && <img className="fc-tile-photo" src={photo} alt="" loading="lazy" decoding="async" />}
      </span>
      <span className="fc-outfit-name">{garment.name}</span>
    </div>
  )
}
