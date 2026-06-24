import { sortByDateDesc, formatShort } from './dates.js'
import EntryMeta from './EntryMeta.jsx'

// Primary read view: reverse-chronological list. One row per delight, newest first.
// `emptyMessage` lets the caller distinguish "no entries" from "nothing matched".
export default function ListView({ entries, onOpen, emptyMessage }) {
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
        <button key={e.id} className="entry-row" onClick={() => onOpen(e)}>
          <div className="row-top">
            <span className="row-date">{formatShort(e.date)}</span>
            <span className="row-title">{e.title || 'untitled'}</span>
          </div>
          {e.entry && <div className="row-excerpt">{e.entry}</div>}
          <EntryMeta people={e.people} tags={e.tags} />
        </button>
      ))}
    </div>
  )
}
