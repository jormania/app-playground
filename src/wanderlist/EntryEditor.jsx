import { useState, useMemo, useRef, useEffect } from 'react'
import { collectOptions } from './notion.js'
import { todayKey } from './dates.js'
import { getClient } from './store.js'
import ChipInput from './ChipInput.jsx'
import PlaceInput from './PlaceInput.jsx'
import PhotoField from './PhotoField.jsx'
import TicketsField from './TicketsField.jsx'
import Lightbox from './Lightbox.jsx'
import { NameIcon, TextIcon, LinkIcon, CategoryIcon, PlaceIcon, TagIcon, HourglassIcon, CalendarIcon, CheckIcon } from './icons.jsx'

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
  // Start time only — no end time tracked. Meaningless without a plannedDate, so clearing
  // the date clears the time too (see the date field's onChange below).
  const [plannedTime, setPlannedTime] = useState(initial.plannedTime || '')
  // Going answers "have I decided to go", separate from Attended's "did it happen" — it
  // only means anything once there's a Planned Date, so it clears along with the date.
  const [going, setGoing] = useState(Boolean(initial.going))
  // Attended is toggled from the list (round ✓) and the detail view, never here — but we
  // carry the existing value through so editing an already-attended item doesn't clear it.
  const attended = Boolean(initial.attended)
  const nameRef = useRef(null)
  const client = useMemo(() => getClient(), [])

  // Photo: uploads the moment it's picked (see PhotoField); `pendingPhoto` holds the
  // not-yet-attached result, `photoRemoved` marks the existing one for removal. Neither is
  // drafted — photos need a live save, unlike the plain-text fields.
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [ticketsBusy, setTicketsBusy] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState(null)

  // Tickets: the CURRENT desired final set (existing ones from `initial.tickets`, minus any
  // removed this session, plus any freshly uploaded) — TicketsField only curates this list;
  // the whole thing is written to Notion in one go on Save (see notionClient.setTickets).
  const [tickets, setTicketsState] = useState(initial.tickets || [])

  // A picked photo's local preview is a blob: URL — release it whenever it's replaced or
  // the editor closes without saving, so we don't leak it. NOT when it WAS just saved,
  // though: in demo/fixture mode (no Notion token), that preview blob URL is literally the
  // photo's persisted url (fixtureClient.uploadFile has no real backend to hand back a
  // separate one) — revoking it on the unmount-after-save would make the just-saved photo
  // vanish immediately. This ref, set synchronously in submit(), tells the cleanup to skip
  // that one case.
  const photoSavedRef = useRef(false)
  useEffect(() => () => {
    if (pendingPhoto?.previewUrl && !photoSavedRef.current) URL.revokeObjectURL(pendingPhoto.previewUrl)
  }, [pendingPhoto])

  const categoryOptions = useMemo(() => collectOptions(entries, 'category'), [entries])
  const tagOptions = useMemo(() => collectOptions(entries, 'tags'), [entries])

  useEffect(() => { if (isNew) nameRef.current?.focus() }, [isNew])

  const canSave = name.trim().length > 0 && !saving && !photoBusy && !ticketsBusy

  // Whether the tickets set actually changed, so a Save that only edited (say) the
  // description doesn't trigger a needless extra Tickets write.
  function ticketsChanged() {
    const key = (list) => list.map(t => t.fileUploadId || t.url).join('|')
    return key(tickets) !== key(initial.tickets || [])
  }

  function submit(e) {
    e?.preventDefault()
    if (!canSave) return
    let photoAction
    if (pendingPhoto) { photoAction = { type: 'set', ref: pendingPhoto.ref, name: pendingPhoto.name }; photoSavedRef.current = true }
    else if (photoRemoved) photoAction = { type: 'remove' }
    const ticketsAction = ticketsChanged() ? { files: tickets } : undefined

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
      plannedTime: plannedDate ? (plannedTime || null) : null,
      going: plannedDate ? going : false,
      attended,
      dateAdded: initial.dateAdded || todayKey(),
      photoAction,
      ticketsAction,
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
        {/* The two dates are deliberately unconstrained against each other: a ticket
            window often closes BEFORE the day you attend (expiry < planned), and an
            exhibition's run can end after the day you pick (planned < expiry) — both are
            normal. A min/max pairing here once blocked saving perfectly valid entries. */}
        <div className="field">
          <label htmlFor="f-exp"><HourglassIcon /> Expires <span className="opt">— deadline to act</span></label>
          <input id="f-exp" type="date" value={dateExpiring} onChange={e => setDateExpiring(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-when"><CalendarIcon /> Planned <span className="opt">— when you'll go</span></label>
          <div className="date-time-row">
            <input id="f-when" type="date" value={plannedDate}
              onChange={e => { const v = e.target.value; setPlannedDate(v); if (!v) { setPlannedTime(''); setGoing(false) } }} />
            {/* Start time only, and only once a date's picked — a time with no day to
                anchor it to means nothing. No end time: the app tracks a fixed start,
                not a duration. */}
            {plannedDate && (
              <input type="time" value={plannedTime} onChange={e => setPlannedTime(e.target.value)}
                aria-label="Start time (optional)" title="Start time — optional" />
            )}
          </div>
          {/* Going is separate from a bare Planned Date: the date/time just means "this is
              when it happens", not "I've committed" — a concert you're still deciding on
              still wants its date tracked. Only surfaces once there's a date to anchor it. */}
          {plannedDate && (
            <button type="button" className={`going-toggle${going ? ' on' : ''}`}
              aria-pressed={going} onClick={() => setGoing(g => !g)}>
              <CheckIcon /> {going ? 'Going' : 'Still deciding'}
            </button>
          )}
        </div>
      </div>

      <PhotoField
        client={client}
        nameHint={name}
        currentPhoto={initial.photo || null}
        removed={photoRemoved}
        pending={pendingPhoto}
        saving={saving}
        offline={client.mode === 'fixtures' ? false : Boolean(client.offline)}
        onPicked={setPendingPhoto}
        onBusyChange={setPhotoBusy}
        onRemove={() => setPhotoRemoved(true)}
        onUndoRemove={() => setPhotoRemoved(false)}
        onClearPending={() => setPendingPhoto(null)}
        onView={() => setLightboxSrc(pendingPhoto ? pendingPhoto.previewUrl : initial.photo?.url)}
      />
      {lightboxSrc && <Lightbox src={lightboxSrc} alt={name} onClose={() => setLightboxSrc(null)} />}

      <TicketsField
        client={client}
        tickets={tickets}
        onChange={setTicketsState}
        onBusyChange={setTicketsBusy}
        saving={saving}
        offline={client.mode === 'fixtures' ? false : Boolean(client.offline)}
      />

      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={!canSave}>{saving ? 'Saving…' : isNew ? 'Add to list' : 'Save changes'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
