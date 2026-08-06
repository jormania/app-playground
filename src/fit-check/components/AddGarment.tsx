import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, RotateCcw } from 'lucide-react'
import { Button, Field, SegmentedControl } from '../../ds'
import { resizePhoto, isImageFile, photoFilename } from '../../shared/photo.ts'
import { makeThumb } from '../lib/lqip.ts'
import { putPhoto } from '../lib/imageCache.ts'
import { NotionClient } from '../lib/notionClient.ts'
import { type FitCheckConfig } from '../lib/config.ts'
import { CATEGORIES, type Category } from '../lib/vocabulary.ts'
import { activeWardrobes, type Wardrobe } from '../lib/wardrobes.ts'
import type { Garment } from '../lib/types.ts'

/** Charter: guide users toward photos the app can actually work with. Kept to
 *  three, phrased as encouragement — a checklist would make adding a garment
 *  feel like filing a form, which is exactly what this app is trying not to be. */
const TIPS = [
  'One thing at a time',
  'Plain background if you can',
  'Good light beats a good camera',
]

interface Props {
  config: FitCheckConfig
  wardrobes: Wardrobe[]
  onAdded: (garment: Garment) => void
  onCancel: () => void
}

export default function AddGarment({ config, wardrobes, onAdded, onCancel }: Props) {
  const choices = activeWardrobes(wardrobes)
  const [file, setFile] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('Top')
  // Defaults to whichever wardrobe is being viewed, else the first active one.
  // Something sensible pre-selected matters: the charter asks for taps over
  // forms, and a garment saved into no wardrobe is a small mess to undo.
  const [wardrobeIds, setWardrobeIds] = useState<string[]>(() => {
    const viewing = choices.find((w) => w.id === config.wardrobeFilterId)
    if (viewing) return [viewing.id]
    return choices.length > 0 ? [choices[0].id] : []
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // The preview is an object URL over the resized blob; revoke it when it's
  // replaced or the screen closes, or every retake leaks one.
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    // Reset immediately: without this, retaking the *same* file fires no change
    // event and the picker appears to do nothing.
    e.target.value = ''
    if (!picked) return
    if (!isImageFile(picked)) {
      setError('That file is not a photo.')
      return
    }
    setError('')
    try {
      setFile(await resizePhoto(picked))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function save() {
    if (!file) return
    setSaving(true)
    setError('')
    try {
      const thumb = await makeThumb(file)
      const client = new NotionClient(config.notionToken, {
        garments: config.garmentsDbId,
        outfits: config.outfitsDbId,
      })
      const label = name.trim() || category

      // Create the row first so there is something to attach to, then upload.
      // If the upload fails the garment still exists, tagged and named, with a
      // placeholder — recoverable. The reverse order can orphan an upload.
      const created = await client.createGarment({ name: label, category, wardrobeIds, thumb })
      if (!created) {
        setError('Add your Notion details in Settings first.')
        setSaving(false)
        return
      }

      // Cache the bytes we already hold, so the new tile paints instantly
      // instead of round-tripping to Notion for a photo we just sent it.
      await putPhoto(created.id, file)

      let garment = created
      try {
        const ticket = await client.uploadPhoto(file, photoFilename(label))
        garment = (await client.attachPhoto(created.id, ticket)) ?? created
      } catch (err) {
        // Non-fatal by design — see the ordering note above.
        setError(`Saved, but the photo didn't upload: ${(err as Error).message}`)
      }

      onAdded(garment)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fc-capture">
        {previewUrl ? (
          <img className="fc-capture-preview" src={previewUrl} alt="The garment you just photographed" />
        ) : (
          <button
            type="button"
            className="fc-capture-target"
            onClick={() => inputRef.current?.click()}
          >
            <Camera size={28} aria-hidden="true" />
            <span>Take a photo</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          // Opens the camera directly on a phone; desktop falls back to a picker.
          capture="environment"
          onChange={onPick}
          hidden
        />
      </div>

      {!previewUrl && (
        <ul className="fc-tips">
          {TIPS.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      )}

      {previewUrl && (
        <>
          <div className="fc-field-stack" style={{ marginTop: 16 }}>
            <Field
              label="What is it?"
              value={name}
              placeholder="Blue denim jacket"
              onChange={(e) => setName(e.target.value)}
              hint="Optional — you can leave this and fix it later."
            />
          </div>

          <section className="fc-settings-group" style={{ marginTop: 16 }}>
            <p className="fc-settings-hint">Where does it go?</p>
            <SegmentedControl
              value={category}
              onChange={(v) => setCategory(v as Category)}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </section>

          {choices.length > 0 && (
            <section className="fc-settings-group">
              <p className="fc-settings-hint">
                Where does it live? Pick more than one if it travels.
              </p>
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
                    >
                      {w.name}
                    </button>
                  )
                })}
              </div>
              {wardrobeIds.length === 0 && (
                <p className="fc-settings-hint" style={{ marginTop: 8 }}>
                  It won't belong to a wardrobe — you can file it later.
                </p>
              )}
            </section>
          )}

          <div className="fc-actions">
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={16} className="fc-spin" /> Saving…</> : 'Add to wardrobe'}
            </Button>
            <Button variant="ghost" onClick={() => setFile(null)} disabled={saving}>
              <RotateCcw size={16} aria-hidden="true" /> Retake
            </Button>
          </div>
        </>
      )}

      {error && <p className="fc-status" data-ok="false" role="alert">{error}</p>}

      {!previewUrl && (
        <div className="fc-actions">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </>
  )
}
