import { useState, useMemo, useRef, useEffect } from 'react'
import { collectOptions } from './notion.js'
import { todayKey } from './dates.js'
import ChipInput from './ChipInput.jsx'
import PlaceInput from './PlaceInput.jsx'
import { NameIcon, TextIcon, LinkIcon, CategoryIcon, PlaceIcon, TagIcon, HourglassIcon, CalendarIcon, CheckCircleIcon } from './icons.jsx'

// Create or edit one item. Everything but a Name is optional — this is a low-friction
// backlog, so you can jot a bare idea now and flesh it out later. Category is a single
// chip, Place is Google-autocompleted (with plain-text fallback), Tags are freeform.
export default function EntryEditor({ initial, entries, onSave, onCancel, saving, error }) {
  const isNew = !initial.id

  const [name, setName] = useState(initial.name || '')
  const [description, setDescription] = useState(initial.description || '')
  const [link, setLink] = useState(initial.link || '')
  const [category, setCategory] = useState(initial.category ? [initial.category] : [])
  const [place, setPlace] = useState(initial.place || '')
  const [placeUrl, setPlaceUrl] = useState(initial.placeUrl || '')
  const [tags, setTags] = useState(initial.tags || [])
  const [dateExpiring, setDateExpiring] = useState(initial.dateExpiring || '')
  const [plannedDate, setPlannedDate] = useState(initial.plannedDate || '')
  const [attended, setAttended] = useState(Boolean(initial.attended))
  const nameRef = useRef(null)

  const categoryOptions = useMemo(() => collectOptions(entries, 'category'), [entries])
  const tagOptions = useMemo(() => collectOptions(entries, 'tags'), [entries])

  useEffect(() => { if (isNew) nameRef.current?.focus() }, [isNew])

  const canSave = name.trim().length > 0 && !saving

  function submit(e) {
    e?.preventDefault()
    if (!canSave) return
    onSave({
      id: initial.id ?? null,
      name: name.trim(),
      description: description.trim(),
      link: link.trim(),
      category: category[0] || null,
      place: place.trim(),
      placeUrl: placeUrl.trim(),
      tags,
      dateExpiring: dateExpiring || null,
      plannedDate: plannedDate || null,
      attended,
      dateAdded: initial.dateAdded || todayKey(),
    })
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
  }

  return (
    <form className="editor" onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="editor-head">
        <div>
          <h2>{isNew ? <>Add to your <em>list</em></> : <>Edit <em>this</em></>}</h2>
          <p className="sub">{isNew ? 'Something to go and see — a bare idea is enough to start.' : 'Refine what you’re keeping.'}</p>
        </div>
      </div>

      {error && <div className="error-note" aria-live="polite">{error}</div>}

      <div className="field">
        <label htmlFor="f-name"><NameIcon /> Name</label>
        <input id="f-name" ref={nameRef} type="text" value={name}
          placeholder="What is it?" onChange={e => setName(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="f-desc"><TextIcon /> Description</label>
        <textarea id="f-desc" value={description} placeholder="Notes, programme, why it caught your eye…" onChange={e => setDescription(e.target.value)} />
      </div>

      <div className="field-grid">
        <div className="field">
          <label><CategoryIcon /> Category</label>
          <ChipInput values={category} options={categoryOptions} onChange={setCategory} kind="category" single placeholder="one — e.g. Event, Culture, Art" />
        </div>
        <div className="field">
          <label htmlFor="f-link"><LinkIcon /> Link</label>
          <input id="f-link" type="url" inputMode="url" value={link} placeholder="https://…" onChange={e => setLink(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label><PlaceIcon /> Place</label>
        <PlaceInput value={place} url={placeUrl} onChange={({ place: p, placeUrl: u }) => { setPlace(p); setPlaceUrl(u) }} />
      </div>

      <div className="field">
        <label><TagIcon /> Tags</label>
        <ChipInput values={tags} options={tagOptions} onChange={setTags} kind="tag" placeholder="free, ticketed, outdoor, with-friends…" />
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="f-exp"><HourglassIcon /> Expires <span className="opt">— deadline to act</span></label>
          {/* Can't expire before you plan to go — earlier days are greyed out. */}
          <input id="f-exp" type="date" value={dateExpiring} min={plannedDate || undefined} onChange={e => setDateExpiring(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-when"><CalendarIcon /> Planned <span className="opt">— when you'll go</span></label>
          {/* Planned can't be past the deadline — later days are greyed out. */}
          <input id="f-when" type="date" value={plannedDate} max={dateExpiring || undefined} onChange={e => setPlannedDate(e.target.value)} />
        </div>
      </div>

      <label className="check-row">
        <input type="checkbox" checked={attended} onChange={e => setAttended(e.target.checked)} />
        <CheckCircleIcon /> <span>Already attended — keep it in the list, marked done</span>
      </label>

      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={!canSave}>{saving ? 'Saving…' : isNew ? 'Add to list' : 'Save changes'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
