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

// A frequency heatmap of tags/people: every value shown as a chip shaded by how
// often it appears (most-noticed = most intense). Nothing is cut off, so even a
// once-mentioned name stays visible. `--heat` (0..1) drives the shading in CSS.
// Tapping a chip filters the list by it, same as the chips on an entry itself.
function HeatChips({ items, kind, label, onChip }) {
  if (!items.length) return null
  const max = items[0].count // items arrive sorted by count desc
  return (
    <div className="stat-card span">
      <div className="stat-label bare">{label}</div>
      <div className="stat-chips heat">
        {items.map(it => (
          <button
            key={it.name}
            type="button"
            className={`chip ${kind}`}
            style={{ '--heat': max > 1 ? (it.count - 1) / (max - 1) : 0 }}
            title={`Filter by ${it.name} — ${it.count} ${it.count === 1 ? 'time' : 'times'}`}
            onClick={() => onChip(kind === 'person' ? 'people' : 'tags', it.name)}
          >
            {it.name} · {it.count}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function StatsModal({ entries, onClose, onChip }) {
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
          <Stat value={s.avgWords} label="average words per delight" />
          <Stat value={`${s.shortest}–${s.longest}`} label="shortest and longest" />
          <Stat value={s.totalWords.toLocaleString()} label="words in all delights" />
          {/* motifs — frequency heatmaps over every tag / person */}
          <HeatChips items={s.topTags} kind="tag" label="most-noticed tags" onChip={(scope, value) => { onChip(scope, value); onClose() }} />
          <HeatChips items={s.topPeople} kind="person" label="people who appear most" onChip={(scope, value) => { onChip(scope, value); onClose() }} />
        </div>
      )}
    </Modal>
  )
}
