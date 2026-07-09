import { useState, useRef } from 'react'
import { CloseIcon } from './icons.jsx'

// Freeform chip input used for Category (single) and Tags (multi). Suggests values that
// already exist in the backlog (`options`) but never restricts to them — Enter, comma,
// or clicking "create" adds a brand-new value inline. Category/Place/Tags emerge from
// what you add, never a closed taxonomy (same principle as JoD's Tags/People). When
// `single`, choosing a value replaces the one already held.
export default function ChipInput({ values, options = [], onChange, kind = 'tag', placeholder, single = false }) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)

  // Lowercased on add, matching the save-time normalization in notion.js — so the chip
  // you see in the editor is exactly what persists (and demo mode, which has no
  // save-time normalization of its own, can't fork "Free" and "free" into two values).
  const norm = (s) => s.trim().toLowerCase()
  const lower = draft.trim().toLowerCase()
  const suggestions = options.filter(
    o => !values.includes(o) && (lower === '' || o.toLowerCase().includes(lower))
  )
  const exactExists = options.some(o => o.toLowerCase() === lower) || values.some(v => v.toLowerCase() === lower)
  const atCapacity = single && values.length >= 1

  function add(value, refocus = true) {
    const v = norm(value)
    if (!v) return
    if (single) {
      onChange([v])
    } else if (!values.some(x => x.toLowerCase() === v.toLowerCase())) {
      onChange([...values, v])
    }
    setDraft('')
    setOpen(false)
    if (refocus && !single) inputRef.current?.focus()
  }

  function onBlur() {
    if (draft.trim()) add(draft, false)
    setTimeout(() => setOpen(false), 120)
  }

  function remove(value) {
    onChange(values.filter(v => v !== value))
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (draft.trim()) add(draft)
    } else if (e.key === 'Backspace' && draft === '' && values.length) {
      remove(values[values.length - 1])
    }
  }

  return (
    <div className="chipinput">
      <div className="box" onClick={() => inputRef.current?.focus()}>
        {values.map(v => (
          <span key={v} className={`token ${kind}`}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => remove(v)}><CloseIcon /></button>
          </span>
        ))}
        {!atCapacity && (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            placeholder={values.length ? '' : placeholder}
            onChange={e => { setDraft(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
        )}
      </div>
      {open && !atCapacity && (suggestions.length > 0 || (draft.trim() && !exactExists)) && (
        <div className="suggest">
          {draft.trim() && !exactExists && (
            <button type="button" className="create" onMouseDown={e => e.preventDefault()} onClick={() => add(draft)}>
              + create “{lower}”
            </button>
          )}
          {suggestions.map(s => (
            <button key={s} type="button" onMouseDown={e => e.preventDefault()} onClick={() => add(s)}>{s}</button>
          ))}
        </div>
      )}
    </div>
  )
}
