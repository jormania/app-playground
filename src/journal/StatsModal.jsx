import { useMemo } from 'react'
import { computeStats } from './stats.js'
import Modal from './Modal.jsx'

// A quiet portrait of the practice — counts and averages only (no streaks/scores).
// Ordered by nature: quantity & cadence first, then word measures, then the motifs.
function Stat({ value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function StatsModal({ entries, onClose }) {
  const s = useMemo(() => computeStats(entries), [entries])

  return (
    <Modal title="Stats" onClose={onClose}>
      {s.total === 0 ? (
        <p>No delights yet — once you’ve written a few, their shape will show up here.</p>
      ) : (
        <div className="stats-grid">
          {/* quantity & cadence */}
          <Stat value={s.total} label="delights in all" />
          <Stat value={s.last7} label="in the last 7 days" />
          {s.daysSinceFirst != null && <Stat value={s.daysSinceFirst} label="days journalling" />}
          {/* word measures */}
          <Stat value={s.avgWords} label="average words per entry" />
          <Stat value={`${s.shortest}–${s.longest}`} label="shortest–longest" />
          <Stat value={s.totalWords.toLocaleString()} label="words in all" />
          {/* motifs */}
          {s.topTags.length > 0 && (
            <div className="stat-card span">
              <div className="stat-label bare">most-noticed tags</div>
              <div className="stat-chips">
                {s.topTags.map(t => <span key={t.name} className="chip tag">{t.name} · {t.count}</span>)}
              </div>
            </div>
          )}
          {s.topPeople.length > 0 && (
            <div className="stat-card span">
              <div className="stat-label bare">people who appear most</div>
              <div className="stat-chips">
                {s.topPeople.map(p => <span key={p.name} className="chip person">{p.name} · {p.count}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
