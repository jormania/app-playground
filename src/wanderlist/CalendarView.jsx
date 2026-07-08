import { useState, useMemo } from 'react'
import { monthGrid, stepMonth, monthLabel, keyToDate, formatHuman, entriesOnDay, expiryLabel, daysUntil } from './dates.js'
import { BackIcon, ExternalIcon, HourglassIcon, CalendarIcon, CheckCircleIcon } from './icons.jsx'
import MetaChips from './MetaChips.jsx'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Month calendar (M2). Each day box carries up to two markers — a Planned dot and an
// Expiring dot, in different colours — and selecting a day opens an agenda beneath the
// grid listing that day's entries (both Planned-Date and Date-Expiring matches, labelled).
export default function CalendarView({ entries, today, onOpen, onChip }) {
  const initial = keyToDate(today) || new Date()
  const [month, setMonth] = useState({ year: initial.getFullYear(), month: initial.getMonth() })
  const [selected, setSelected] = useState(today)

  // Marker lookup: which days carry a planned / an expiring entry.
  const { plannedKeys, expiringKeys } = useMemo(() => {
    const planned = new Set(), expiring = new Set()
    for (const e of entries || []) {
      if (e?.plannedDate) planned.add(e.plannedDate)
      if (e?.dateExpiring) expiring.add(e.dateExpiring)
    }
    return { plannedKeys: planned, expiringKeys: expiring }
  }, [entries])

  const weeks = useMemo(() => monthGrid(month.year, month.month, 1), [month])
  const agenda = useMemo(() => entriesOnDay(entries, selected), [entries, selected])

  function pick(cell) {
    setSelected(cell.key)
    if (!cell.inMonth) {
      const d = keyToDate(cell.key)
      if (d) setMonth({ year: d.getFullYear(), month: d.getMonth() })
    }
  }
  function goToday() {
    const d = keyToDate(today) || new Date()
    setMonth({ year: d.getFullYear(), month: d.getMonth() })
    setSelected(today)
  }

  const onThisMonth = month.year === (keyToDate(today)?.getFullYear()) && month.month === (keyToDate(today)?.getMonth())

  return (
    <div className="calendar">
      <div className="cal-head">
        <h2>{monthLabel(month.year, month.month)}</h2>
        <div className="cal-nav">
          <button className="cal-today-btn" onClick={goToday} disabled={onThisMonth && selected === today}>Today</button>
          <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(m => stepMonth(m, -1))}><BackIcon /></button>
          <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(m => stepMonth(m, 1))}><BackIcon style={{ transform: 'scaleX(-1)' }} /></button>
        </div>
      </div>

      <div className="cal-grid cal-dow-row">
        {WEEKDAYS.map(d => <div key={d} className="cal-dow">{d}</div>)}
      </div>
      <div className="cal-grid">
        {weeks.flat().map(cell => {
          const planned = plannedKeys.has(cell.key)
          const expiring = expiringKeys.has(cell.key)
          const cls = [
            'cal-cell',
            cell.inMonth ? 'in' : 'out',
            cell.key < today ? 'past' : '',
            cell.key === today ? 'today' : '',
            cell.key === selected ? 'selected' : '',
          ].join(' ')
          return (
            <button key={cell.key} className={cls} onClick={() => pick(cell)} aria-label={cell.key}>
              <span className="cal-day">{cell.day}</span>
              {(planned || expiring) && (
                <span className="cal-dots">
                  {planned && <span className="cal-dot planned" title="Something planned" />}
                  {expiring && <span className="cal-dot expires" title="Something expires" />}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="cal-legend">
        <span><span className="cal-dot planned" /> planned</span>
        <span><span className="cal-dot expires" /> expires</span>
      </div>

      <div className="cal-agenda">
        <div className="cal-agenda-head">{formatHuman(selected)}</div>
        {agenda.length === 0 ? (
          <p className="cal-agenda-empty">Nothing planned or expiring on this day.</p>
        ) : (
          agenda.map(({ entry, planned, expiring }) => {
            const n = expiring ? daysUntil(entry.dateExpiring, today) : null
            const urgency = n == null ? '' : n < 0 ? 'expired' : n <= 3 ? 'soon' : n <= 14 ? 'near' : 'far'
            return (
              <div
                key={entry.id}
                className={`agenda-card${entry.attended ? ' attended' : ''}`}
                role="button" tabIndex={0}
                onClick={() => onOpen(entry)}
                onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen(entry) } }}
              >
                <div className="agenda-main">
                  <div className="agenda-top">
                    <span className="agenda-name">{entry.name || 'Untitled'}</span>
                    {entry.link && (
                      <a className="row-link" href={entry.link} target="_blank" rel="noopener" title="Open link" onClick={ev => ev.stopPropagation()}><ExternalIcon /></a>
                    )}
                  </div>
                  <div className="row-badges">
                    {entry.attended && <span className="attended-pill"><CheckCircleIcon /> attended</span>}
                    {planned && <span className="planned-pill"><CalendarIcon /> planned</span>}
                    {expiring && <span className={`expiry-pill ${urgency}`}><HourglassIcon /> {expiryLabel(entry.dateExpiring, today)}</span>}
                  </div>
                  <MetaChips category={entry.category} place={entry.place} tags={entry.tags} onChip={onChip} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
