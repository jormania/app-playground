import { useMemo, useState } from 'react'
import { formatHuman, entriesOnSameDay } from './dates.js'
import { CountIcon, BackIcon, HistoryIcon, ShareIcon, MailIcon } from './icons.jsx'
import EntryMeta from './EntryMeta.jsx'
import { shareEntry, shareByEmail } from './share.js'

// Single-entry read view: Title, Date, the essayette, then People + Tags on one
// line (chips tap to filter), and Word Count from Notion's formula when saved.
export default function EntryView({ entry, entries, onBack, onEdit, onChip, onOnThisDay }) {
  const pastCount = useMemo(() => entriesOnSameDay(entries, entry.date).length, [entries, entry.date])
  // Only surfaced after the OS share sheet isn't available and we copied to
  // the clipboard instead — the native sheet already gives its own feedback.
  const [shareStatus, setShareStatus] = useState(null) // null | 'copied' | 'copied-photo' | 'error'

  async function handleShare() {
    setShareStatus(null)
    const result = await shareEntry(entry)
    if (!result.ok) {
      setShareStatus('error')
    } else if (result.copied) {
      setShareStatus(result.withPhoto ? 'copied-photo' : 'copied')
    } else {
      return
    }
    window.setTimeout(() => setShareStatus(null), 4000)
  }

  // Opens the same OS share sheet as Share when available (the only way a
  // web page can hand a photo to an email app as an attachment), formatted
  // for email specifically; falls back to a plain mailto: (no photo — that
  // part genuinely can't be helped) when it isn't.
  async function handleEmail() {
    const result = await shareByEmail(entry)
    if (result.mailto) window.location.href = result.mailto
  }
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
      <div className="ev-date" style={{ marginTop: 14 }}>
        {formatHuman(entry.date)}
        {entry.pending && <span className="pending-pill" title="Saved on this device — will sync to Notion when you’re online">unsynced</span>}
      </div>
      <h1>{entry.title || 'untitled'}</h1>

      {entry.photo && (
        <div className="entry-photo">
          <div className="photo-thumb photo-thumb-plain">
            <img src={entry.photo.url} alt="" />
          </div>
        </div>
      )}

      <div className="ev-body">{entry.entry}</div>

      <EntryMeta people={entry.people} tags={entry.tags} onChip={onChip} />

      <div className="ev-foot">
        {entry.wordCount != null && (
          <span className="count"><CountIcon /> {entry.wordCount} {entry.wordCount === 1 ? 'word' : 'words'}</span>
        )}
        {shareStatus === 'copied' && <span className="share-status">Copied to clipboard</span>}
        {shareStatus === 'copied-photo' && <span className="share-status">Copied (text + photo) to clipboard</span>}
        {shareStatus === 'error' && <span className="share-status share-status-error">Couldn't share — try again</span>}
        <div className="ev-actions">
          <button className="btn" onClick={() => onEdit(entry)}>Edit</button>
          <button className="btn btn-sm" onClick={handleEmail} title="Email this delight, photo included where your mail app supports it">
            <MailIcon /> Email
          </button>
          <button className="btn btn-sm" onClick={handleShare}><ShareIcon /> Share</button>
        </div>
      </div>
    </article>
  )
}
