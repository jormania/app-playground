import CardScene from './CardScene.jsx'

const ROT = { tl: 0, tr: 90, br: 180, bl: 270 }

function CornerMark({ pos }) {
  return (
    <svg className={`tg-corner ${pos}`} viewBox="0 0 28 28" aria-hidden="true">
      <g transform={`rotate(${ROT[pos]} 14 14)`}>
        <path d="M7 7 H20" stroke="#c4a96a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M7 7 V20" stroke="#c4a96a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M7 3.4 Q7.7 6.3 10.6 7 Q7.7 7.7 7 10.6 Q6.3 7.7 3.4 7 Q6.3 6.3 7 3.4 Z"
          fill="#e2a92f" />
      </g>
    </svg>
  )
}

export default function TarotCard({ title, children }) {
  return (
    <div className="tg-card">
      <CornerMark pos="tl" />
      <CornerMark pos="tr" />
      <CornerMark pos="bl" />
      <CornerMark pos="br" />
      <div className="tg-card-inner">
        <div className="tg-card-scene">
          <CardScene />
        </div>
        <div className="tg-card-content">{children}</div>
        <div className="tg-card-banner">{title}</div>
      </div>
    </div>
  )
}
