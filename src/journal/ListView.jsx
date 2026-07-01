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

// Interrupted, unfinished delights kept locally — shown above the list so they're
// easy to pick back up. Resume reopens the editor seeded from the draft.
function DraftsStrip({ drafts, onResume, onDiscard }) {
  if (!drafts.length) return null
  return (
    <div className="drafts-strip">
      <div className="drafts-head">unfinished · kept on this device</div>
      {drafts.map(d => (
        <div key={d.date} className="draft-row">
          <button className="draft-open" onClick={() => onResume(d.date)} title="Resume this draft">
            <span className="row-date">{formatShort(d.date)}</span>
            <span className="draft-title">{d.title?.trim() || d.entry?.trim() || 'untitled draft'}</span>
            <span className="draft-pill">draft</span>
          </button>
          <button className="draft-discard" onClick={() => onDiscard(d.date)} aria-label="Discard draft" title="Discard draft">Discard</button>
        </div>
      ))}
    </div>
  )
}

export default function ListView({ entries, total, drafts = [], onResumeDraft, onDiscardDraft, onOpen, onChip, emptyMessage }) {
  if (!entries.length) {
    return (
      <>
        <DraftsStrip drafts={drafts} onResume={onResumeDraft} onDiscard={onDiscardDraft} />
        <div className="empty">
          <p>{emptyMessage || 'No delights yet. The first one is waiting to be noticed.'}</p>
        </div>
      </>
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
      <DraftsStrip drafts={drafts} onResume={onResumeDraft} onDiscard={onDiscardDraft} />
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
                {e.pending && <span className="pending-pill" title="Saved on this device — will sync to Notion when you’re online">unsynced</span>}
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
