import { useState, useRef, useEffect, useCallback } from 'react'
import { autocomplete, details, newSessionToken } from './placesClient.js'
import { CloseIcon, PlaceIcon, ExternalIcon } from './icons.jsx'

// Place field with Google Places typeahead (via /api/places). Every path degrades to a
// plain text field: if the server has no key (501), or a request errors, or you're
// offline, whatever you type is stored verbatim as the place name. Picking a suggestion
// stores the resolved name + a Maps link (placeUrl). Debounced so we don't hammer the
// proxy on every keystroke.
export default function PlaceInput({ value, url, onChange }) {
  const [query, setQuery] = useState(value || '')
  const [preds, setPreds] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(true) // flips false once the proxy says "no key"
  const sessionRef = useRef(newSessionToken())
  const abortRef = useRef(null)
  const inputRef = useRef(null)

  // Keep the visible text in step if the parent resets the value (e.g. opening a
  // different item in the editor).
  useEffect(() => { setQuery(value || '') }, [value])

  const runSearch = useCallback(async (q) => {
    if (!supported) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const { configured, predictions } = await autocomplete(q, sessionRef.current, ctrl.signal)
      if (!configured) { setSupported(false); setPreds([]); setOpen(false); return }
      setPreds(predictions)
      setOpen(predictions.length > 0)
    } catch (err) {
      if (err?.name !== 'AbortError') { setPreds([]); setOpen(false) }
    } finally {
      setLoading(false)
    }
  }, [supported])

  // Debounce the lookup ~250ms after typing stops.
  useEffect(() => {
    if (!supported) return
    const q = query.trim()
    if (q.length < 2 || q === (value || '')) { setPreds([]); setOpen(false); return }
    const t = setTimeout(() => runSearch(q), 250)
    return () => clearTimeout(t)
  }, [query, supported, runSearch, value])

  function setTyped(text) {
    // Free text (no Google match): store as-is, clear any stale Maps link.
    onChange({ place: text.trim(), placeUrl: '' })
    setOpen(false)
  }

  async function choose(pred) {
    setQuery(pred.description)
    setOpen(false)
    // Optimistically store the description; refine with the resolved name + Maps link.
    onChange({ place: pred.description, placeUrl: '' })
    const { configured, place } = await details(pred.placeId, sessionRef.current)
    sessionRef.current = newSessionToken() // a details call ends the billing session
    if (configured && place) {
      setQuery(place.name || pred.description)
      onChange({ place: place.name || pred.description, placeUrl: place.mapsUrl || '' })
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); setTyped(query) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  function clear() {
    setQuery('')
    onChange({ place: '', placeUrl: '' })
    setPreds([])
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="placeinput">
      <div className="box">
        <PlaceIcon className="lead" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={supported ? 'search for a place…' : 'type a place'}
          onChange={e => { setQuery(e.target.value); onChange({ place: e.target.value.trim(), placeUrl: '' }) }}
          onFocus={() => preds.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        {url && <a className="place-map" href={url} target="_blank" rel="noopener" title="Open in Maps" onMouseDown={e => e.preventDefault()}><ExternalIcon /></a>}
        {query && <button type="button" className="place-clear" aria-label="Clear place" onClick={clear}><CloseIcon /></button>}
      </div>
      {open && preds.length > 0 && (
        <div className="suggest">
          {preds.map(p => (
            <button key={p.placeId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(p)}>
              <PlaceIcon /> <span>{p.description}</span>
            </button>
          ))}
        </div>
      )}
      {loading && <div className="place-loading">searching…</div>}
      {!supported && <div className="hint" style={{ marginTop: 6 }}>Map search isn’t set up — your typed place is saved as-is.</div>}
    </div>
  )
}
