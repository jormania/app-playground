import { useRef, useState } from 'react'
import { isImageFile, resizePhoto, photoFilename } from './photo.js'
import { PhotoIcon } from './icons.jsx'

// Add / replace / remove the one picture a delight may carry. Uploading happens
// the moment a file is picked (not deferred to Save) so the editor can show a real
// preview and a real error immediately — EntryEditor just holds onto the result
// (a `pending` photo ref) and attaches it when the entry itself is saved.
export default function PhotoField({ client, dateKey, currentPhoto, removed, pending, saving, offline, onPicked, onBusyChange, onRemove, onUndoRemove, onClearPending, onView }) {
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
      const filename = photoFilename(dateKey)
      const previewUrl = URL.createObjectURL(blob)
      const uploaded = await client.uploadPhoto(blob, filename)
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
          <button type="button" className="photo-thumb photo-thumb-plain" onClick={onView} title="View full size" disabled={busy}>
            <img src={effective.url} alt="" />
          </button>
          <div className="photo-actions">
            <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
              {busy ? 'Uploading…' : 'Replace'}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={pending ? onClearPending : onRemove} disabled={disabled}>
              {pending ? 'Cancel' : 'Remove'}
            </button>
          </div>
        </div>
      ) : (
        <div className="photo-actions">
          <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
            {busy ? 'Uploading…' : 'Add a picture'}
          </button>
          {removed && (
            <span className="hint">
              Will be removed on save ·{' '}
              <a role="button" tabIndex={0} onClick={onUndoRemove} onKeyDown={ev => ev.key === 'Enter' && onUndoRemove()}>Undo</a>
            </span>
          )}
        </div>
      )}
      {offline && <div className="hint">Photos need a connection — reconnect to add one.</div>}
    </div>
  )
}
