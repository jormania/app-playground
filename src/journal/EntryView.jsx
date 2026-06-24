import { formatHuman } from './dates.js'
import { CountIcon, BackIcon } from './icons.jsx'
import EntryMeta from './EntryMeta.jsx'

// Single-entry read view: Title, Date, the essayette, then People + Tags on one
// line (shared with the list), and Word Count from Notion's formula when saved.
export default function EntryView({ entry, onBack, onEdit }) {
  return (
    <article className="entry-view">
      <button className="btn-ghost" onClick={onBack}><BackIcon /> back</button>
      <div className="ev-date" style={{ marginTop: 14 }}>{formatHuman(entry.date)}</div>
      <h1>{entry.title || 'untitled'}</h1>

      <div className="ev-body">{entry.entry}</div>

      <EntryMeta people={entry.people} tags={entry.tags} />

      <div className="ev-foot">
        {entry.wordCount != null && (
          <span className="count"><CountIcon /> {entry.wordCount} {entry.wordCount === 1 ? 'word' : 'words'}</span>
        )}
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => onEdit(entry)}>Edit</button>
      </div>
    </article>
  )
}
