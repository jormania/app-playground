import { sortByDateDesc, formatShort } from './dates.js'
import EntryMeta from './EntryMeta.jsx'

// Primary read view: reverse-chronological list. One row per delight, newest first.
// The row is a focusable div (not a button) so the tappable filter chips can nest
// inside it without invalid button-in-button markup.
export default function ListView({ entries, onOpen, onChip, emptyMessage }) {
  if (!entries.length) {
    return (
      <div className="empty">
        <p>{emptyMessage || 'No delights yet. The first one is waiting to be noticed.'}</p>
      </div>
    )
  }
  return (
    <div className="list">
      {sortByDateDesc(entries).map(e => (
        <div
          key={e.id}
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
      ))}
    </div>
  )
}
