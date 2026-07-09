import { useState, useMemo } from 'react'
import { monthGrid, stepMonth, monthLabel, keyToDate, formatHuman, formatTime, entriesOnDay, expiryLabel, daysUntil } from './dates.js'
import { BackIcon, ExternalIcon, HourglassIcon, CalendarIcon, CheckCircleIcon, TicketIcon } from './icons.jsx'
import MetaChips from './MetaChips.jsx'
import { openTickets } from './links.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Month calendar (M2). Each day box carries up to three markers — a Planned dot, an
// Expiring dot, and a Paid dot (something with tickets on file lands that day) — and
// selecting a day opens an agenda beneath the grid listing that day's entries (Planned-
// Date and Date-Expiring matches, labelled; Paid is a per-entry chip in that agenda, not
// a day-matching role of its own).
export default function CalendarView({ entries, today, onOpen, onChip }) {
  const initial = keyToDate(today) || new Date()
  const [month, setMonth] = useState({ year: initial.getFullYear(), month: initial.getMonth() })
  const [selected, setSelected] = useState(today)

  // Marker lookup: which days carry a planned / an expiring / a paid entry. Paid rides
  // whichever date the entry itself lands on (planned, else expiring) — tickets don't have
  // their own date field.
  //
  // Attended items are suppressed from today/future days — with the status filter set to
  // "All", a done thing's planned/expiring date no longer means anything going forward, so
  // it shouldn't still light up a dot on a day yet to come. A day already past keeps its
  // dot regardless — that's a quiet, honest record of what happened, not a forecast.
  const { plannedKeys, goingKeys, expiringKeys, paidKeys } = useMemo(() => {
    const planned = new Set(), going = new Set(), expiring = new Set(), paid = new Set()
    const suppress = (entry, key) => Boolean(entry?.attended) && key >= today
    for (const e of entries || []) {
      const pd = e?.plannedDate, ed = e?.dateExpiring
      if (pd && !suppress(e, pd)) {
        planned.add(pd)
        if (e?.going) going.add(pd)
      }
      if (ed && !suppress(e, ed)) expiring.add(ed)
      if (e?.tickets?.length > 0) {
        if (pd && !suppress(e, pd)) paid.add(pd)
        else if (ed && !suppress(e, ed)) paid.add(ed)
      }
    }
    return { plannedKeys: planned, goingKeys: going, expiringKeys: expiring, paidKeys: paid }
  }, [entries, today])

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
          const going = goingKeys.has(cell.key)
          const expiring = expiringKeys.has(cell.key)
          const paid = paidKeys.has(cell.key)
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
              {(planned || expiring || paid) && (
                <span className="cal-dots">
                  {planned && <span className={`cal-dot planned${going ? ' going' : ''}`} title={going ? 'Something you’re going to' : 'Something planned, undecided'} />}
                  {expiring && <span className="cal-dot expires" title="Something expires" />}
                  {paid && <span className="cal-dot paid" title="Something paid for" />}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="cal-legend">
        <span><span className="cal-dot planned" /> planned</span>
        <span><span className="cal-dot planned going" /> going</span>
        <span><span className="cal-dot expires" /> expires</span>
        <span><span className="cal-dot paid" /> paid</span>
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
                    {planned && (
                      <span className={`planned-pill${entry.going ? ' going' : ''}`}>
                        <CalendarIcon /> {entry.going ? 'going' : 'planned'}{entry.plannedTime ? ` · ${formatTime(entry.plannedTime)}` : ''}
                      </span>
                    )}
                    {entry.tickets?.length > 0 && (
                      <button
                        type="button"
                        className="paid-pill"
                        title={`Paid — ${entry.tickets.length} ticket${entry.tickets.length === 1 ? '' : 's'} — tap to open`}
                        onClick={ev => { ev.stopPropagation(); openTickets(entry, onOpen) }}
                      ><TicketIcon /> paid</button>
                    )}
                    {expiring && <span className={`expiry-pill ${urgency}`}><HourglassIcon /> {expiryLabel(entry.dateExpiring, today)}</span>}
                  </div>
                  <MetaChips category={entry.category} place={entry.place} placeUrl={entry.placeUrl} tags={entry.tags} onChip={onChip} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
