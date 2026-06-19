import CardScene from './CardScene.jsx'

export default function TarotCard({ title, children }) {
  return (
    <div className="tg-card">
      <span className="tg-corner tl" />
      <span className="tg-corner tr" />
      <span className="tg-corner bl" />
      <span className="tg-corner br" />
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
