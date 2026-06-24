import { Fragment } from 'react'
import { sortByDateDesc, formatShort, keyToDate, monthLabel } from './dates.js'
import EntryMeta from './EntryMeta.jsx'

// Primary read view: reverse-chronological list, grouped under subtle month
// headers so a growing journal stays scannable. The row is a focusable div (not a
// button) so the tappable filter chips can nest inside it.
function monthKeyOf(dateKey) {
  const d = keyToDate(dateKey)
  return d ? `${d.getFullYear()}-${d.getMonth()}` : ''
}

export default function ListView({ entries, total, onOpen, onChip, emptyMessage }) {
  if (!entries.length) {
    return (
      <div className="empty">
        <p>{emptyMessage || 'No delights yet. The first one is waiting to be noticed.'}</p>
      </div>
    )
  }

  const sorted = sortByDateDesc(entries)
  const shown = entries.length
  const countText = (total != null && shown !== total)
    ? `${shown} of ${total} delights`
    : `${shown} ${shown === 1 ? 'delight' : 'delights'}`

  let lastMonth = null
  return (
    <div className="list">
      <div className="list-count">{countText}</div>
      {sorted.map(e => {
        const mk = monthKeyOf(e.date)
        const showDivider = mk !== lastMonth
        lastMonth = mk
        const d = keyToDate(e.date)
        return (
          <Fragment key={e.id}>
            {showDivider && d && <div className="list-divider">{monthLabel(d.getFullYear(), d.getMonth())}</div>}
            <div
              className="entry-row"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(e)}
              onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen(e) } }}
            >
              <div className="row-top">
                <span className="row-date">{formatShort(e.date)}</span>
                <span className="row-title">{e.title || 'untitled'}</span>
              </div>
              {e.entry && <div className="row-excerpt">{e.entry}</div>}
              <EntryMeta people={e.people} tags={e.tags} onChip={onChip} />
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
