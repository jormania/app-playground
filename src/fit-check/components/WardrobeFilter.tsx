import type { Wardrobe } from '../lib/wardrobes.ts'
import { activeWardrobes } from '../lib/wardrobes.ts'

/**
 * The wardrobe filter: "All" plus one chip per active wardrobe.
 *
 * Chips rather than the design system's SegmentedControl, which divides its
 * track evenly and only reads well at two or three options. Wardrobes are now
 * unbounded, so the row scrolls horizontally instead — the page itself must
 * never scroll sideways.
 *
 * Inactive wardrobes are absent by design: switching one off is what makes it
 * fade out of the UI. It reappears the moment it's switched back on.
 */
export default function WardrobeFilter({
  wardrobes,
  value,
  onChange,
}: {
  wardrobes: Wardrobe[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  const active = activeWardrobes(wardrobes)

  // With none to choose between, a filter offering only "All" is just noise.
  if (active.length === 0) return null

  return (
    <div className="fc-chips" role="radiogroup" aria-label="Wardrobe">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        className="fc-chip"
        data-selected={value === null}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {active.map((w) => (
        <button
          key={w.id}
          type="button"
          role="radio"
          aria-checked={value === w.id}
          className="fc-chip"
          data-selected={value === w.id}
          onClick={() => onChange(w.id)}
        >
          {w.name}
        </button>
      ))}
    </div>
  )
}
