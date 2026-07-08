import { useMemo } from 'react'
import { computeStats } from './stats.js'
import Modal from './Modal.jsx'
import { categoryIcon } from './categoryIcons.js'

// A forward-looking portrait of the backlog — what's coming up, what needs attention,
// what's still someday. Attended items carry no weight anywhere on this screen; once
// you've gone, it's dropped from the picture, same as everywhere else in the app.
function Stat({ value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function NextUp({ nextUp }) {
  if (!nextUp) return null
  const when = nextUp.days === 0 ? 'today' : nextUp.days === 1 ? 'tomorrow' : `in ${nextUp.days} days`
  return (
    <div className="stat-card span">
      <div className="stat-value">{nextUp.name}</div>
      <div className="stat-label">next up · expires {when}</div>
    </div>
  )
}

// A frequency heatmap over Category, Tags, or Place: every value shown as a chip shaded
// by how often it turns up in the active backlog (most-common = most intense). Tapping a
// chip filters the list by it — the same gesture, and the same chip.js system, as
// Journal of Delights' Stats screen (ported: kind/scope generalised beyond tag/person to
// cover category and place too, and category chips carry their type icon).
function HeatChips({ items, kind, scope, label, onChip }) {
  if (!items.length) return null
  const max = items[0].count
  return (
    <div className="stat-card span">
      <div className="stat-label bare">{label}</div>
      <div className="stat-chips heat">
        {items.map(it => {
          const Icon = kind === 'category' ? categoryIcon(it.name) : null
          return (
            <button
              key={it.name}
              type="button"
              className={`chip ${kind}`}
              style={{ '--heat': max > 1 ? (it.count - 1) / (max - 1) : 0 }}
              title={`Search ${it.name} — ${it.count} ${it.count === 1 ? 'thing' : 'things'}`}
              onClick={() => onChip(scope, it.name)}
            >
              {Icon && <Icon />}{it.name} · {it.count}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function StatsModal({ entries, onClose, onChip }) {
  const s = useMemo(() => computeStats(entries), [entries])

  function chip(scope, value) { onChip(scope, value); onClose() }

  return (
    <Modal title="Stats" onClose={onClose}>
      {s.total === 0 ? (
        <p>Nothing open on your backlog yet — add a few things and their shape will show up here.</p>
      ) : (
        <div className="stats-grid">
          <Stat value={s.total} label="curiosities to explore" />
          <NextUp nextUp={s.nextUp} />
          <Stat value={s.expiringSoon} label="expiring within 7 days" />
          <Stat value={s.needsAttention} label="past due, still open" />
          <Stat value={s.plannedSoon} label="planned within 7 days" />
          <Stat value={s.noDeadline} label="no deadline — someday" />
          <Stat value={s.paidUpcoming} label="already paid for" />
          <HeatChips items={s.topCategories} kind="category" scope="category" label="by category" onChip={chip} />
          <HeatChips items={s.topTags} kind="tag" scope="tags" label="by tag" onChip={chip} />
          <HeatChips items={s.topPlaces} kind="place" scope="place" label="where" onChip={chip} />
        </div>
      )}
    </Modal>
  )
}
