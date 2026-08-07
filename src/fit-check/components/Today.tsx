import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import type { CurrentWeather } from '../../shared/weather.ts'
import { Button } from '../../ds'
import { recommend, type OutfitSuggestion, type RecommendContext } from '../lib/recommend.ts'
import { MOODS, type Mood, type Verdict } from '../lib/vocabulary.ts'
import { visibleGarments, type Wardrobe } from '../lib/wardrobes.ts'
import { useGarmentPhoto } from '../lib/useGarmentPhoto.ts'
import { thumbStyle } from './WardrobeGrid.tsx'
import { weatherLine } from '../lib/weatherText.ts'
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

  function buildOutfits(): OutfitSuggestion[] {
    const ctx: RecommendContext = {
      temp: weather?.temp ?? null,
      condition: weather?.condition ?? 'clear',
      wind: weather?.wind ?? 0,
      mood,
      today: todayIso(),
    }
    // Reads the CURRENT garments/wardrobes/filterId at call time — see the
    // effect below for why that's fine even though they're not in its deps.
    return recommend(visibleGarments(garments, wardrobes, filterId), ctx)
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
      <p className="fc-weather">
        {weatherLoading
          ? 'Checking the weather…'
          : weather
            ? `${weatherLine(weather)}.`
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
            <OutfitCard
              key={outfit.id}
              outfit={outfit}
              verdict={verdicts[outfit.id]}
              recording={recordingIds.has(outfit.id)}
              onRecord={(v) => onRecordVerdict(outfit, v)}
            />
          ))}
        </div>
      )}
    </>
  )
}

function OutfitCard({
  outfit, verdict, recording, onRecord,
}: {
  outfit: OutfitSuggestion
  verdict: Verdict | undefined
  recording: boolean
  onRecord: (verdict: Verdict) => void
}) {
  return (
    <article className="fc-outfit">
      <div className="fc-outfit-row">
        {outfit.garments.map((g) => <OutfitPiece key={g.id} garment={g} />)}
      </div>
      <p className="fc-outfit-why">{outfit.why}</p>

      {verdict ? (
        <p className="fc-outfit-status" data-verdict={verdict} role="status">
          {verdict === 'Worn' ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
          {verdict === 'Worn' ? 'Worn today' : 'Skipped for today'}
        </p>
      ) : (
        <div className="fc-outfit-actions">
          <Button size="sm" onClick={() => onRecord('Worn')} disabled={recording}>
            {recording ? <Loader2 size={14} className="fc-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            {' '}Wore this
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRecord('Skipped')} disabled={recording}>
            <X size={14} aria-hidden="true" /> Not today
          </Button>
        </div>
      )}
    </article>
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
