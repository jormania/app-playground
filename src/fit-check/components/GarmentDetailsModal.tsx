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
  
  useEffect(() => {
    if (open && garment) {
      setFile(null)
      setError('')
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
  }, [open, garment])

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

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

  async function retire() {
    if (!garment) return
    setSaving(true)
    setError('')
    try {
      if (!isConfigured(config)) {
        onUpdate({ ...garment, retired: true })
        onClose()
        return
      }
      const client = new NotionClient(config.notionToken, { garments: config.garmentsDbId })
      const updated = await client.updateGarment(garment.id, { retired: true })
      if (!updated) throw new Error('Update failed')
      onUpdate(updated)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Garment Details" open={open} onClose={() => { if (!saving) onClose() }}>
      <div className="fc-capture" style={{ marginBottom: 16, position: 'relative' }}>
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
          onClick={() => inputRef.current?.click()}
          aria-label="Retake photo"
          disabled={saving}
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(0,0,0,0.6)', color: 'white',
            border: 'none', borderRadius: '50%',
            width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}
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
      </div>

      <TagEditor tags={tags} onChange={setTags} disabled={saving} />

      {choices.length > 0 && (
        <section className="fc-settings-group">
          <p className="fc-settings-hint">Wardrobes</p>
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

      {error && <p className="fc-status" data-ok="false" role="alert" style={{ marginTop: 16 }}>{error}</p>}

      <div className="fc-actions" style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <IconButton onClick={() => setMenuOpen(!menuOpen)} aria-label="More actions" aria-expanded={menuOpen} disabled={saving}>
            <MoreVertical size={20} />
          </IconButton>
          
          {menuOpen && (
            <div 
              style={{
                position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: 4, display: 'flex', flexDirection: 'column',
                minWidth: 160, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              <button 
                type="button"
                onClick={() => { setMenuOpen(false); onToggleFavourite(garment) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', background: 'none', border: 'none',
                  color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
                  borderRadius: 4, width: '100%'
                }}
              >
                <Star size={16} fill={garment.favourite ? 'currentColor' : 'none'} />
                {garment.favourite ? 'Unfavourite' : 'Favourite'}
              </button>
              
              {!garment.retired && (
                <button 
                  type="button"
                  onClick={() => { setMenuOpen(false); setRetireConfirm(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', background: 'none', border: 'none',
                    color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
                    borderRadius: 4, width: '100%'
                  }}
                >
                  <Archive size={16} /> Retire
                </button>
              )}
              
              <button 
                type="button"
                onClick={() => { setMenuOpen(false); setDeleteConfirm(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', background: 'none', border: 'none',
                  color: 'var(--danger)', textAlign: 'left', cursor: 'pointer',
                  borderRadius: 4, width: '100%'
                }}
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: 8 }}>
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
        onConfirm={retire}
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
