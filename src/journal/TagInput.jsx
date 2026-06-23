import { useState, useRef } from 'react'
import { CloseIcon } from './icons.jsx'

// Freeform multi-value input. Suggests values that already exist in the journal
// (passed in via `options`) but never restricts to them — Enter, comma, or
// clicking "create" adds a brand-new value inline. This is the spec's rule:
// tags/people emerge from what's written, never a closed taxonomy.
export default function TagInput({ values, options, onChange, kind = 'tag', placeholder }) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)

  const norm = (s) => s.trim()
  const lower = draft.trim().toLowerCase()
  const suggestions = options.filter(
    o => !values.includes(o) && (lower === '' || o.toLowerCase().includes(lower))
  )
  const exactExists = options.some(o => o.toLowerCase() === lower) || values.some(v => v.toLowerCase() === lower)

  function add(value) {
    const v = norm(value)
    if (!v) return
    if (!values.some(x => x.toLowerCase() === v.toLowerCase())) onChange([...values, v])
    setDraft('')
    setOpen(false)
    inputRef.current?.focus()
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
    <div className="taginput">
      <div className="box" onClick={() => inputRef.current?.focus()}>
        {values.map(v => (
          <span key={v} className={`token ${kind}`}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => remove(v)}><CloseIcon /></button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          placeholder={values.length ? '' : placeholder}
          onChange={e => { setDraft(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
      </div>
      {open && (suggestions.length > 0 || (draft.trim() && !exactExists)) && (
        <div className="suggest">
          {draft.trim() && !exactExists && (
            <button type="button" className="create" onMouseDown={e => e.preventDefault()} onClick={() => add(draft)}>
              + create “{draft.trim()}”
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
