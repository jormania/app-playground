import { useMemo } from 'react'
import { computeStats } from './stats.js'
import { CloseIcon } from './icons.jsx'

// A quiet portrait of the practice — counts and averages only. Three core metrics
// plus the extras chosen for this app: top tags/people, total words, days since
// the first delight, and the range of entry lengths.
function Stat({ value, label, wide }) {
  return (
    <div className={`stat-card${wide ? ' wide' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function StatsModal({ entries, onClose }) {
  const s = useMemo(() => computeStats(entries), [entries])

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Stats</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        {s.total === 0 ? (
          <p>No delights yet — once you’ve written a few, their shape will show up here.</p>
        ) : (
          <div className="stats-grid">
            <Stat value={s.total} label="delights in all" />
            <Stat value={s.last7} label="in the last 7 days" />
            <Stat value={s.avgWords} label="avg words / entry" />
            <Stat value={s.totalWords.toLocaleString()} label="words written in all" />
            {s.daysSinceFirst != null && <Stat value={s.daysSinceFirst} label="days since the first" />}
            <Stat value={`${s.shortest}–${s.longest}`} label="shortest–longest (words)" />

            {s.topTags.length > 0 && (
              <div className="stat-card wide">
                <div className="stat-label" style={{ marginTop: 0, marginBottom: 4 }}>most-noticed tags</div>
                <div className="stat-chips">
                  {s.topTags.map(t => <span key={t.name} className="chip tag">{t.name} · {t.count}</span>)}
                </div>
              </div>
            )}
            {s.topPeople.length > 0 && (
              <div className="stat-card wide">
                <div className="stat-label" style={{ marginTop: 0, marginBottom: 4 }}>people who appear most</div>
                <div className="stat-chips">
                  {s.topPeople.map(p => <span key={p.name} className="chip person">{p.name} · {p.count}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
