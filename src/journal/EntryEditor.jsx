import { useState, useMemo, useEffect, useRef } from 'react'
import { wordCount, collectOptions } from './notion.js'
import { findByDate, formatHuman, entriesOnSameDay } from './dates.js'
import { getDraft, saveDraft } from './store.js'
import TagInput from './TagInput.jsx'
import { TitleIcon, DateIcon, EntryIcon, TagIcon, PeopleIcon, HistoryIcon } from './icons.jsx'

// Create or edit one delight. Enforces the journal's single hard rule at the app
// level — one entry per calendar date — by detecting a clash and offering to open
// the existing entry rather than silently creating a duplicate (Notion itself
// won't stop two pages sharing a Date).
export default function EntryEditor({ initial, entries, onSave, onCancel, onOpenExisting, onOnThisDay, saving, error }) {
  const isNew = !initial.id
  // Resilience: for a new entry, pick up any locally-saved draft for this date so a
  // failed save or closed tab never loses what was written.
  const draft = isNew ? getDraft(initial.date) : null
  const seed = draft || initial

  const [title, setTitle] = useState(seed.title || '')
  const [date, setDate] = useState(seed.date || initial.date || '')
  const [text, setText] = useState(seed.entry || '')
  const [tags, setTags] = useState(seed.tags || [])
  const [people, setPeople] = useState(seed.people || [])
  const entryRef = useRef(null)

  const tagOptions = useMemo(() => collectOptions(entries, 'tags'), [entries])
  const peopleOptions = useMemo(() => collectOptions(entries, 'people'), [entries])
  const pastCount = useMemo(() => entriesOnSameDay(entries, date).length, [entries, date])

  const count = wordCount(text)
  const inRange = count >= 25 && count <= 500

  // One-per-date clash: an entry on this date that isn't the one we're editing.
  const clash = useMemo(() => {
    const existing = findByDate(entries, date)
    return existing && existing.id !== initial.id ? existing : null
  }, [entries, date, initial.id])

  const canSave = text.trim().length > 0 && date && !clash && !saving

  // Quick entry: drop the cursor straight into the writing for a new delight.
  useEffect(() => { if (isNew) entryRef.current?.focus() }, [isNew])

  // Auto-persist the draft for new entries on every change (cheap, local-only).
  useEffect(() => {
    if (isNew && (title || text || tags.length || people.length)) {
      saveDraft(date, { id: null, title, date, entry: text, tags, people })
    }
  }, [isNew, title, date, text, tags, people])

  function submit(e) {
    e?.preventDefault()
    if (!canSave) return
    onSave({ id: initial.id ?? null, title: title.trim(), date, entry: text, tags, people })
  }

  // ⌘/Ctrl+Enter saves from anywhere in the form.
  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
  }

  return (
    <form className="editor" onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="editor-head">
        <div>
          <h2>{isNew ? <>A new <em>delight</em></> : <>Edit <em>delight</em></>}</h2>
          <p className="sub">
            {isNew ? 'Retrace the texture of something you noticed today.' : `Written for ${formatHuman(date)}.`}
          </p>
        </div>
        {pastCount > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => onOnThisDay(date)} title="Past delights from this day">
            <HistoryIcon /> On this day
          </button>
        )}
      </div>

      {error && <div className="error-note" aria-live="polite">{error}</div>}

      <div className="field">
        <label htmlFor="f-title"><TitleIcon /> Title</label>
        <input id="f-title" className="title-input" type="text" value={title}
          placeholder="Name its essence in a few words…" onChange={e => setTitle(e.target.value)} />
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
        <textarea id="f-entry" ref={entryRef} value={text} placeholder="Write it down before it dissolves…" onChange={e => setText(e.target.value)} />
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
