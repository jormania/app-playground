import { useEffect, useRef, useState } from 'react'

/**
 * The Programme's filter cascade — Type → Venue → Hall, top to leaf, with
 * every level that has something to offer kept on screen at once.
 *
 * It replaces three tiers that each quietly re-scoped themselves, and the
 * rebuild is a rebuild rather than a patch because no one of those three was
 * the bug — together they drew a hierarchy on screen that the state
 * underneath had already abandoned (MARQUEE.md §9.60):
 *
 *   - picking a venue CLEARED the category that got you there, so the
 *     "Theatre ›" label above the row described a filter no longer applied;
 *   - the venue row then expanded to EVERY active venue, so three cinemas
 *     sat under that same "Theatre ›" label;
 *   - and the type row re-scoped itself to the selected venue's own
 *     categories, which for a single-discipline venue collapsed it to one
 *     option and hid it — the top of the chain disappearing exactly when you
 *     were deepest in it, with no way back up but the browser's own Back.
 *
 * Two rules replace all three, and everything else here follows from them:
 *
 *   1. **A level is scoped by its parents and by nothing else.** The venue
 *      row lists the selected type's venues, the hall row lists the selected
 *      venue's halls. What the label says is what the row contains.
 *   2. **A child never clears its parent.** Picking a venue leaves the type
 *      selected, visible and highlighted; the path line and the rows agree
 *      because they are reading the same state.
 *
 * Traceability up is the path line plus the parent rows, which stay put and
 * stay clickable — no Back button, and no level you can reach but not see.
 * Traceability down is the counts: each option carries how many productions
 * sit behind it *at its own level's scope*, which is what makes an absence
 * legible ("Cinema Europa isn't in this list" and "it has nothing under
 * Theatre" stop being two different questions).
 */

/** Drives a level's mount/enter/exit as three beats: a CSS transition needs a
 *  frame where the section already exists at its CLOSED size before it can
 *  animate open, and it needs to still exist while it animates shut. Flipping
 *  straight to open on the mounting render leaves nothing to transition FROM;
 *  unmounting on the closing render leaves nothing to transition AT ALL. */
