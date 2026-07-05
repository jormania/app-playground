import { useState, useMemo } from 'react'
import { yearGrid, findByDate, todayKey } from './dates.js'
import { BackIcon } from './icons.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A calm year-at-a-glance heatmap: one small cell per day, lit when a delight was
// written. Descriptive density, never a streak score. Scrolls horizontally on
// narrow screens. Lit days open the entry; empty in-year days start one.
export default function YearView({ entries, onOpenEntry, onNewOn }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const weeks = useMemo(() => yearGrid(year), [year])
  const today = todayKey()
  const isCurrent = year === now.getFullYear()

  // Month labels: place one at the first week whose leading in-year day changes month.
  const labels = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const firstInYear = week.find(c => c.inYear)
    if (firstInYear && firstInYear.month !== lastMonth) {
      lastMonth = firstInYear.month
      labels.push({ wi, text: MONTHS[firstInYear.month] })
    }
  })

  function clickCell(cell) {
    if (!cell.inYear) return
    const entry = findByDate(entries, cell.key)
    if (entry) onOpenEntry(entry)
    else onNewOn(cell.key)
  }

  return (
    <div className="year">
      <div className="cal-head">
        <h2>{year}</h2>
        <div className="cal-nav">
          <button className="cal-today-btn" disabled={isCurrent} onClick={() => setYear(now.getFullYear())}>Today</button>
          <button className="icon-btn" aria-label="Previous year" onClick={() => setYear(y => y - 1)}><BackIcon /></button>
          <button className="icon-btn" aria-label="Next year" style={{ transform: 'scaleX(-1)' }} onClick={() => setYear(y => y + 1)}><BackIcon /></button>
        </div>
      </div>

      <div className="year-scroll">
        <div className="year-inner">
          <div className="year-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}>
            {labels.map(l => <span key={l.wi} className="year-month" style={{ gridColumnStart: l.wi + 1 }}>{l.text}</span>)}
          </div>
          {/* Cells flow column-by-column (Mon→Sun down each week) — DOM order is
              already week-major, matching grid-auto-flow: column. */}
          <div className="year-grid">
            {weeks.flat().map(cell => {
              const entry = cell.inYear && findByDate(entries, cell.key)
              const cls = [
                'year-cell',
                !cell.inYear ? 'empty' : '',
                entry ? 'lit' : '',
                cell.key === today ? 'today' : '',
              ].filter(Boolean).join(' ')
              return (
                <div
                  key={cell.key}
                  className={cls}
                  onClick={() => clickCell(cell)}
                  title={entry ? `${cell.key} — ${entry.title || 'untitled'}` : cell.inYear ? cell.key : ''}
                />
              )
            })}
          </div>
        </div>
      </div>
      <p className="year-legend">A lit square is a day you wrote. Tap one to read it.</p>
    </div>
  )
}
