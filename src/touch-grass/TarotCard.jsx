import CardScene from './CardScene.jsx'

// The Keeper — a golden key whose bow is a little radiant sun, in the same
// gold/amber language as the Tonight-sky glyphs.
function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="tg-key-bow" cx="40%" cy="36%" r="72%">
          <stop offset="0" stopColor="#ffe9ad" />
          <stop offset="0.6" stopColor="#f0b429" />
          <stop offset="1" stopColor="#c89a2c" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="7" r="4.6" fill="none" stroke="url(#tg-key-bow)" strokeWidth="2.3" />
      <circle cx="12" cy="7" r="1.5" fill="#ffe9ad" />
      <g stroke="#e7c24a" strokeWidth="2.2" strokeLinecap="round">
        <line x1="12" y1="11.6" x2="12" y2="20" />
        <line x1="12" y1="16.4" x2="15.6" y2="16.4" />
        <line x1="12" y1="19.2" x2="14.4" y2="19.2" />
      </g>
    </svg>
  )
}

// The Reliquary — a single tarot card tilted at an angle, drawn as a clean gold
// outline with empty (transparent) space inside, so it reads at a glance.
function ReliquaryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7.4" y="3.6" width="9.2" height="16.8" rx="2"
        fill="none" stroke="#e7c24a" strokeWidth="2.2"
        transform="rotate(-15 12 12)" />
    </svg>
  )
}

// fill: false (default text panel, bottom-anchored) | true (the whole card,
// top to bottom — used by the Reliquary and the Chorus mixer, both of which
// need the full card for their scrollable list/sliders, title-less, banner-named)
export default function TarotCard({ title, showSigns = true, motionOn = true, fill = false, onSettings, onReliquary, children }) {
  const contentClass = fill ? 'tg-card-content tg-full' : 'tg-card-content'
  return (
    <div className="tg-card">
      <div className="tg-card-inner">
        <div className="tg-card-scene">
          <CardScene showSigns={showSigns} motionOn={motionOn} />
        </div>
        <div className="tg-readscrim" />
        <div className={contentClass}>{children}</div>
        <div className="tg-card-banner">{title}</div>
        {onReliquary && (
          <button className="tg-card-lens" onClick={onReliquary} title="The Reliquary" aria-label="Walk history">
            <ReliquaryIcon />
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
