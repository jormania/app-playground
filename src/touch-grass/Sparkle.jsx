// A small star/sparkle, shared so the Reliquary's separator and the corner
// ticker's separator are literally the same element.

// a star polygon centred in a 16×16 box
export function starPath(points, outer, inner) {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    d += (i === 0 ? 'M' : 'L') + (8 + Math.cos(a) * r).toFixed(2) + ' ' + (8 + Math.sin(a) * r).toFixed(2) + ' '
  }
  return d + 'Z'
}

const SEP_GLYPH = starPath(4, 6, 1.5)

export default function Sparkle({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d={SEP_GLYPH} fill="currentColor" />
    </svg>
  )
}
