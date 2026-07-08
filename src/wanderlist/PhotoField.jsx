import { useRef, useState } from 'react'
import { isImageFile, resizePhoto, photoFilename } from './photo.js'
import { PhotoIcon } from './icons.jsx'

// Add / replace / remove the one picture an item may carry — a poster, a photo you took,
// whatever. Uploading happens the moment a file is picked (not deferred to Save) so the
// editor can show a real preview and a real error immediately — EntryEditor just holds
// onto the result (a `pending` photo ref) and attaches it when the entry itself is saved.
// Ported from Journal of Delights' PhotoField, generalized off its per-date filename.
export default function PhotoField({ client, nameHint, currentPhoto, removed, pending, saving, offline, onPicked, onBusyChange, onRemove, onUndoRemove, onClearPending, onView }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const effective = pending ? { url: pending.previewUrl } : (!removed && currentPhoto) ? currentPhoto : null
  const disabled = saving || busy || offline

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again to re-trigger onChange
    if (!file) return
    if (!isImageFile(file)) { setError('That doesn’t look like an image.'); return }
    setError('')
    setBusy(true)
    onBusyChange?.(true)
    try {
      const blob = await resizePhoto(file)
      const filename = photoFilename(nameHint)
      const previewUrl = URL.createObjectURL(blob)
      const uploaded = await client.uploadFile(blob, filename)
      onPicked({ ref: uploaded.ref, name: uploaded.name || filename, previewUrl })
    } catch (err) {
      setError(err.message || 'Could not add that photo — try again.')
    } finally {
      setBusy(false)
      onBusyChange?.(false)
    }
  }

  return (
    <div className="field photo-field">
      <label><PhotoIcon /> Photo</label>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} disabled={disabled} />
      {error && <div className="error-note" aria-live="polite">{error}</div>}
      {effective ? (
        <div className="photo-current">
          <button type="button" className="photo-thumb" onClick={onView} title="View full size" disabled={busy}>
            <img src={effective.url} alt="" />
          </button>
          <div className="photo-actions">
            <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
              {busy ? 'Uploading…' : 'Replace'}
            </button>
            {pending ? (
              <button type="button" className="btn-ghost" onClick={onClearPending} disabled={disabled}>Cancel</button>
            ) : (
              <button type="button" className="field-remove" onClick={onRemove} disabled={disabled}>Remove</button>
            )}
          </div>
        </div>
      ) : (
        <div className="photo-actions">
          <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
            {busy ? 'Uploading…' : 'Add a picture'}
          </button>
          {removed ? (
            <span className="hint">
              Will be removed on save ·{' '}
              <a role="button" tabIndex={0} onClick={onUndoRemove} onKeyDown={ev => ev.key === 'Enter' && onUndoRemove()}>Undo</a>
            </span>
          ) : (
            <span className="hint">one image · a poster, a street shot, a clipping</span>
          )}
        </div>
      )}
      {offline && <div className="hint">Photos need a connection — reconnect to add one.</div>}
    </div>
  )
}
