import { useMemo } from 'react'
import { computeStats } from './stats.js'
import Modal from './Modal.jsx'
import { categoryGlyph } from './categoryIcons.js'

// A forward-looking portrait of the backlog — what's coming up, what needs attention,
// what's still someday. Attended items carry no weight anywhere on this screen; once
// you've gone, it's dropped from the picture, same as everywhere else in the app.
//
// Layout note: the six count cards below fill two complete 3-column rows before any
// full-width ("span") card appears — a span card mid-grid forces a line break and leaves
// a dangling empty cell in whichever row it interrupts, so "next up" and the heat cards
// all sit after the counts, not between them.
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

// One chip button, coloured/iconed by kind, sized by --heat within its own group (so
// Category's busiest value and Tag's busiest value are each fully saturated, rather than
// competing against each other's raw counts).
function HeatChip({ it, max, kind, scope, onChip }) {
  return (
    <button
      type="button"
      className={`chip ${kind}`}
      style={{ '--heat': max > 1 ? (it.count - 1) / (max - 1) : 0 }}
      title={`Search ${it.name} — ${it.count} ${it.count === 1 ? 'thing' : 'things'}`}
      onClick={() => onChip(scope, it.name)}
    >
      {kind === 'category' && categoryGlyph(it.name)}{it.name} · {it.count}
    </button>
  )
}

// A frequency heatmap card over one or more chip groups: every value shown as a chip
// shaded by how often it turns up in the active backlog. Tapping a chip searches by it —
// the same gesture, and the same chip system, as Journal of Delights' Stats screen. Two
// groups (Category + Tags) share one card, merged onto one row in that order — the same
// pairing MetaChips uses on an entry itself; Place gets its own card, same as it gets its
// own row there too.
function HeatCard({ groups, label, onChip }) {
  const visible = groups.filter(g => g.items.length > 0)
  if (!visible.length) return null
  return (
    <div className="stat-card span">
      <div className="stat-label bare">{label}</div>
      <div className="stat-chips heat">
        {visible.flatMap(g => {
          const max = g.items[0].count
          return g.items.map(it => (
            <HeatChip key={`${g.kind}-${it.name}`} it={it} max={max} kind={g.kind} scope={g.scope} onChip={onChip} />
          ))
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
          <Stat value={s.expiringSoon} label="expiring within 7 days" />
          <Stat value={s.needsAttention} label="past due, still open" />
          <Stat value={s.plannedSoon} label="planned within 7 days" />
          <Stat value={s.noDeadline} label="no deadline — someday" />
          <Stat value={s.paidUpcoming} label="already paid for" />
          <NextUp nextUp={s.nextUp} />
          <HeatCard
            label="by category & tag"
            onChip={chip}
            groups={[
              { items: s.topCategories, kind: 'category', scope: 'category' },
              { items: s.topTags, kind: 'tag', scope: 'tags' },
            ]}
          />
          <HeatCard label="where" onChip={chip} groups={[{ items: s.topPlaces, kind: 'place', scope: 'place' }]} />
        </div>
      )}
    </Modal>
  )
}
