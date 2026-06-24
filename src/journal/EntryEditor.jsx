import { useState, useMemo } from 'react'
import { wordCount, collectOptions } from './notion.js'
import { findByDate, formatHuman } from './dates.js'
import TagInput from './TagInput.jsx'
import { TitleIcon, DateIcon, EntryIcon, TagIcon, PeopleIcon } from './icons.jsx'

// Create or edit one delight. Enforces the journal's single hard rule at the app
// level — one entry per calendar date — by detecting a clash and offering to open
// the existing entry rather than silently creating a duplicate (Notion itself
// won't stop two pages sharing a Date).
export default function EntryEditor({ initial, entries, onSave, onCancel, onOpenExisting, saving, error }) {
  const [title, setTitle] = useState(initial.title || '')
  const [date, setDate] = useState(initial.date || '')
  const [text, setText] = useState(initial.entry || '')
  const [tags, setTags] = useState(initial.tags || [])
  const [people, setPeople] = useState(initial.people || [])

  const tagOptions = useMemo(() => collectOptions(entries, 'tags'), [entries])
  const peopleOptions = useMemo(() => collectOptions(entries, 'people'), [entries])

  const count = wordCount(text)
  const inRange = count >= 25 && count <= 500
  const isNew = !initial.id

  // One-per-date clash: an entry on this date that isn't the one we're editing.
  const clash = useMemo(() => {
    const existing = findByDate(entries, date)
    return existing && existing.id !== initial.id ? existing : null
  }, [entries, date, initial.id])

  const canSave = text.trim().length > 0 && date && !clash && !saving

  function submit(e) {
    e.preventDefault()
    if (!canSave) return
    onSave({ id: initial.id ?? null, title: title.trim(), date, entry: text, tags, people })
  }

  return (
    <form className="editor" onSubmit={submit}>
      <h2>{isNew ? <>A new <em>delight</em></> : <>Edit <em>delight</em></>}</h2>
      <p className="sub">
        {isNew
          ? 'Retrace the texture of something you noticed today.'
          : `Written for ${formatHuman(date)}.`}
      </p>

      {error && <div className="error-note">{error}</div>}

      <div className="field">
        <label htmlFor="f-title"><TitleIcon /> Title</label>
        <input id="f-title" type="text" value={title} placeholder="the espresso foam" onChange={e => setTitle(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="f-date"><DateIcon /> Date</label>
        <input id="f-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        {clash && (
          <div className="dupe-warn">
            There's already a delight on {formatHuman(date)} — “{clash.title || 'untitled'}”.{' '}
            <a role="button" tabIndex={0} onClick={() => onOpenExisting(clash)} onKeyDown={e => e.key === 'Enter' && onOpenExisting(clash)}>Open it instead</a>.
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="f-entry"><EntryIcon /> Entry</label>
        <textarea id="f-entry" value={text} placeholder="Write it down before it dissolves…" onChange={e => setText(e.target.value)} />
        <div className="entry-meta">
          <span className={`wordcount ${inRange ? 'in-range' : ''}`}>{count} {count === 1 ? 'word' : 'words'}</span>
        </div>
      </div>

      <div className="field">
        <label><TagIcon /> Tags</label>
        <TagInput values={tags} options={tagOptions} onChange={setTags} kind="tag" placeholder="emergent themes — type and press Enter" />
      </div>

      <div className="field">
        <label><PeopleIcon /> People</label>
        <TagInput values={people} options={peopleOptions} onChange={setPeople} kind="person" placeholder="anyone who appears" />
      </div>

      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={!canSave}>{saving ? 'Saving…' : isNew ? 'Keep this delight' : 'Save changes'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
