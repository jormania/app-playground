import { Heart, Trash2 } from 'lucide-react'
import { useGarmentPhoto } from '../lib/useGarmentPhoto.ts'
import { thumbStyle } from './WardrobeGrid.tsx'
import type { Garment, Outfit } from '../lib/types.ts'
import type { Wardrobe } from '../lib/wardrobes.ts'

interface Props {
  outfits: Outfit[]
  garments: Garment[]
  wardrobes: Wardrobe[]
  onToggleFavourite: (outfit: Outfit) => void
  onDeleteOutfit: (outfit: Outfit) => void
}

/** Every outfit that was ever acted on, most recent first — both Worn and
 *  Skipped, since "not today" (per Nora: skip means that, not "never again")
 *  is still worth a record of what was actually considered. */
export default function History({ outfits, garments, wardrobes, onToggleFavourite, onDeleteOutfit }: Props) {
  if (outfits.length === 0) {
    return (
      <p className="fc-empty">
        Nothing worn yet. Wear or skip something on Today and it'll appear here.
      </p>
    )
  }

  const byId = new Map(garments.map((g) => [g.id, g]))
  const wardrobeById = new Map(wardrobes.map((w) => [w.id, w]))

  const sorted = [...outfits].sort((a, b) =>
    b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  )

  return (
    <div className="fc-history-list">
      {sorted.map((outfit) => (
        <HistoryEntry
          key={outfit.id}
          outfit={outfit}
          byId={byId}
          wardrobeById={wardrobeById}
          onToggleFavourite={() => onToggleFavourite(outfit)}
          onDelete={() => onDeleteOutfit(outfit)}
        />
      ))}
    </div>
  )
}

function HistoryEntry({
  outfit, byId, wardrobeById, onToggleFavourite, onDelete,
}: {
  outfit: Outfit
  byId: Map<string, Garment>
  wardrobeById: Map<string, Wardrobe>
  onToggleFavourite: () => void
  onDelete: () => void
}) {
  // A garment can be deleted after an outfit wore it; the record stays honest
  // about the count without crashing on the missing lookup.
  const pieces = outfit.garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => Boolean(g))
  const wardrobeNames = outfit.wardrobeIds
    .map((id) => wardrobeById.get(id)?.name)
    .filter((name): name is string => Boolean(name))

  return (
    <article className="fc-history-entry">
      <div className="fc-history-head">
        <div>
          <p className="fc-history-date">{formatDate(outfit.date)}</p>
          <p className="fc-history-meta">
            <span className="fc-history-verdict" data-verdict={outfit.verdict ?? undefined}>
              {outfit.verdict === 'Worn' ? 'Worn' : outfit.verdict === 'Skipped' ? 'Skipped' : 'Recorded'}
            </span>
            {outfit.mood && <> · {outfit.mood}</>}
            {outfit.weather && <> · {outfit.weather}</>}
            {wardrobeNames.length > 0 && <> · {wardrobeNames.join(', ')}</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
          <button
            type="button"
            className="fc-history-fav"
            aria-label={outfit.favourite ? 'Remove from favourites' : 'Mark as a favourite'}
            aria-pressed={outfit.favourite}
            onClick={onToggleFavourite}
          >
            <Heart size={16} aria-hidden="true" fill={outfit.favourite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="fc-history-fav"
            aria-label="Delete outfit record"
            onClick={onDelete}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {pieces.length > 0 && (
        <div className="fc-outfit-row">
          {pieces.map((g) => <HistoryPiece key={g.id} garment={g} />)}
        </div>
      )}
    </article>
  )
}

function HistoryPiece({ garment }: { garment: Garment }) {
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

/** "2026-08-06" → "6 Aug 2026". Built from parts like `today.ts`, so a date
 *  string is never handed to `Date.parse` and read through UTC. */
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = Number(m[3])
  const month = months[Number(m[2]) - 1]
  return `${day} ${month} ${m[1]}`
}
