import { useState } from 'react'

const TIER_LABEL = {
  common:    { text: 'Common',    color: null },
  uncommon:  { text: 'Uncommon',  color: '#3ab0c0' },
  rare:      { text: 'Rare',      color: '#c49830' },
  legendary: { text: 'Legendary', color: '#c060e0' },
}

function fmtDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDur(min) {
  if (min < 1) return 'under a minute'
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
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
          {history.map((w, i) => {
            const t = TIER_LABEL[w.tier] || TIER_LABEL.common
            return (
              <div className="tg-relic" key={`${w.ts}-${i}`}>
                <div className="tg-relic-meta">
                  <span>{fmtDate(w.ts)}</span>
                  <span>{fmtDur(w.durationMinutes)}</span>
                  <span style={t.color ? { color: t.color } : undefined}>{t.text}</span>
                </div>
                <div className="tg-relic-name">{w.discovery.name}</div>
                <div className="tg-relic-desc">{w.discovery.description}</div>
              </div>
            )
          })}
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
