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

// The Reliquary — a small fan of kept cards (the deck you've gathered), the front
// one bearing a star, in parchment cream with gold edges.
function ReliquaryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g transform="rotate(-13 12 13)">
        <rect x="4.8" y="6" width="8.6" height="13" rx="1.6" fill="#efe6cc" stroke="#c89a2c" strokeWidth="1" />
      </g>
      <g transform="rotate(11 12 13)">
        <rect x="10" y="5.4" width="8.6" height="13" rx="1.6" fill="#fbf4dd" stroke="#e7c24a" strokeWidth="1.2" />
        <path d="M14.3 9.2 L15.05 11.4 L17.3 12 L15.05 12.6 L14.3 14.8 L13.55 12.6 L11.3 12 L13.55 11.4 Z" fill="#e7c24a" />
      </g>
    </svg>
  )
}

export default function TarotCard({ title, showSigns = true, motionOn = true, fill = false, onSettings, onReliquary, children }) {
  return (
    <div className="tg-card">
      <div className="tg-card-inner">
        <div className="tg-card-scene">
          <CardScene showSigns={showSigns} motionOn={motionOn} />
        </div>
        <div className="tg-readscrim" />
        <div className={fill ? 'tg-card-content tg-fill' : 'tg-card-content'}>{children}</div>
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
