import { useEffect, useState } from 'react'
import { Button, Field, TextAreaField } from '../../ds'
import type { Thing, ThingKind } from '../lib/notion'
import { inferKind } from '../lib/kindInference'
import { isLocalImage, localPhotoUrl } from '../lib/photoStore'
import { useDwell } from './useDwell'
import styles from './SpecimenPlate.module.css'

const ALL_KINDS: ThingKind[] = ['Passage', 'Observation', 'Dialogue', 'Question', 'Image', 'Link', 'Fragment', 'Mine']

export interface SpecimenPlateProps {
  thing: Thing
  sourceTitle?: string
  locusNames?: string[]
  onEdit: (id: string, patch: Partial<Thing>) => void
  /** Called once the plate has genuinely been looked at, not merely rendered
   *  (see useDwell). Both the walk and the scroll pass this, so the history
   *  accrues from all reading rather than only from the ritual. */
  onSeen?: (id: string) => void
  /** The neighbourhood panel, when there is one. Rendered under the actions so
   *  the passage is still the first and largest thing on the plate. */
  children?: React.ReactNode
}

/**
 * One thing, mounted and typeset to be read.
 *
 * Shared by the Forest's scroll, today's walk, and anywhere else a thing needs
 * to appear at reading size. SILVA.md is more insistent about this than about
 * anything else in the app — "passages must feel *set*, like type on a plate,
 * never like a text field" — so everything that has since accrued around the
 * passage (label, clearings, actions, neighbourhood) stays visually subordinate
 * to it, and the neighbourhood in particular arrives collapsed.
 */
export function SpecimenPlate({
  thing,
  sourceTitle,
  locusNames = [],
  onEdit,
  onSeen,
  children,
}: SpecimenPlateProps) {
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [body, setBody] = useState(thing.body)
  const [kind, setKind] = useState<ThingKind | ''>(thing.kind ?? '')
  const [locator, setLocator] = useState(thing.locator)
  const [note, setNote] = useState(thing.note)
  const [link, setLink] = useState(thing.link ?? '')
  const hasSource = Boolean(thing.sourceId)

  const plateRef = useDwell({
    onSeen: () => onSeen?.(thing.id),
    disabled: !onSeen,
  })

  function startEditing() {
    setBody(thing.body)
    setKind(thing.kind ?? '')
    setLocator(thing.locator)
    setNote(thing.note)
    setLink(thing.link ?? '')
    setEditing(true)
  }

  // Escape backs out of an edit — the same reflex as every other text field on
  // the platform, and the only keyboard affordance this screen needs.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditing(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(thing.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // No clipboard permission — the text is on screen and selectable anyway.
    }
  }

  function save() {
    onEdit(thing.id, {
      body: body.trim(),
      kind: kind || null,
      locator: locator.trim(),
      note: note.trim(),
      link: link.trim() || null,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <article className={styles.plate}>
        <div className={styles.editBlock}>
          {/* A passage is the whole object of this app and is very often
           *  several lines long — editing it through a 44px single-line input
           *  meant scrolling sideways through your own quotation. */}
          <TextAreaField label="Body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          <div className={styles.kindRow}>
            <select className={styles.select} value={kind} onChange={(e) => setKind(e.target.value as ThingKind | '')}>
              <option value="">No kind set</option>
              {ALL_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setKind(inferKind(body, hasSource) ?? '')}
              disabled={!body.trim()}
            >
              Suggest a kind
            </Button>
          </div>
          <Field
            label="Locator"
            hint="Where in the source — a page, a timestamp, where you were."
            value={locator}
            onChange={(e) => setLocator(e.target.value)}
            placeholder="e.g. p. 142, or overheard on the 32 tram"
          />
          <TextAreaField
            label="Note"
            hint="Why this. What it rhymed with."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <Field label="Link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" disabled={!body.trim()} onClick={save}>Save</Button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={styles.plate} ref={plateRef as React.Ref<HTMLElement>}>
      {thing.kind && <p className={styles.kind}>{thing.kind}</p>}
      {thing.image && <PlateImage image={thing.image} alt={thing.handle || 'A photographed page'} />}
      {thing.body && <p className={styles.body}>{thing.body}</p>}
      {thing.note && <p className={styles.note}>{thing.note}</p>}
      <ThingLabel thing={thing} sourceTitle={sourceTitle} />
      {locusNames.length > 0 && (
        <p className={styles.clearings}>
          {locusNames.map((name) => (
            <span key={name} className={styles.clearingTag}>{name}</span>
          ))}
        </p>
      )}
      <div className={styles.plateActions}>
        <Button size="sm" variant="ghost" onClick={startEditing}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={copyBody}>{copied ? 'Copied' : 'Copy'}</Button>
      </div>
      {children}
    </article>
  )
}

/**
 * A photographed page. A demo-forest photo lives in this device's IndexedDB
 * rather than at a URL (see lib/photoStore.ts), so it has to be resolved to an
 * object URL — and revoked again, or every plate you scroll past pins its
 * blob in memory for the life of the document.
 */
function PlateImage({ image, alt }: { image: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(isLocalImage(image) ? null : image)

  useEffect(() => {
    if (!isLocalImage(image)) {
      setSrc(image)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    localPhotoUrl(image).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      objectUrl = url
      setSrc(url)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [image])

  if (!src) return null
  return <img className={styles.image} src={src} alt={alt} loading="lazy" />
}

/** Specimen-label order per SILVA.md: source · locator · encountered · kept.
 *  Source/locator read fine unlabelled (a title, a page reference); the two
 *  dates don't — "2025-10-05 · 2026-08-18" doesn't say which is which — so
 *  those get an explicit, low-key field word (a colour shift, not a pill:
 *  the herbarium label is engraved text, not a chip). Collapsed to one date
 *  when they're the same day, the common case for a thing kept straight
 *  from a fresh note. */
function ThingLabel({ thing, sourceTitle }: { thing: Thing; sourceTitle?: string }) {
  const values = [sourceTitle, thing.locator].filter(Boolean) as string[]
  const dated = thing.kept && thing.kept !== thing.encountered
    ? [{ field: 'encountered', value: thing.encountered }, { field: 'kept', value: thing.kept }]
    : [{ field: 'kept', value: thing.kept ?? thing.encountered }]

  return (
    <p className={styles.label}>
      {values.map((value, i) => (
        <span key={value}>
          {i > 0 && <span className={styles.labelSep}> · </span>}
          {value}
        </span>
      ))}
      {dated.map((d, i) => (
        <span key={d.field}>
          {(values.length > 0 || i > 0) && <span className={styles.labelSep}> · </span>}
          <span className={styles.labelField}>{d.field}</span> {d.value}
        </span>
      ))}
    </p>
  )
}
