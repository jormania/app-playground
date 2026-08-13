import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, MoreVertical, Trash2, Archive, Star } from 'lucide-react'
import { Modal, ConfirmModal, Button, Field, IconButton } from '../../ds'
import type { Garment } from '../lib/types.ts'
import type { Wardrobe } from '../lib/wardrobes.ts'
import { activeWardrobes } from '../lib/wardrobes.ts'
import type { FitCheckConfig } from '../lib/config.ts'
import { NotionClient } from '../lib/notionClient.ts'
import { isConfigured } from '../lib/config.ts'
import TagEditor from './TagEditor.tsx'
import type { SuggestedTags } from '../lib/tagging.ts'
import { resizePhoto, isImageFile, photoFilename } from '../../shared/photo.ts'
import { makeThumb } from '../lib/lqip.ts'
import { putPhoto } from '../lib/imageCache.ts'
import { useGarmentPhoto } from '../lib/useGarmentPhoto.ts'

interface Props {
  garment: Garment | null
  config: FitCheckConfig
  wardrobes: Wardrobe[]
  open: boolean
  onClose: () => void
  onUpdate: (garment: Garment) => void
  onDelete: (id: string) => void
  onToggleFavourite: (garment: Garment) => void
}

export default function GarmentDetailsModal({ garment, config, wardrobes, open, onClose, onUpdate, onDelete, onToggleFavourite }: Props) {
  const choices = activeWardrobes(wardrobes)
  
  const [name, setName] = useState('')
  const [tags, setTags] = useState<SuggestedTags>({
    name: null,
    category: null,
    colours: [],
    warmth: null,
    styles: [],
  })
  const [wardrobeIds, setWardrobeIds] = useState<string[]>([])
  
  const [file, setFile] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  const [menuOpen, setMenuOpen] = useState(false)
  const [retireConfirm, setRetireConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  
  const [error, setError] = useState('')
  
  const inputRef = useRef<HTMLInputElement>(null)
  
  const garmentPhotoUrl = useGarmentPhoto(garment)
  const currentPhotoUrl = previewUrl || garmentPhotoUrl
  
  // Keyed on the garment's ID, not the garment OBJECT. App hands down a fresh
  // object whenever anything about it changes — and one of those changes is
  // Favourite, from this modal's own menu — so depending on identity meant
  // tapping Favourite mid-edit silently reset the name, tags and wardrobes back
  // to what was stored. `saving` is reset here too: `setRetiredStatus` closed
  // the modal without clearing it, and since the modal returns null rather than
  // unmounting, that left every later open stuck in a disabled "Saving…" state.
  useEffect(() => {
    if (open && garment) {
      setFile(null)
      setError('')
      setSaving(false)
      setMenuOpen(false)
      setRetireConfirm(false)
      setDeleteConfirm(false)
      setName(garment.name)
      setTags({
        name: null,
        category: garment.category,
        colours: garment.colours,
        warmth: garment.warmth,
        styles: garment.styles,
      })
      setWardrobeIds(garment.wardrobeIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, garment?.id])

  // Same trap as AddGarment's: without clearing the state when the file goes,
  // `previewUrl` kept a revoked URL from the *previous* garment, and opening
  // the next one showed the last one's photo until its own loaded over it.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // A dropdown you can only dismiss by picking something from it is a trap on
  // a phone, where "tap somewhere else" is the reflex.
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    // Deferred to the next frame so the click that OPENED it doesn't
    // immediately close it again.
    const id = setTimeout(() => {
      document.addEventListener('click', close)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (!garment) return null

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (!isImageFile(picked)) {
      setError('That file is not a photo.')
      return
    }
    setError('')
    try {
      const resized = await resizePhoto(picked)
      setFile(resized)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function save() {
    if (!garment) return
    setSaving(true)
    setError('')
    try {
      const patch: Partial<Garment> = {
        name: name.trim() || tags.category || 'Something',
        category: tags.category,
        colours: tags.colours,
        warmth: tags.warmth,
        styles: tags.styles,
        wardrobeIds,
      }
      
      let newThumb = garment.thumb
      if (file) {
        newThumb = await makeThumb(file)
        patch.thumb = newThumb
      }
      
      if (!isConfigured(config)) {
        if (file) await putPhoto(garment.id, file)
        onUpdate({ ...garment, ...patch, thumb: newThumb })
        onClose()
        return
      }
      
      const client = new NotionClient(config.notionToken, {
        garments: config.garmentsDbId,
      })
      
      const updated = await client.updateGarment(garment.id, patch)
      if (!updated) throw new Error('Update failed')
      
      let finalGarment = updated
      if (file) {
        await putPhoto(garment.id, file)
        const ticket = await client.uploadPhoto(file, photoFilename(patch.name!))
        finalGarment = (await client.attachPhoto(garment.id, ticket)) ?? updated
      }
      
      onUpdate(finalGarment)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function setRetiredStatus(status: boolean) {
    if (!garment) return
    setSaving(true)
    setError('')
    try {
      if (!isConfigured(config)) {
        onUpdate({ ...garment, retired: status })
        onClose()
        return
      }
      const client = new NotionClient(config.notionToken, { garments: config.garmentsDbId })
      const updated = await client.updateGarment(garment.id, { retired: status })
      if (!updated) throw new Error('Update failed')
      onUpdate(updated)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Garment Details" open={open} onClose={() => { if (!saving) onClose() }}>
      <div className="fc-capture fc-capture--modal">
        {currentPhotoUrl ? (
          <img className="fc-capture-preview" src={currentPhotoUrl} alt={name} />
        ) : (
          <div className="fc-capture-target">
            <span className="fc-tile-thumb" style={garment.thumb ? (
              /^#[0-9a-f]{6}$/i.test(garment.thumb) ? { backgroundColor: garment.thumb, width: '100%', height: '100%' } :
              /^[A-Za-z0-9+/=]+$/.test(garment.thumb) ? { backgroundImage: `url(data:image/jpeg;base64,${garment.thumb})`, width: '100%', height: '100%', backgroundSize: 'cover' } : {}
            ) : {}}>
              No photo
            </span>
          </div>
        )}
        <button
          type="button"
          className="fc-retake-btn"
          onClick={() => inputRef.current?.click()}
          aria-label="Retake photo"
          disabled={saving}
        >
          {saving && file ? <Loader2 size={20} className="fc-spin" /> : <Camera size={20} />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPick}
          hidden
        />
      </div>

      <div className="fc-field-stack">
        <Field
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
        />
        {garment.wearCount > 0 && (
          <p className="fc-settings-hint fc-wear-count-hint">
            Worn {garment.wearCount} time{garment.wearCount === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <TagEditor tags={tags} onChange={setTags} disabled={saving} />

      {choices.length > 0 && (
        <section className="fc-settings-group fc-modal-wardrobes">
          <h3 className="fc-modal-heading" data-colour="purple">Wardrobes</h3>
          <div className="fc-chips">
            {choices.map((w) => {
              const on = wardrobeIds.includes(w.id)
              return (
                <button
                  key={w.id}
                  type="button"
                  className="fc-chip"
                  role="checkbox"
                  aria-checked={on}
                  data-selected={on}
                  onClick={() => setWardrobeIds((prev) =>
                    on ? prev.filter((id) => id !== w.id) : [...prev, w.id],
                  )}
                  disabled={saving}
                >
                  {w.name}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {error && <p className="fc-status fc-modal-error" data-ok="false" role="alert">{error}</p>}

      <div className="fc-actions fc-modal-actions">
        <div className="fc-modal-menu">
          <IconButton onClick={() => setMenuOpen(!menuOpen)} aria-label="More actions" aria-expanded={menuOpen} disabled={saving}>
            <MoreVertical size={20} />
          </IconButton>

          {menuOpen && (
            <div className="fc-modal-menu-list">
              <button
                type="button"
                className="fc-modal-menu-item"
                onClick={() => { setMenuOpen(false); onToggleFavourite(garment) }}
              >
                <Star size={16} fill={garment.favourite ? 'currentColor' : 'none'} />
                {garment.favourite ? 'Unfavourite' : 'Favourite'}
              </button>

              {!garment.retired ? (
                <button
                  type="button"
                  className="fc-modal-menu-item"
                  onClick={() => { setMenuOpen(false); setRetireConfirm(true) }}
                >
                  <Archive size={16} /> Retire
                </button>
              ) : (
                <button
                  type="button"
                  className="fc-modal-menu-item"
                  onClick={() => { setMenuOpen(false); setRetiredStatus(false) }}
                >
                  <Archive size={16} /> Unretire
                </button>
              )}

              <button
                type="button"
                className="fc-modal-menu-item fc-modal-menu-item--danger"
                onClick={() => { setMenuOpen(false); setDeleteConfirm(true) }}
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          )}
        </div>

        <div className="fc-modal-actions-right">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 size={16} className="fc-spin" /> Saving…</> : 'Save changes'}
          </Button>
        </div>
      </div>

      <ConfirmModal
        title="Retire this garment?"
        message="It will be removed from your active wardrobes and suggestions, but kept in Notion for your records."
        confirmText="Retire garment"
        isOpen={retireConfirm}
        onConfirm={() => setRetiredStatus(true)}
        onCancel={() => setRetireConfirm(false)}
      />

      <ConfirmModal
        title="Delete this garment?"
        message="Are you sure? It will be permanently removed."
        confirmText="Delete"
        variant="danger"
        isOpen={deleteConfirm}
        onConfirm={() => {
          setDeleteConfirm(false)
          onDelete(garment.id)
        }}
        onCancel={() => setDeleteConfirm(false)}
      />
    </Modal>
  )
}
