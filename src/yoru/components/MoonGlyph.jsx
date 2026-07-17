import { moonPhase, moonGlyphPath } from '../lib/sky'
import styles from './MoonGlyph.module.css'

// Tonight's real moon at its true phase, small enough to sit in a line of text
// — the teaser beside the 夜 on Home, and the prefix on the session's moon line.
// No location needed: the phase alone is the same the world over.
//
// SVG rather than canvas (which is what this was) so it scales with whatever
// font-size it's dropped into and stays crisp at any density. `phase` is a prop
// so a caller already holding one can pass it and be sure the shape and the
// words beside it describe the same instant; omit it and we read the clock.
//
// The ring is always drawn, under the lit face. At new moon there IS no lit
// face — moonGlyphPath returns nothing — and without the ring the glyph would
// be a blank gap where a moon should be.
export default function MoonGlyph({ phase, className }) {
  const lit = moonGlyphPath(phase ?? moonPhase(new Date()).phase)
  return (
    // roomier than the unit disc, so the ring's stroke isn't clipped
    <svg viewBox="-1.15 -1.15 2.3 2.3" className={className || styles.glyph} aria-hidden="true">
      <circle cx="0" cy="0" r="1" fill="rgba(0,0,0,0.32)" stroke="#c8c4e8" strokeOpacity="0.45" strokeWidth="0.07" />
      {lit && <path d={lit} fill="#c8c4e8" />}
    </svg>
  )
}
