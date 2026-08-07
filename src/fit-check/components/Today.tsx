import { useEffect, useMemo, useState } from 'react'
import {
  Check, Loader2, Repeat2, X,
  Sun, CloudSun, Cloud, CloudFog, CloudRain, Snowflake, CloudLightning,
} from 'lucide-react'
import type { CurrentWeather } from '../../shared/weather.ts'
import { Button } from '../../ds'
import {
  recommend, alternativesFor, swapPiece,
  type OutfitSuggestion, type RecommendContext,
} from '../lib/recommend.ts'
import { MOODS, type Mood, type Verdict } from '../lib/vocabulary.ts'
import { visibleGarments, type Wardrobe } from '../lib/wardrobes.ts'
import { useGarmentPhoto } from '../lib/useGarmentPhoto.ts'
import { thumbStyle } from './WardrobeGrid.tsx'
import { weatherVisual, temperatureWord, type WeatherIconName } from '../lib/weatherVisual.ts'
import { todayIso } from '../lib/today.ts'
import type { Garment } from '../lib/types.ts'

interface Props {
  garments: Garment[]
  wardrobes: Wardrobe[]
  filterId: string | null
  weather: CurrentWeather | null
  weatherLoading: boolean
  mood: Mood | null
  onMoodChange: (mood: Mood | null) => void
  /** Outfit ids already acted on today, and what was decided. Lifted to App so
   *  the confirmation survives switching tabs and coming back. */
  verdicts: Record<string, Verdict>
  /** Outfit ids currently mid-write, so their buttons disable one at a time
   *  rather than the whole screen locking while any single request is in flight. */
  recordingIds: Set<string>
  onRecordVerdict: (outfit: OutfitSuggestion, verdict: Verdict) => void
}

export default function Today({
  garments, wardrobes, filterId, weather, weatherLoading, mood, onMoodChange,
  verdicts, recordingIds, onRecordVerdict,
}: Props) {
  const available = useMemo(
    () => visibleGarments(garments, wardrobes, filterId),
    [garments, wardrobes, filterId],
  )

  const ctx: RecommendContext = {
    temp: weather?.temp ?? null,
    condition: weather?.condition ?? 'clear',
    wind: weather?.wind ?? 0,
    mood,
    today: todayIso(),
  }

  function buildOutfits(): OutfitSuggestion[] {
    // Reads the CURRENT garments/wardrobes/filterId at call time — see the
    // effect below for why that's fine even though they're not in its deps.
    return recommend(visibleGarments(garments, wardrobes, filterId), ctx)
  }

  /**
   * Quick Swap: keep this outfit, change one piece. Rewrites only the card that
   * changed, leaving the other two suggestions alone — the point is "these
   * shoes, not those", not "give me three new outfits".
   */
  function handleSwap(slot: number, garmentId: string) {
    setOutfits((prev) => prev.map((o) => (
      o.slot === slot ? swapPiece(o, garmentId, available, ctx) : o
    )))
  }

  /** Is there anything else in the wardrobe this piece could become? The ring
   *  always contains the piece itself, so "more than one" means "yes". */
  function swappable(outfit: OutfitSuggestion, garmentId: string): boolean {
    return alternativesFor(outfit, garmentId, available, ctx).length > 1
  }

  // Pinned for the session, not a plain useMemo over `available`. Marking a
  // suggestion Worn updates wearCount/lastWorn on exactly the garments in that
  // card, and recommend()'s recency penalty then applies to them immediately —
  // a live recompute could drop the very outfit the user just confirmed out of
  // its own top 3, right as they confirm it, orphaning the "Worn today" state
  // (found by hand, not by a test: the confirmation appeared to do nothing).
  //
  // So this reacts to mood and to the weather settling — genuine reasons for
  // new suggestions — but deliberately NOT to garments or wardrobes changing.
  // A new pool of clothes only reaches Today via a tab switch anyway
  // (AddGarment lives on the Wardrobe tab), which unmounts and remounts this
  // component, giving `useState`'s initializer a fresh read.
  const [outfits, setOutfits] = useState<OutfitSuggestion[]>(buildOutfits)
  useEffect(() => {
    setOutfits(buildOutfits())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, weather?.temp, weather?.condition, weather?.wind])

  return (
    <>
      <WeatherCard weather={weather} loading={weatherLoading} />

      <section className="fc-mood">
        <h2 className="fc-mood-question">How do you want to feel today?</h2>
        <div className="fc-chips fc-mood-chips">
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
            ? "Your wardrobe is empty, so there's nothing to suggest yet. Photograph a few things first."
            : 'Almost there — one top and something to wear with it, and I can start putting outfits together.'}
        </p>
      ) : (
        <div className="fc-outfits">
          {outfits.map((outfit) => (
            <OutfitCard
              // Keyed on slot, not id: swapping a piece changes the id, and
              // keying on that would remount the card and flash every photo.
              key={outfit.slot}
              outfit={outfit}
              verdict={verdicts[outfit.id]}
              recording={recordingIds.has(outfit.id)}
              onRecord={(v) => onRecordVerdict(outfit, v)}
              swappable={swappable}
              onSwap={(garmentId) => handleSwap(outfit.slot, garmentId)}
            />
          ))}
        </div>
      )}
    </>
  )
}

const WEATHER_ICONS: Record<WeatherIconName, typeof Sun> = {
  'sun': Sun,
  'cloud-sun': CloudSun,
  'cloud': Cloud,
  'cloud-fog': CloudFog,
  'cloud-rain': CloudRain,
  'snowflake': Snowflake,
  'cloud-lightning': CloudLightning,
}

