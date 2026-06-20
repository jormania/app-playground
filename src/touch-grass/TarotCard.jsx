import CardScene from './CardScene.jsx'

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
      <div className="tg-card-inner">
        <div className="tg-card-scene">
          <CardScene showSigns={showSigns} motionOn={motionOn} />
        </div>
        <div className="tg-readscrim" />
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
