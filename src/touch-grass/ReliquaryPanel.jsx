import { useState } from 'react'

const TIER_LABEL = {
  common:    { text: 'Common',    color: null },
  uncommon:  { text: 'Uncommon',  color: '#3ab0c0' },
  rare:      { text: 'Rare',      color: '#c49830' },
  legendary: { text: 'Legendary', color: '#c060e0' },
}

function fmtDay(ts) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDur(min) {
  if (min < 1) return 'under a minute'
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// a star polygon centred in a 16×16 box, used to mark each find by rarity
function starPath(points, outer, inner) {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    d += (i === 0 ? 'M' : 'L') + (8 + Math.cos(a) * r).toFixed(2) + ' ' + (8 + Math.sin(a) * r).toFixed(2) + ' '
  }
  return d + 'Z'
}

// rarity rises with the points: a seed, then 4-, 6- and 8-pointed stars
const TIER_GLYPH = {
  uncommon:  starPath(4, 6.6, 2.0),
  rare:      starPath(6, 6.9, 2.7),
  legendary: starPath(8, 7.0, 2.7),
}

function TierIcon({ tier }) {
  const meta = TIER_LABEL[tier] || TIER_LABEL.common
  const color = meta.color || '#c7cdba'
  const glyph = TIER_GLYPH[tier]
  return (
    <svg className="tg-relic-mark" viewBox="0 0 16 16" aria-hidden="true">
      {glyph ? <path d={glyph} fill={color} /> : <circle cx="8" cy="8" r="2.3" fill={color} />}
    </svg>
  )
}

// a slender sparkle that sets date · time · duration apart
const SEP_GLYPH = starPath(4, 6, 1.5)
function Sep() {
  return (
    <svg className="tg-relic-sep" viewBox="0 0 16 16" aria-hidden="true">
      <path d={SEP_GLYPH} fill="currentColor" />
    </svg>
  )
}

export default function ReliquaryPanel({ history, onClearLast, onClearAll, onClose }) {
  const [confirm, setConfirm] = useState(null)
  const count = history.length

  return (
    <div className="tg-reliquary">
      <h1>The Reliquary</h1>
      <p className="tg-hint">{count
        ? `${count} relic${count > 1 ? 's' : ''} kept — newest first`
        : 'Nothing kept yet — your finds will gather here.'}</p>

      {count > 0 && (
        <div className="tg-relics">
          {history.map((w, i) => (
            <div className="tg-relic" key={`${w.ts}-${i}`}>
              <div className="tg-relic-meta">
                <span>{fmtDay(w.ts)}</span>
                <Sep />
                <span>{fmtTime(w.ts)}</span>
                <Sep />
                <span>{fmtDur(w.durationMinutes)}</span>
              </div>
              <div className="tg-relic-name">
                <TierIcon tier={w.tier} />
                <span>{w.discovery.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="tg-row tg-relic-actions">
        {confirm === 'all' ? (
          <span className="tg-confirm">Clear all?
            <button type="button" onClick={() => { onClearAll(); setConfirm(null) }}>yes</button>
            <button type="button" onClick={() => setConfirm(null)}>no</button>
          </span>
        ) : confirm === 'last' ? (
          <span className="tg-confirm">Clear the last?
            <button type="button" onClick={() => { onClearLast(); setConfirm(null) }}>yes</button>
            <button type="button" onClick={() => setConfirm(null)}>no</button>
          </span>
        ) : (
          <>
            {count > 0 && <button type="button" onClick={() => setConfirm('last')}>Clear last</button>}
            {count > 0 && <button type="button" onClick={() => setConfirm('all')}>Clear all</button>}
            <button type="button" onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  )
}