function useReveal(shown, duration = 180) {
  const [mounted, setMounted] = useState(shown)
  const [open, setOpen] = useState(shown)
  useEffect(() => {
    let raf, timer
    if (shown) {
      setMounted(true)
      raf = requestAnimationFrame(() => setOpen(true))
    } else {
      setOpen(false)
      timer = setTimeout(() => setMounted(false), duration)
    }
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [shown, duration])
  return { mounted, open }
}

/** One level: its label in a fixed gutter, then an "All" chip and one chip
 *  per option in a track that scrolls independently beside it.
 *
 *  The label sits OUTSIDE the scroller rather than sticky inside it. Sticky
 *  keeps it visible too, but chips then slide underneath and get sliced
 *  mid-word at its edge ("…olis 0"), which looks like a rendering fault; a
 *  gutter gives the label a lane of its own and the chips a clean one. That
 *  the label is always readable is the point either way — a row scrolled
 *  halfway along with no label in sight is exactly what made the old venue
 *  row read as broken.
 *
 *  Same reason the active chip is scrolled back into view whenever the
 *  selection changes: picking a venue further along the alphabet than
 *  wherever the row happened to be left showed a slice of unrelated
 *  neighbours and no highlight at all (§9.59). */
function CascadeLevel({ level, primary }) {
  const { id, label, value, options, onChange, allLabel = 'All', allIcon: AllIcon, allCount } = level
  const rowRef = useRef(null)

  useEffect(() => {
    rowRef.current?.querySelector('.cascade__chip--on')
      ?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [value])

  return (
    <div
      className={`cascade__row ${primary ? 'cascade__row--primary' : ''}`}
      role="group"
      aria-label={label}
      ref={rowRef}
    >
      <span className="cascade__label" aria-hidden="true">{label}</span>
      <div className="cascade__track">
        <button
          type="button"
          className={`cascade__chip ${!value ? 'cascade__chip--on' : ''}`}
          aria-pressed={!value}
          onClick={() => onChange(null)}
        >
          {AllIcon && <AllIcon size={14} aria-hidden="true" />}
          {allLabel}
          {allCount != null && <span className="cascade__count" aria-hidden="true">{allCount}</span>}
        </button>
        {options.map((option) => {
          const on = value === option.key
          const Icon = option.icon
          return (
            <button
              key={`${id}:${option.key}`}
              type="button"
              className={`cascade__chip ${on ? 'cascade__chip--on' : ''}`}
              aria-pressed={on}
              // Re-tapping the active chip clears this level, the same
              // toggle every tier has always had — the "All" chip beside it
              // is the discoverable way to do it, this is the quick one.
              onClick={() => onChange(on ? null : option.key)}
            >
              {Icon && <Icon size={14} aria-hidden="true" />}
              {option.label}
              {/* Hidden from the accessibility tree on purpose: it would
                  otherwise fuse into the chip's name ("Theatre 12"), which is
                  not what anyone calls this filter. The number is a visual
                  aid for scanning the row; the programme list underneath is
                  the real answer to "how much is there". */}
              {option.count != null && <span className="cascade__count" aria-hidden="true">{option.count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Where you are, in one line, with everything above you one tap away.
 *
 *  Each segment drops the levels BELOW it and keeps its own selection — the
 *  ordinary breadcrumb contract, and the reason the rows underneath don't
 *  need a Back button of their own. The root ("All") is the only segment
 *  that clears the whole chain; the deepest one is where you already are, so
 *  it is a marker rather than a button. */
function CascadePath({ levels, onReset }) {
  const chosen = levels.filter((level) => level.value != null)
  return (
    <p className="cascade__path">
      {/* Crumbs are labelled "Back to …" rather than just the name they
          show: a button reading "Theatre" sitting a few pixels above a chip
          also reading "Theatre" is two different actions under one name,
          which is exactly as confusing announced aloud as it is to test. */}
      {chosen.length === 0 ? (
        <span className="cascade__crumb cascade__crumb--here" aria-current="true">Everything</span>
      ) : (
        <button type="button" className="cascade__crumb" aria-label="Clear all filters" onClick={onReset}>
          Everything
        </button>
      )}
      {chosen.map((level, i) => {
        const last = i === chosen.length - 1
        const text = level.valueLabel ?? level.value
        return (
          <span key={level.id}>
            <span className="cascade__sep" aria-hidden="true">›</span>
            {last ? (
              <span className="cascade__crumb cascade__crumb--here" aria-current="true">{text}</span>
            ) : (
              <button
                type="button"
                className="cascade__crumb"
                aria-label={`Back to ${text}`}
                onClick={level.focus}
              >
                {text}
              </button>
            )}
          </span>
        )
      })}
    </p>
  )
}

/** A level only renders once it has something to choose between: a hall row
 *  listing one hall, or a type row listing one type, narrows nothing and
 *  says nothing. `minOptions` is per level because the venue row earns its
 *  place at ONE option where the others don't — stepping into that single
 *  venue is what reveals the hall level below it, so hiding it would leave a
 *  level reachable only by a filter you can't see. */
function RevealedLevel({ level, primary }) {
  const shown = level.options.length >= (level.minOptions ?? 2)
  const { mounted, open } = useReveal(shown)
  if (!mounted) return null
  return (
    <div className={`cascade__reveal ${open ? 'cascade__reveal--open' : ''}`}>
      <div className="cascade__reveal-inner">
        <CascadeLevel level={level} primary={primary} />
      </div>
    </div>
  )
}

export default function FilterCascade({ levels, onReset }) {
  return (
    <nav className="cascade" aria-label="Filter the programme">
      <CascadePath levels={levels} onReset={onReset} />
      {levels.map((level, i) => (
        <RevealedLevel key={level.id} level={level} primary={i === 0} />
      ))}
    </nav>
  )
}
