import CardScene from './CardScene.jsx'

const DARK = '#241812'

// sun rays: 8 short strokes around the disc
const SUN_RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2
  const c = Math.cos(a), s = Math.sin(a)
  return { x1: 8 + 3.7 * c, y1: 8 + 3.7 * s, x2: 8 + 5.7 * c, y2: 8 + 5.7 * s }
})

const GLYPHS = {
  // crescent moon
  tl: <path d="M10 2.4 A5.8 5.8 0 1 0 10 13.6 A4.4 5.6 0 1 1 10 2.4 Z" fill={DARK} />,
  // four-point star
  tr: <path d="M8 1.2 Q8.9 7.1 14.8 8 Q8.9 8.9 8 14.8 Q7.1 8.9 1.2 8 Q7.1 7.1 8 1.2 Z" fill={DARK} />,
  // sun with rays
  bl: (
    <g>
      <circle cx="8" cy="8" r="2.7" fill={DARK} />
      {SUN_RAYS.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={DARK} strokeWidth="1.4" strokeLinecap="round" />
      ))}
    </g>
  ),
  // watching eye
  br: (
    <g>
      <path d="M1.4 8 Q8 3 14.6 8 Q8 13 1.4 8 Z" fill="none" stroke={DARK} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2.2" fill={DARK} />
    </g>
  ),
}

function CornerGlyph({ pos }) {
  return (
    <svg className={`tg-glyph ${pos}`} viewBox="0 0 16 16" aria-hidden="true">
      {GLYPHS[pos]}
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#e0533a" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="6.5" r="3.7" />
      <circle cx="12" cy="6.5" r="0.7" fill="#e0533a" stroke="none" />
      <line x1="12" y1="10.2" x2="12" y2="20" />
      <line x1="12" y1="15.5" x2="15.5" y2="15.5" />
      <line x1="12" y1="18.3" x2="14.3" y2="18.3" />
    </svg>
  )
}

function LensIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#3a9fb0" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="6" />
      <circle cx="10" cy="10" r="2.2" fill="#3a9fb0" stroke="none" opacity="0.5" />
      <line x1="14.5" y1="14.5" x2="20" y2="20" />
    </svg>
  )
}

export default function TarotCard({ title, showSigns = true, motionOn = true, fill = false, onSettings, onReliquary, children }) {
  return (
    <div className="tg-card">
      <CornerGlyph pos="tl" />
      <CornerGlyph pos="tr" />
      <CornerGlyph pos="bl" />
      <CornerGlyph pos="br" />
      <div className="tg-card-inner">
        <div className="tg-card-scene">
          <CardScene showSigns={showSigns} motionOn={motionOn} />
        </div>
        <div className={fill ? 'tg-card-content tg-fill' : 'tg-card-content'}>{children}</div>
        <div className="tg-card-banner">{title}</div>
        {onReliquary && (
          <button className="tg-card-lens" onClick={onReliquary} title="The Reliquary" aria-label="Walk history">
            <LensIcon />
          </button>
        )}
        {onSettings && (
          <button className="tg-card-key" onClick={onSettings} title="The Keeper" aria-label="Settings">
            <KeyIcon />
          </button>
        )}
      </div>
    </div>
  )
}
