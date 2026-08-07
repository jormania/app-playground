import { useMemo } from 'react'
import { Star } from 'lucide-react'
import type { Garment } from '../lib/types.ts'
import { CATEGORIES } from '../lib/vocabulary.ts'
import { visibleGarments, unassignedGarments, activeWardrobes, type Wardrobe } from '../lib/wardrobes.ts'
import { useGarmentPhoto } from '../lib/useGarmentPhoto.ts'
import WardrobeFilter from './WardrobeFilter.tsx'

/**
 * Turn a stored `thumb` into something paintable. Two shapes are supported so
 * fixtures and real rows can share one grid:
 *   · `#rrggbb` — a flat average colour (fixtures, and the fallback if the LQIP
 *     spike in Milestone 2 doesn't fit Notion's 2000-char rich-text cap)
 *   · a base64 JPEG — the real low-quality placeholder
 * Anything else is ignored rather than injected into a style attribute.
 */
export function thumbStyle(thumb: string | null): React.CSSProperties {
  if (!thumb) return {}
  if (/^#[0-9a-f]{6}$/i.test(thumb)) return { backgroundColor: thumb }
  if (/^[A-Za-z0-9+/=]+$/.test(thumb) && thumb.length > 32) {
    return { backgroundImage: `url(data:image/jpeg;base64,${thumb})` }
  }
  return {}
}

/**
 * One garment. Its own component so the photo hook runs per tile — the
 * placeholder paints immediately from data the page query already returned, and
 * the real photo fades in over it once the cache or the proxy answers.
 *
 * The favourite star is a SEPARATE sibling button, not nested inside the tile
 * button — nested interactive elements are invalid HTML and browsers handle
 * the click ambiguously. `.fc-tile-wrap` gives them a shared, positioned box.
 */
function GarmentTile({
  garment, onSelect, onToggleFavourite,
}: {
  garment: Garment
  onSelect?: (g: Garment) => void
  onToggleFavourite?: (g: Garment) => void
}) {
  const photo = useGarmentPhoto(garment)
  return (
    <div className="fc-tile-wrap">
      <button type="button" className="fc-tile" onClick={() => onSelect?.(garment)}>
        <span className="fc-tile-thumb" style={thumbStyle(garment.thumb)} aria-hidden="true">
          {photo && (
            <img
              className="fc-tile-photo"
              src={photo}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}
        </span>
        <span className="fc-tile-name">{garment.name}</span>
      </button>
      <button
        type="button"
        className="fc-tile-fav"
        aria-label={garment.favourite ? `Remove ${garment.name} from favourites` : `Favourite ${garment.name}`}
        aria-pressed={garment.favourite}
        onClick={(e) => { e.stopPropagation(); onToggleFavourite?.(garment) }}
      >
        <Star size={14} aria-hidden="true" fill={garment.favourite ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

interface Props {
  garments: Garment[]
  wardrobes: Wardrobe[]
  filterId: string | null
  onFilterChange: (id: string | null) => void
  onSelect?: (garment: Garment) => void
  onToggleFavourite?: (garment: Garment) => void
}

export default function WardrobeGrid({
  garments, wardrobes, filterId, onFilterChange, onSelect, onToggleFavourite,
}: Props) {
  const visible = useMemo(
    () => visibleGarments(garments, wardrobes, filterId).filter((g) => !g.archived),
    [garments, wardrobes, filterId],
  )

  // Clothes left behind by a deleted wardrobe. Only worth mentioning in the
  // "All" view — inside a specific wardrobe they are by definition not here.
  const unfiled = useMemo(
    () => (filterId ? [] : unassignedGarments(visible)),
    [visible, filterId],
  )

  const nothingActive = wardrobes.length > 0 && activeWardrobes(wardrobes).length === 0

  const sections = useMemo(
    () => CATEGORIES
      .map((category) => ({ category, items: visible.filter((g) => g.category === category) }))
      .filter((s) => s.items.length > 0),
    [visible],
  )

  return (
    <>
      <div className="fc-filter-row">
        <WardrobeFilter wardrobes={wardrobes} value={filterId} onChange={onFilterChange} />
      </div>

      {unfiled.length > 0 && (
        <p className="fc-notice" role="status">
          {unfiled.length === 1 ? '1 thing isn’t' : `${unfiled.length} things aren’t`} in
          a wardrobe yet — they still show up here.
        </p>
      )}

      {visible.length === 0 ? (
        nothingActive ? (
          // Distinguishing "you own nothing" from "you switched everything off"
          // matters: the second looks identical and is trivially fixable.
          <p className="fc-empty">
            All your wardrobes are switched off, so there's nothing to show.
            Turn one back on in Settings.
          </p>
        ) : (
          <p className="fc-empty">
            Nothing here yet. Add a few things and they'll show up.
          </p>
        )
      ) : (
        sections.map(({ category, items }) => (
          <section key={category}>
            <h2 className="fc-section-heading">{category}</h2>
            <div className="fc-grid">
              {items.map((g) => (
                <GarmentTile
                  key={g.id}
                  garment={g}
                  onSelect={onSelect}
                  onToggleFavourite={onToggleFavourite}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
