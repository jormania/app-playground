// Placeholder for the Map view (M-later). Wired into the view switcher and fed the same
// filtered entries as the other views, so the moment the real map lands it has its data —
// but for now it only previews the idea: your finds pinned across the city, colour-coded
// like the calendar (blue = planned, red = expiring). No map logic yet, by design.
// (SVG colours come from CSS classes, since var() doesn't resolve inside SVG attributes.)
export default function MapView({ entries }) {
  const withPlace = (entries || []).filter(e => e && e.place)
  const n = withPlace.length

  return (
    <div className="map-view">
      <div className="map-illo" aria-hidden="true">
        <svg viewBox="0 0 320 180" width="100%" role="img">
          <g className="mi-streets" fill="none" strokeLinecap="round">
            <path d="M0 60 H320" /><path d="M0 120 H320" />
            <path d="M90 0 V180" /><path d="M210 0 V180" />
            <path className="mi-diag" d="M0 20 L120 90 L200 60 L320 140" />
          </g>
          <path className="mi-river" d="M-10 150 C 60 120, 120 175, 200 140 S 320 120, 340 150" fill="none" strokeLinecap="round" />
          <g className="mi-pin mi-blue">
            <circle className="mi-halo" cx="130" cy="90" r="16" />
            <path className="mi-body" d="M130 74 a10 10 0 0 1 10 10 c0 7 -10 16 -10 16 s-10 -9 -10 -16 a10 10 0 0 1 10 -10 z" />
            <circle className="mi-dot" cx="130" cy="84" r="3.4" />
          </g>
          <g className="mi-pin mi-red">
            <circle className="mi-halo" cx="212" cy="64" r="14" />
            <path className="mi-body" d="M212 50 a9 9 0 0 1 9 9 c0 6 -9 14 -9 14 s-9 -8 -9 -14 a9 9 0 0 1 9 -9 z" />
            <circle className="mi-dot" cx="212" cy="59" r="3" />
          </g>
        </svg>
      </div>
      <h2>Map <em>view</em></h2>
      <p className="map-lede">A map of the city with your finds pinned where they are — grouped by place, colour-coded the way the calendar is: <span className="dot planned" /> planned and <span className="dot expires" /> expiring. Tap a pin, see what's there. Coming soon.</p>
      <p className="map-count">{n === 0 ? 'No places to map yet — add a place to an item.' : `${n} ${n === 1 ? 'place' : 'places'} ready to map`}</p>
    </div>
  )
}
