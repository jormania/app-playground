import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, Mic, MicOff, RotateCcw, Sparkles } from 'lucide-react'
import { Button, Field, IconButton } from '../../ds'
import { resizePhoto, isImageFile, photoFilename } from '../../shared/photo.ts'
import { makeThumb } from '../lib/lqip.ts'
import { putPhoto } from '../lib/imageCache.ts'
import { NotionClient } from '../lib/notionClient.ts'
import { suggestTags, emptyTags, type SuggestedTags } from '../lib/tagging.ts'
import { useDictation } from '../lib/useDictation.ts'
import TagEditor from './TagEditor.tsx'
import { isConfigured, type FitCheckConfig } from '../lib/config.ts'
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
  /** Wardrobe ids the last-added garment went into, or null in a fresh
   *  session. Only used as a fallback — see the initializer below. */
  lastWardrobeIds: string[] | null
  onAdded: (garment: Garment) => void
  onCancel: () => void
}

export default function AddGarment({ config, wardrobes, lastWardrobeIds, onAdded, onCancel }: Props) {
  const choices = activeWardrobes(wardrobes)
  const [file, setFile] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [tags, setTags] = useState<SuggestedTags>(emptyTags)
  const [tagging, setTagging] = useState(false)
  const [tagNote, setTagNote] = useState('')
  // Three-step fallback, each a bit less specific than the last: (1) whichever
  // wardrobe is currently being viewed, (2) whatever the last garment added
  // THIS session went into — adding five things in a row while browsing "All"
  // shouldn't mean re-tapping the same chip five times, (3) the first active
  // wardrobe. Something sensible pre-selected matters: the charter asks for
  // taps over forms, and a garment saved into no wardrobe is a small mess to
  // undo. Last-used ids are filtered to ones still active, in case a wardrobe
  // was switched off between adds.
  const [wardrobeIds, setWardrobeIds] = useState<string[]>(() => {
    const viewing = choices.find((w) => w.id === config.wardrobeFilterId)
    if (viewing) return [viewing.id]
    const stillActive = (lastWardrobeIds ?? []).filter((id) => choices.some((w) => w.id === id))
    if (stillActive.length > 0) return stillActive
    return choices.length > 0 ? [choices[0].id] : []
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // One-shot dictation into the name field only — no session, no follow-up
  // turns (FIT_CHECK_ROADMAP.md §2). "a blue denim jacket" fills the field
  // exactly as typing it would.
  const dictation = useDictation((transcript) => {
    setName((prev) => (prev ? `${prev} ${transcript}` : transcript))
  })

  // The preview is an object URL over the resized blob; revoke it when it's
  // replaced or the screen closes, or every retake leaks one.
  //
  // Clearing `previewUrl` when the file goes away is load-bearing, not tidiness:
  // Retake sets `file` to null, the cleanup below revoked the URL, and without
  // this line the state still held that dead string — so the screen kept
  // rendering a now-broken <img> and the "Take a photo" button never came back.
  // Retake was effectively a dead end.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
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
    setTagNote('')
    let resized: Blob
    try {
      resized = await resizePhoto(picked)
      setFile(resized)
    } catch (err) {
      setError((err as Error).message)
      return
    }

    // Tagging is a shortcut, never a gate: the form is fully usable while this
    // runs and equally usable if it fails. Without a key we simply don't ask.
    if (!config.anthropicKey) {
      setTagNote('Add an AI key in Settings and photos will tag themselves.')
      return
    }
    setTagging(true)
    try {
      const suggested = await suggestTags(config.anthropicKey, resized)
      setTags(suggested)
      if (suggested.name) setName((prev) => prev || suggested.name!)
      setTagNote(
        suggested.category
          ? 'Tagged automatically — change anything that looks wrong.'
          : "Couldn't tell what this is — pick the tags yourself.",
      )
    } catch (err) {
      setTagNote(`${(err as Error).message} You can still tag it by hand.`)
    } finally {
      setTagging(false)
    }
  }

  async function save() {
    if (!file) return
    setSaving(true)
    setError('')
    try {
      const thumb = await makeThumb(file)
      const label = name.trim() || tags.category || 'Something'

      // Demo mode: build the garment locally and skip Notion entirely, rather
      // than the "Add something" button being disabled. Wardrobes already work
      // this way (see App.createWardrobe) — this is the same pattern applied to
      // garments, so Nora can try the whole photograph-tag-file loop before
      // Gabriel has connected anything. The photo lives only in the in-memory
      // cache (lib/imageCache), so it's readable this session but nothing is
      // written anywhere durable; it won't survive a reload.
      if (!isConfigured(config)) {
        const localId = `local_g_${Date.now()}`
        await putPhoto(localId, file)
        onAdded({
          id: localId, name: label, photoUrl: null, thumb,
          category: tags.category, colours: tags.colours, warmth: tags.warmth,
          styles: tags.styles, wardrobeIds, favourite: false, wearCount: 0,
          lastWorn: null, archived: false, retired: false,
        })
        setSaving(false)
        return
      }

      const client = new NotionClient(config.notionToken, {
        garments: config.garmentsDbId,
        outfits: config.outfitsDbId,
      })

      // Create the row first so there is something to attach to, then upload.
      // If the upload fails the garment still exists, tagged and named, with a
      // placeholder — recoverable. The reverse order can orphan an upload.
      const created = await client.createGarment({
        name: label,
        category: tags.category,
        colours: tags.colours,
        warmth: tags.warmth,
        styles: tags.styles,
        wardrobeIds,
        thumb,
      })
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
              labelRight={dictation.supported ? (
                <IconButton
                  size="sm"
                  aria-label={dictation.listening ? 'Stop dictating' : 'Dictate the name'}
                  selected={dictation.listening}
                  onClick={dictation.toggle}
                >
                  {dictation.listening
                    ? <MicOff size={14} aria-hidden="true" />
                    : <Mic size={14} aria-hidden="true" />}
                </IconButton>
              ) : undefined}
              value={name}
              placeholder="Blue denim jacket"
              onChange={(e) => setName(e.target.value)}
              hint={dictation.error || 'Optional — you can leave this and fix it later.'}
            />
          </div>

          {tagging && (
            <p className="fc-status" role="status">
              <Sparkles size={14} className="fc-spin" aria-hidden="true" /> Working out what this is…
            </p>
          )}
          {!tagging && tagNote && <p className="fc-settings-hint">{tagNote}</p>}

          <TagEditor tags={tags} onChange={setTags} disabled={saving} />

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
            <Button
              variant="ghost"
              onClick={() => { setFile(null); setTags(emptyTags()); setTagNote(''); setError('') }}
              disabled={saving}
            >
              <RotateCcw size={16} aria-hidden="true" /> Retake
            </Button>
            {/* Cancel used to disappear the moment a photo was taken, so
                backing out of a garment you'd changed your mind about meant
                retaking first. */}
            <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
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
