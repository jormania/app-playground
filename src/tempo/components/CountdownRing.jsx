import styles from './CountdownRing.module.css'

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// Thick enough to read at a glance in direct sunlight (outdoor screens wash
// out a thin line first) — was 6, room to spare before it'd crowd RADIUS.
const STROKE_WIDTH = 10

// Calm per-kind ring tints, harmonising with the family gradients. `active`
// (a Move segment, in Rounds or Custom) isn't listed here — it gets a
// dynamic cold-to-hot tint instead, see ACTIVE_TINTS below.
const TINT_BY_KIND = {
  prepare: '#d8a657', // amber
  rest: '#6fb08a', // sage
  focus: '#7076d8', // periwinkle
  sit: '#4e9e86', // deep sage
  walk: '#4fa6a0', // teal
  inhale: '#5fa3d6', // sky
  hold: '#9a8fd0', // lavender
  exhale: '#5fb6ac', // seafoam
}

// A Move segment's ring runs cold-to-hot over its own duration — a second,
// glanceable read on how far into the effort you are, without reading the
// clock: blue for the first half, amber for the next quarter, red for the
// last quarter (the "kick" everyone recognises). Unlike the other kinds
// (one solid colour, revealed by depletion), all three zones are laid out
// and coloured the moment the Move starts — see ActiveZones below — so the
// whole shape of the effort is visible up front, not just the current tint.
const ACTIVE_COOL = '#4a90d9'
const ACTIVE_WARM = '#e8973a'
const ACTIVE_HOT = '#d6473f'

const ACTIVE_ZONES = [
  { key: 'cold', start: 0, end: 0.5, color: ACTIVE_COOL },
  { key: 'warm', start: 0.5, end: 0.75, color: ACTIVE_WARM },
  { key: 'hot', start: 0.75, end: 1, color: ACTIVE_HOT },
]

// Degrees of empty track trimmed off both ends of every zone, so the three
// read as separated sections (rounded caps, small gap) rather than one
// continuous ring — see the reference screenshot this was modelled on. Round
// line caps bulge past their geometric endpoint by half the stroke width, so
// a naive trim gets eaten by the two caps facing each other across the gap
// and the zones visually overlap; TRIM_DEG backs each end off far enough
// that a real gap survives the caps, leaving VISIBLE_GAP_DEG of daylight.
const CAP_BLEED_DEG = (STROKE_WIDTH / 2 / RADIUS) * (180 / Math.PI)
const VISIBLE_GAP_DEG = 2
const ZONE_GAP_DEG = VISIBLE_GAP_DEG + CAP_BLEED_DEG * 2

function tintFor(kind) {
  return TINT_BY_KIND[kind] ?? 'var(--color-accent)'
}

// Angle convention matches the plain circle below: 0° sits at the SVG's
// native start point (3 o'clock), increasing clockwise; the shared `.svg`
// class then rotates the whole picture -90° so 0° lands at 12 o'clock.
function pointOnCircle(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  if (endDeg <= startDeg) return ''
  const start = pointOnCircle(cx, cy, r, startDeg)
  const end = pointOnCircle(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

// Each zone draws only the portion still ahead of the elapsed pointer, at
// full colour — the shared grey `.track` circle underneath shows through
// once a zone is consumed, same as every other kind's ring. At the very
// start elapsed is 0, so all three zones show complete; as time passes, the
// pointer sweeps clockwise and each zone's arc shrinks away in turn.
function ActiveZones({ elapsedFraction, pulsing }) {
  const elapsedDeg = Math.min(1, Math.max(0, elapsedFraction)) * 360
  return ACTIVE_ZONES.map((zone) => {
    const zoneStartDeg = zone.start * 360 + ZONE_GAP_DEG / 2
    const zoneEndDeg = zone.end * 360 - ZONE_GAP_DEG / 2
    const overlayStartDeg = Math.max(zoneStartDeg, elapsedDeg)
    return (
      <path
        key={zone.key}
        d={arcPath(50, 50, RADIUS, overlayStartDeg, zoneEndDeg)}
        strokeWidth={STROKE_WIDTH}
        fill="none"
        stroke={zone.color}
        className={`${styles.zoneFill} ${pulsing ? styles.pulsing : ''}`}
        style={{ '--pulse-color': zone.color }}
      />
    )
  })
}

// A circular countdown, depleting clockwise as the segment elapses — the
// strongest visual anchor on the screen you spend the most time looking at.
// Tempo-local (not DS): it's specific to "a fraction of a countdown", single
// caller. Promote it into src/ds/ if a second app ever wants a generic ring.
export function CountdownRing({ fractionRemaining, kind, pulsing = false, children }) {
  const clamped = Math.min(1, Math.max(0, fractionRemaining))
  const isActive = kind === 'active'
  // Negative, not (1 - clamped): a positive offset here reveals the arc
  // starting at 12 o'clock and eats it away from the *far* end backwards,
  // which reads as counterclockwise depletion. Negating it eats the arc
  // starting at 12 o'clock instead, so the ring empties clockwise like the
  // Move ring's zones below.
  const offset = -CIRCUMFERENCE * (1 - clamped)
  const tint = tintFor(kind)

  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 100 100" className={styles.svg}>
        <circle cx="50" cy="50" r={RADIUS} strokeWidth={STROKE_WIDTH} className={styles.track} fill="none" />
        {isActive ? (
          <ActiveZones elapsedFraction={1 - clamped} pulsing={pulsing} />
        ) : (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            className={`${styles.progress} ${pulsing ? styles.pulsing : ''}`}
            style={{ stroke: tint, strokeDasharray: CIRCUMFERENCE, strokeDashoffset: offset, '--pulse-color': tint }}
          />
        )}
      </svg>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
