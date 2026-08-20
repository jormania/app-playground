import styles from './TabBar.module.css'

export interface TabBarOption {
  value: string
  label: string
}

export interface TabBarProps {
  value: string
  options: TabBarOption[]
  onChange: (value: string) => void
}

/**
 * Silva's own icons, drawn rather than imported.
 *
 * WhereItWent's Navigation establishes the inline-SVG-map convention here (no
 * icon dependency), and Fit Check reaches for lucide — but a generic UI icon
 * set would be the one place in Silva speaking a different visual language.
 * These are drawn on the same 24-unit grid at hairline weight, in the app's
 * own vocabulary: a seedling for the understory, conifers for the forest, an
 * open ring for a clearing, a small node-link figure for Paths.
 *
 * `vector-effect: non-scaling-stroke` keeps the hairline hairline at every
 * rendered size, and `currentColor` lets one rule tint the whole set.
 */
const ICONS: Record<string, React.ReactNode> = {
  // A seedling breaking the litter — something newly arrived, not yet kept.
  nursery: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M12 20.5v-9" />
      <path d="M12 15c-3 0-4.8-1.9-4.8-4.4C10.2 10.6 12 12.5 12 15Z" />
      <path d="M12 12.5c3 0 4.8-1.9 4.8-4.4C13.8 8.1 12 10 12 12.5Z" />
    </>
  ),
  // One fir in two tiers. Two small trees turned to mush at 21px — the left
  // one read as a numeral — so this is a single tree drawn large enough to be
  // unmistakable at the size it is actually rendered.
  forest: (
    <>
      <path d="M12 3 8 9.5h8L12 3Z" />
      <path d="M12 8.5 6.5 17h11L12 8.5Z" />
      <path d="M12 17v4" />
    </>
  ),
  // A ring with a gap — an opening you can walk into. A clearing is a place
  // that formed, with a boundary you noticed rather than one you drew.
  clearings: (
    <circle cx="12" cy="12" r="7.5" strokeDasharray="39 8" transform="rotate(-90 12 12)" />
  ),
  // Three nodes, one solid thread and one dashed — the Paths view's own
  // contents in miniature: paths you asserted, mycorrhiza you haven't. Drawn
  // roots read as a stick figure at 21px; this reads as what it is.
  paths: (
    <>
      <path d="M12 7.6 7.4 14.6" />
      <path d="M12 7.6 16.6 14.6" strokeDasharray="2.5 2.5" />
      <path d="M8.6 16.4h6.8" strokeDasharray="2.5 2.5" />
      <circle cx="12" cy="5.6" r="2" />
      <circle cx="6.4" cy="16.4" r="2" />
      <circle cx="17.6" cy="16.4" r="2" />
    </>
  ),
  // A stem branching into root tendrils — the forest icon's own trunk, read
  // the other way. Roots is where a kept thing's source lives, the thing
  // that fed it, so this reads as "forest" upside down rather than as a
  // book (which fit the old label, "Sources", but not this one).
  roots: (
    <>
      <path d="M12 4v7" />
      <path d="M12 11c-2.2 1.8-3.4 4-4 8.5" />
      <path d="M12 11v9.5" />
      <path d="M12 11c2.2 1.8 3.4 4 4 8.5" />
      <path d="M12 14.5c-1.3 1-2 2.3-2.4 5" />
      <path d="M12 14.5c1.3 1 2 2.3 2.4 5" />
    </>
  ),
  forage: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4 21 21" />
    </>
  ),
  hearth: (
    <>
      <path d="M4 9h16" />
      <circle cx="9" cy="9" r="2.2" />
      <path d="M4 15h16" />
      <circle cx="15" cy="15" r="2.2" />
    </>
  ),
}

function TabIcon({ name }: { name: string }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  )
}

/**
 * The phone-sized navigation: a fixed bottom bar, following Fit Check's
 * `.fc-nav` (translucent over a backdrop blur, safe-area inset, ≥44px targets)
 * but laid out on a grid of equal columns so six views can never overflow into
 * a sideways scroll.
 *
 * This replaces the segmented control below 720px rather than sitting beside
 * it. Six segments needed ~657px of track against ~398px of phone, and the
 * design-system track hides its scrollbar — so three of Silva's six views were
 * simply off-screen with nothing to say so. A bar that fits is the honest fix;
 * the earlier fade was a legibility patch on a layout that didn't work.
 */
export function TabBar({ value, options, onChange }: TabBarProps) {
  return (
    <nav className={styles.bar} aria-label="Views">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={styles.tab}
            // The accessible name lives here rather than on the visible label,
            // which is hidden on the narrowest phones (see TabBar.module.css).
            aria-label={option.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              // Tapping the view you're already on returns you to the top —
              // the standard tab-bar convention, and the cheapest way back out
              // of a long forest without swiping all the way up.
              if (active) window.scrollTo({ top: 0, behavior: 'smooth' })
              else onChange(option.value)
            }}
          >
            <TabIcon name={option.value} />
            <span className={styles.label} aria-hidden="true">{option.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
