import { formatHuman } from './dates.js'
import { TagIcon, PeopleIcon, CountIcon, BackIcon } from './icons.jsx'

// Single-entry read view: Title, Date, the essayette, Tags, People, Word Count.
// Word Count is shown as Notion's stored value when present (live mode), falling
// back to nothing for an as-yet-unsaved entry.
export default function EntryView({ entry, onBack, onEdit }) {
  return (
    <article className="entry-view">
      <button className="btn-ghost" onClick={onBack}><BackIcon /> back</button>
      <div className="ev-date" style={{ marginTop: 14 }}>{formatHuman(entry.date)}</div>
      <h1>{entry.title || 'untitled'}</h1>

      <div className="ev-body">{entry.entry}</div>

      {entry.people.length > 0 && (
        <div className="field-row">
          <span className="field-label"><PeopleIcon /> people</span>
          {entry.people.map(p => <span key={p} className="chip person">{p}</span>)}
        </div>
      )}
      {entry.tags.length > 0 && (
        <div className="field-row">
          <span className="field-label"><TagIcon /> tags</span>
          {entry.tags.map(t => <span key={t} className="chip tag">{t}</span>)}
        </div>
      )}

      <div className="ev-foot">
        {entry.wordCount != null && (
          <span className="count"><CountIcon /> {entry.wordCount} {entry.wordCount === 1 ? 'word' : 'words'}</span>
        )}
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => onEdit(entry)}>Edit</button>
      </div>
    </article>
  )
}
