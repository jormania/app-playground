import { useRef, useState } from 'react'
import { TicketIcon, CloseIcon, ExternalIcon } from './icons.jsx'

// Comfortably above what a real ticket PDF/screenshot needs, matching the server relay's
// own sanity cap (api/notion-upload.js MAX_BYTES) — catch it client-side too so a huge
// pick fails fast with a clear message instead of a vague network error.
const MAX_BYTES = 8 * 1024 * 1024

function isPdf(file) {
  return file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '')
}

// Multiple ticket files (PDF or image), kept separate from Photo. Every add uploads
// immediately (so a real error surfaces right away) but the parent form only WRITES the
// whole set to Notion on Save — this field just curates a working list. EntryEditor owns
// `tickets` (the current desired final set) and passes it down; each entry is either
// { name, url, fileUploadId } (existing, read from Notion) or { name, fileUploadId,
// previewUrl, pending:true } (uploaded this session, not yet attached).
export default function TicketsField({ client, tickets, onChange, onBusyChange, saving, offline }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const disabled = saving || busy || offline

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // allow picking the same file(s) again
    if (!files.length) return
    setError('')
    setBusy(true)
    onBusyChange?.(true)
    try {
      const uploaded = []
      for (const file of files) {
        if (file.size > MAX_BYTES) { setError(`"${file.name}" is too large (max 8MB) — skipped.`); continue }
        const result = await client.uploadFile(file, file.name)
        uploaded.push({
          name: result.name || file.name,
          fileUploadId: result.ref,
          url: null,
          previewUrl: isPdf(file) ? null : URL.createObjectURL(file),
          pending: true,
        })
      }
      if (uploaded.length) onChange([...tickets, ...uploaded])
    } catch (err) {
      setError(err.message || 'Could not add that ticket — try again.')
    } finally {
      setBusy(false)
      onBusyChange?.(false)
    }
  }

  function remove(index) {
    const t = tickets[index]
    if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl)
    onChange(tickets.filter((_, i) => i !== index))
  }

  return (
    <div className="field ticket-field">
      <label><TicketIcon /> Tickets</label>
      <input ref={inputRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={handleFiles} disabled={disabled} />
      {error && <div className="error-note" aria-live="polite">{error}</div>}
      {tickets.length > 0 && (
        <ul className="ticket-list">
          {tickets.map((t, i) => (
            <li key={`${t.fileUploadId || t.url}-${i}`} className="ticket-row">
              <TicketIcon />
              <span className="ticket-name">{t.name}</span>
              {(t.url || t.previewUrl) && (
                <a className="ticket-open" href={t.url || t.previewUrl} target="_blank" rel="noopener" title="Open"><ExternalIcon /></a>
              )}
              <button type="button" className="ticket-remove" onClick={() => remove(i)} disabled={disabled} aria-label={`Remove ${t.name}`}><CloseIcon /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="ticket-actions">
        <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
          {busy ? 'Uploading…' : '+ Add ticket'}
        </button>
        <span className="hint">PDF or image · pick several at once</span>
      </div>
      {offline && <div className="hint">Tickets need a connection — reconnect to add one.</div>}
    </div>
  )
}
