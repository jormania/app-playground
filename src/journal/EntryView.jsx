import { useMemo } from 'react'
import { formatHuman, entriesOnSameDay } from './dates.js'
import { CountIcon, BackIcon, HistoryIcon } from './icons.jsx'
import EntryMeta from './EntryMeta.jsx'

// Single-entry read view: Title, Date, the essayette, then People + Tags on one
// line (chips tap to filter), and Word Count from Notion's formula when saved.
export default function EntryView({ entry, entries, onBack, onEdit, onChip, onOnThisDay }) {
  const pastCount = useMemo(() => entriesOnSameDay(entries, entry.date).length, [entries, entry.date])
  return (
    <article className="entry-view">
      <div className="editor-head">
        <button className="btn-ghost" onClick={onBack}><BackIcon /> back</button>
        {pastCount > 0 && (
          <button className="btn btn-sm" onClick={() => onOnThisDay(entry.date)} title="Past delights from this day">
            <HistoryIcon /> On this day
          </button>
        )}
      </div>
      <div className="ev-date" style={{ marginTop: 14 }}>{formatHuman(entry.date)}</div>
      <h1>{entry.title || 'untitled'}</h1>

      <div className="ev-body">{entry.entry}</div>

      <EntryMeta people={entry.people} tags={entry.tags} onChip={onChip} />

      <div className="ev-foot">
        {entry.wordCount != null && (
          <span className="count"><CountIcon /> {entry.wordCount} {entry.wordCount === 1 ? 'word' : 'words'}</span>
        )}
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => onEdit(entry)}>Edit</button>
      </div>
    </article>
  )
}
