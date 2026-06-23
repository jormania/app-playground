import { useState } from 'react'
import { monthGrid, monthLabel, stepMonth, findByDate, todayKey } from './dates.js'
import { getWeekStart } from './store.js'
import { BackIcon } from './icons.jsx'

const DOW_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Alternate read view: a month grid. Days with an entry are highlighted with a
// gold dot and open that entry; empty days open a fresh editor for that date
// (the "open today's entry, creating it if absent" rule, generalised to any day).
export default function CalendarView({ entries, onOpenEntry, onNewOn }) {
  const now = new Date()
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const weekStart = getWeekStart()
  const grid = monthGrid(view.year, view.month, weekStart)
  const dow = weekStart === 1 ? [...DOW_SUN.slice(1), DOW_SUN[0]] : DOW_SUN
  const today = todayKey()

  function clickCell(cell) {
    const entry = findByDate(entries, cell.key)
    if (entry) onOpenEntry(entry)
    else onNewOn(cell.key)
  }

  return (
    <div className="calendar">
      <div className="cal-head">
        <h2>{monthLabel(view.year, view.month)}</h2>
        <div className="cal-nav">
          <button className="icon-btn" aria-label="Previous month" onClick={() => setView(v => stepMonth(v, -1))}><BackIcon /></button>
          <button className="icon-btn" aria-label="Next month" style={{ transform: 'scaleX(-1)' }} onClick={() => setView(v => stepMonth(v, 1))}><BackIcon /></button>
        </div>
      </div>
      <div className="cal-grid">
        {dow.map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
        {grid.flat().map(cell => {
          const entry = findByDate(entries, cell.key)
          const cls = [
            'cal-cell',
            cell.inMonth ? 'in' : 'out',
            cell.key === today ? 'today' : '',
            entry ? 'has-entry' : '',
          ].filter(Boolean).join(' ')
          return (
            <div
              key={cell.key}
              className={cls}
              onClick={() => cell.inMonth && clickCell(cell)}
              title={entry ? entry.title : cell.inMonth ? 'Add a delight' : ''}
            >
              <span>{cell.day}</span>
              {entry && <span className="dot" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
