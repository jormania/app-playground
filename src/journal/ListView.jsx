import { sortByDateDesc, formatShort } from './dates.js'

// Primary read view: reverse-chronological list. One row per delight, newest first.
export default function ListView({ entries, onOpen }) {
  if (!entries.length) {
    return (
      <div className="empty">
        <p>No delights yet. The first one is waiting to be noticed.</p>
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
          {(e.tags.length > 0 || e.people.length > 0) && (
            <div className="row-chips">
              {e.people.map(p => <span key={`p-${p}`} className="chip person">{p}</span>)}
              {e.tags.map(t => <span key={`t-${t}`} className="chip tag">{t}</span>)}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
