import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Repeat2, X } from 'lucide-react'
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
  return (
    <article className="fc-outfit">
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
