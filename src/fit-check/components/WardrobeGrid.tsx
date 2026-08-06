import { useMemo } from 'react'
import { SegmentedControl } from '../../ds'
import type { Garment } from '../lib/types.ts'
import { CATEGORIES, type Home } from '../lib/vocabulary.ts'
import { homeLabel, type FitCheckConfig } from '../lib/config.ts'
import { useGarmentPhoto } from '../lib/useGarmentPhoto.ts'

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

/** Garments for a home. "Both" means everywhere, so it matches every row. */
export function garmentsForHome(garments: Garment[], home: Home): Garment[] {
  if (home === 'Both') return garments
  return garments.filter((g) => g.home === home || g.home === 'Both')
}

/**
 * One garment. Its own component so the photo hook runs per tile — the
 * placeholder paints immediately from data the page query already returned, and
 * the real photo fades in over it once the cache or the proxy answers.
 */
function GarmentTile({ garment, onSelect }: { garment: Garment; onSelect?: (g: Garment) => void }) {
  const photo = useGarmentPhoto(garment)
  return (
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
      {garment.favourite && (
        <span className="fc-tile-fav" aria-label="Favourite" role="img">⭐</span>
      )}
      <span className="fc-tile-name">{garment.name}</span>
    </button>
  )
}

interface Props {
  garments: Garment[]
  config: FitCheckConfig
  onHomeChange: (home: Home) => void
  onSelect?: (garment: Garment) => void
}

export default function WardrobeGrid({ garments, config, onHomeChange, onSelect }: Props) {
  const visible = useMemo(
    () => garmentsForHome(garments, config.activeHome).filter((g) => g.active),
    [garments, config.activeHome],
  )

  const sections = useMemo(
    () => CATEGORIES
      .map((category) => ({ category, items: visible.filter((g) => g.category === category) }))
      .filter((s) => s.items.length > 0),
    [visible],
  )

  return (
    <>
      <div className="fc-filter-row">
        <SegmentedControl
          value={config.activeHome}
          onChange={(v) => onHomeChange(v as Home)}
          options={[
            { value: 'Both', label: 'Both' },
            { value: 'Home A', label: homeLabel(config, 'Home A') },
            { value: 'Home B', label: homeLabel(config, 'Home B') },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <p className="fc-empty">
          Nothing here yet. Add a few things and they'll show up.
        </p>
      ) : (
        sections.map(({ category, items }) => (
          <section key={category}>
            <h2 className="fc-section-heading">{category}</h2>
            <div className="fc-grid">
              {items.map((g) => (
                <GarmentTile key={g.id} garment={g} onSelect={onSelect} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