/**
 * Today's sky, as the first thing on the screen.
 *
 * The temperature is the headline because it's what actually drives the
 * suggestions below — the recommender weights warmth-vs-temperature above
 * everything else, so the number that matters most is the number shown biggest.
 *
 * Colour comes from `data-condition` in the stylesheet rather than inline
 * styles, so both themes are handled in one place and the tint can't drift from
 * the icon it sits behind.
 */
function WeatherCard({ weather, loading }: { weather: CurrentWeather | null; loading: boolean }) {
  if (loading) {
    return (
      <section className="fc-weather-card" data-condition="overcast" aria-busy="true">
        <span className="fc-weather-orb"><Loader2 size={24} className="fc-spin" aria-hidden="true" /></span>
        <span className="fc-weather-read"><b className="fc-weather-words">Checking the weather…</b></span>
      </section>
    )
  }

  // No weather is not an error state — the recommender simply stops weighting
  // warmth and works from what she owns, so this says that rather than alarming.
  if (!weather) {
    return (
      <section className="fc-weather-card" data-condition="fog">
        <span className="fc-weather-orb"><CloudFog size={24} aria-hidden="true" /></span>
        <span className="fc-weather-read">
          <b className="fc-weather-words">No weather right now</b>
          <span className="fc-weather-sub">Going on what you own instead.</span>
        </span>
      </section>
    )
  }

  const visual = weatherVisual(weather.condition)
  const Icon = WEATHER_ICONS[visual.icon]
  const temp = weather.temp === null ? null : Math.round(weather.temp)
  const feel = temperatureWord(weather.temp)

  return (
    <section className="fc-weather-card" data-condition={weather.condition}>
      <span className="fc-weather-orb"><Icon size={24} aria-hidden="true" /></span>
      <span className="fc-weather-read">
        {temp !== null && (
          <b className="fc-weather-temp">
            {temp}<span className="fc-weather-deg">°C</span>
          </b>
        )}
        <span className="fc-weather-sub">
          {[feel, visual.words].filter(Boolean).join(' · ')}
        </span>
      </span>
    </section>
  )
}

function OutfitCard({
  outfit, verdict, recording, onRecord, swappable, onSwap,
}: {
  outfit: OutfitSuggestion
  verdict: Verdict | undefined
  recording: boolean
  onRecord: (verdict: Verdict) => void
  /** Which pieces of THIS outfit have somewhere to swap to. */
  swappable: (outfit: OutfitSuggestion, garmentId: string) => boolean
  onSwap: (garmentId: string) => void
}) {
  // Once a verdict is in, the card is settled — swapping it would leave the
  // "Worn today" label describing an outfit that is no longer on screen.
  const canSwap = !verdict && !recording

  const [burst, setBurst] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const prevRecording = useRef(recording)
  useEffect(() => {
    // If we just finished recording...
    if (prevRecording.current && !recording) {
      if (verdict === 'Worn') {
        setBurst(true)
        const t = setTimeout(() => setBurst(false), 800)
        return () => clearTimeout(t)
      } else if (verdict === 'Skipped') {
        setSkipped(true)
        // No need to clear `skipped`; we want it to stay collapsed.
      }
    }
    prevRecording.current = recording
  }, [recording, verdict])

  return (
    <article className={`fc-outfit ${burst ? 'fc-success-burst' : ''} ${skipped ? 'fc-skipped-collapse' : ''}`}>
      <div className="fc-outfit-row">
        {outfit.garments.map((g) => (
          <OutfitPiece
            key={g.id}
            garment={g}
            onSwap={canSwap && swappable(outfit, g.id) ? () => onSwap(g.id) : undefined}
          />
        ))}
      </div>
      <p className="fc-outfit-why">{outfit.why}</p>

      {verdict ? (
        <p className="fc-outfit-status" data-verdict={verdict} role="status">
          {verdict === 'Worn' ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
          {verdict === 'Worn' ? 'Wearing today' : 'Skipped for today'}
        </p>
      ) : (
        <div className="fc-outfit-actions">
          <Button size="sm" onClick={() => onRecord('Worn')} disabled={recording}>
            {recording ? <Loader2 size={14} className="fc-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            {' '}Wear this
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRecord('Skipped')} disabled={recording}>
            <X size={14} aria-hidden="true" /> Not today
          </Button>
        </div>
      )}
    </article>
  )
}

function OutfitPiece({ garment, onSwap }: { garment: Garment; onSwap?: () => void }) {
  const photo = useGarmentPhoto(garment)
  return (
    <div className="fc-outfit-piece">
      {/* Not aria-hidden, unlike the History/Wardrobe thumbs this mirrors: it
          now contains a real button, and hiding the container would hide that
          button from screen readers entirely. The image inside carries alt=""
          so the decorative part is still ignored. */}
      <span className="fc-outfit-thumb" style={thumbStyle(garment.thumb)}>
        {photo && <img className="fc-tile-photo" src={photo} alt="" loading="lazy" decoding="async" />}
        {/* Only rendered when there's actually something else to wear — a
            swap button that does nothing is worse than no button. */}
        {onSwap && (
          <button
            type="button"
            className="fc-swap"
            aria-label={`Swap ${garment.name} for something else`}
            onClick={onSwap}
          >
            <Repeat2 size={13} aria-hidden="true" />
          </button>
        )}
      </span>
      <span className="fc-outfit-name">{garment.name}</span>
    </div>
  )
}
