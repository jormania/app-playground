import CardScene from './CardScene.jsx'

const ROT = { tl: 0, tr: 90, br: 180, bl: 270 }

function CornerMark({ pos }) {
  return (
    <svg className={`tg-corner ${pos}`} viewBox="0 0 34 34" aria-hidden="true">
      <g transform={`rotate(${ROT[pos]} 17 17)`}>
        {/* L-bracket arms with inward curls */}
        <path d="M9 9 H27" stroke="#e0533a" strokeWidth="2.3" strokeLinecap="round" fill="none" />
        <path d="M9 9 V27" stroke="#e0533a" strokeWidth="2.3" strokeLinecap="round" fill="none" />
        <path d="M27 9 q4.5 0 4.5 4.5" stroke="#e0533a" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M9 27 q0 4.5 4.5 4.5" stroke="#e0533a" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* four-point star at the elbow, with a gold pip */}
        <path d="M9 1.5 Q10.3 7.7 16.5 9 Q10.3 10.3 9 16.5 Q7.7 10.3 1.5 9 Q7.7 7.7 9 1.5 Z"
          fill="#e0533a" />
        <circle cx="9" cy="9" r="1.7" fill="#e2a92f" />
      </g>
    </svg>
  )
}

export default function TarotCard({ title, showSigns = true, children }) {
  return (
    <div className="tg-card">
      <CornerMark pos="tl" />
      <CornerMark pos="tr" />
      <CornerMark pos="bl" />
      <CornerMark pos="br" />
      <div className="tg-card-inner">
        <div className="tg-card-scene">
          <CardScene showSigns={showSigns} />
        </div>
        <div className="tg-card-content">{children}</div>
        <div className="tg-card-banner">{title}</div>
      </div>
    </div>
  )
}
