// "The Chorus" — the ambient soundscape's mixer. Every slider is a multiplier
// layered OVER the already-tuned sound in ambientAudio.js, not a replacement
// for it: at the defaults (10 on every category/volume, 5 on Activity, 10 on
// Warmth) nothing about today's mix changes at all — see the Chorus notes at
// the top of ambientAudio.js and DEFAULT_MIX in App.jsx.
const CATEGORIES = [
  { key: 'place', label: 'Place', hint: 'surf, traffic hum, thin wind, rustle underfoot' },
  { key: 'weather', label: 'Weather', hint: 'rain, wind, thunder, the winter chime' },
  { key: 'wildlife', label: 'Wildlife', hint: 'birds, crickets, critters passing by' },
  { key: 'city', label: 'City', hint: 'traffic drifting past, planes overhead' },
  { key: 'events', label: 'Omens', hint: 'bells, howls, meteor-shimmer — the rare surprises' },
]
const SHAPERS = [
  { key: 'volume', label: 'Volume', hint: 'overall loudness', max: 10, mid: false },
  { key: 'activity', label: 'Activity', hint: 'how often the world speaks up', max: 10, mid: true },
  { key: 'warmth', label: 'Warmth', hint: 'hushed and close, or bright and open', max: 10, mid: false },
]

export default function MixerPanel({ mix, onChange, onReset, onClose }) {
  const setLevel = (key, value) => onChange({ [key]: value })

  const renderRow = ({ key, label, hint, max = 10 }) => {
    const value = typeof mix[key] === 'number' ? mix[key] : Math.round(max / 2)
    const pct = (value / max) * 100
    return (
      <div key={key} className="tg-mixer-row">
        <span className="tg-mixer-label">
          {label}
          <span className="tg-mixer-value">{value}</span>
        </span>
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          onChange={(e) => setLevel(key, Number(e.target.value))}
          className="tg-mixer-slider"
          style={{ background: `linear-gradient(to right, #ecc356 ${pct}%, rgba(243, 234, 212, 0.18) ${pct}%)` }}
          aria-label={`${label} — ${hint}`}
        />
        <span className="tg-mixer-hint">{hint}</span>
      </div>
    )
  }

  return (
    <div className="tg-mixer">
      <h1>The Chorus</h1>
      <p className="tg-hint">Balance what you hear along the way.</p>
      <div className="tg-mixer-list">
        <span className="tg-mixer-group">the field</span>
        {CATEGORIES.map(renderRow)}
        <span className="tg-mixer-group">shapers</span>
        {SHAPERS.map(renderRow)}
      </div>
      <div className="tg-row">
        <button type="button" onClick={onReset}>Reset</button>
        <button type="button" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
