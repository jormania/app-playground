import { useEffect, useState } from 'react'
import { Button, Field, TextAreaField, ConfirmModal } from '../../ds'
import type { Thing, ThingKind } from '../lib/notion'
import type { Source } from '../lib/sources'
import { inferKind, effectiveLink } from '../lib/kindInference'
import { readImageViewMode, writeImageViewMode, type ImageViewMode } from '../lib/imageViewPref'
import { sourceInputValue } from '../lib/sourceCapture'
import { useDwell } from './useDwell'
import { usePhotoUrl } from './usePhotoUrl'
import { useLinkPreview } from './useLinkPreview'
import styles from './SpecimenPlate.module.css'

const ALL_KINDS: ThingKind[] = ['Passage', 'Observation', 'Dialogue', 'Question', 'Image', 'Link', 'Fragment', 'Mine']

export interface SpecimenPlateProps {
  thing: Thing
  source?: Source
  locusNames?: string[]
  /** `sourceInput` is the raw text from the Source field — resolving it into
   *  a real `sourceId` (reuse a match, create otherwise) needs the store, so
   *  App.tsx does that, not this component. Present only when the save
   *  actually touched the Source field, so a save that never opened it can't
   *  accidentally clear an existing source. */
  onEdit: (id: string, patch: Partial<Thing>, sourceInput?: string) => void
  /** Lets go of a kept thing from wherever it is being read. Optional so a
   *  surface can present a plate as read-only; every surface that shows a
   *  kept thing currently passes it. */
  onRelease?: (id: string) => void
  /** Deletes the thing outright, with the cleanup Notion cannot do on its
   *  own (App.tsx's `handleDeleteThing`). Optional, same as onRelease. */
  onDelete?: (id: string) => void
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
  source,
  locusNames = [],
  onEdit,
  onRelease,
  onDelete,
  onSeen,
  children,
}: SpecimenPlateProps) {
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Which view — photo or transcribed text — this thing last showed. Only
  // meaningful once both exist; defaults to text (a passage, set to be
  // read) the first time, since the image is supporting evidence for it,
  // not the other way round — but stays remembered per-thing after that.
  const [viewMode, setViewMode] = useState<ImageViewMode>(() => readImageViewMode(thing.id) ?? 'text')
  const [body, setBody] = useState(thing.body)
  const [kind, setKind] = useState<ThingKind | ''>(thing.kind ?? '')
  const [sourceInput, setSourceInput] = useState('')
  const [locator, setLocator] = useState(thing.locator)
  const [note, setNote] = useState(thing.note)
  const [link, setLink] = useState(thing.link ?? '')
  const hasSource = Boolean(thing.sourceId)
  // A Link-kind thing whose own `link` field is empty — a row created or
  // edited straight in Notion, or one kept before Silva started filling
  // `link` at intake — otherwise sat here as an inert wall of text with no
  // card at all. See lib/kindInference.ts's `effectiveLink`.
  const readLink = effectiveLink(thing.body, thing.link)
  // The plain body paragraph and the link card would otherwise both print
  // the same bare URL when there's nothing else to the thing — the card
  // already carries it (as its title, if nothing better), so the paragraph
  // is redundant precisely in the case this exists to fix.
  const bodyIsJustTheLink = Boolean(readLink) && thing.body.trim() === readLink

  const plateRef = useDwell({
    onSeen: () => onSeen?.(thing.id),
    disabled: !onSeen,
  })

  function startEditing() {
    setBody(thing.body)
    setKind(thing.kind ?? '')
    setSourceInput(sourceInputValue(source))
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
    onEdit(
      thing.id,
      {
        body: body.trim(),
        kind: kind || null,
        locator: locator.trim(),
        note: note.trim(),
        link: link.trim() || null,
      },
      sourceInput.trim(),
    )
    setEditing(false)
  }

  if (editing) {
    return (
      <article className={styles.plate}>
        <div className={styles.editBlock}>
          {/* A passage is the whole object of this app and is very often
           *  several lines long — editing it through a 44px single-line input
           *  meant scrolling sideways through your own quotation. */}
          <TextAreaField label="The thing itself" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          <div className={styles.kindRow}>
            <select className={styles.select} value={kind} onChange={(e) => setKind(e.target.value as ThingKind | '')}>
              <option value="">No kind set</option>
              {ALL_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setKind(inferKind(body, hasSource, Boolean(link.trim())) ?? '')}
              disabled={!body.trim()}
            >
              Suggest a kind
            </Button>
          </div>
          {/* Ahead of Locator, matching SILVA.md's own label order (source ·
              locator · encountered · kept) — and because a source is the
              thing most likely to be lost if this edit is the last chance to
              record it. Plain typed text, same as at capture. */}
          <Field
            label="Source"
            hint="A book, an article, a person, a place — whatever this came from."
            value={sourceInput}
            onChange={(e) => setSourceInput(e.target.value)}
            placeholder="e.g. Shelby Foote — The Civil War"
          />
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
      {thing.image && thing.body && (
        <div className={styles.viewToggle} role="group" aria-label="Show photograph or transcribed text">
          <button
            type="button"
            className={styles.viewToggleBtn}
            data-active={viewMode === 'image'}
            onClick={() => {
              setViewMode('image')
              writeImageViewMode(thing.id, 'image')
            }}
          >
            Photograph
          </button>
          <button
            type="button"
            className={styles.viewToggleBtn}
            data-active={viewMode === 'text'}
            onClick={() => {
              setViewMode('text')
              writeImageViewMode(thing.id, 'text')
            }}
          >
            Text
          </button>
        </div>
      )}
      {thing.image && (!thing.body || viewMode === 'image') && (
        <PlateImage image={thing.image} alt={thing.handle || 'A photographed page'} />
      )}
      {thing.body && !bodyIsJustTheLink && (!thing.image || viewMode === 'text') && <p className={styles.body}>{thing.body}</p>}
      {thing.note && <p className={styles.note}>{thing.note}</p>}
      <ThingLabel thing={thing} sourceTitle={source?.title} />
      {/* Named as clearings for anyone meeting a bare "What outlasts" on a
       *  plate with no idea what it refers to — the word appears nowhere
       *  else on this screen. */}
      {locusNames.length > 0 && (
        <p className={styles.clearings} aria-label={`In ${locusNames.length === 1 ? 'the clearing' : 'the clearings'} ${locusNames.join(', ')}`}>
          {locusNames.map((name) => (
            <span key={name} className={styles.clearingTag} title="A clearing this belongs to">{name}</span>
          ))}
        </p>
      )}
      {readLink && <LinkCard url={readLink} />}
      <div className={styles.plateActions}>
        <Button size="sm" variant="ghost" onClick={startEditing}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={copyBody}>{copied ? 'Copied' : 'Copy'}</Button>
        {/* The way out of the forest. Without it, "compost, not debt" only
         *  applied before a thing was kept — after that the sole way to
         *  remove anything was deleting it in Notion, which is the one route
         *  that strands a path with a dangling end. No confirm, because
         *  release is the one action here that already offers a real way
         *  back (App.tsx's undo toast restores the exact prior state). */}
        {onRelease && (
          <Button size="sm" variant="ghost" onClick={() => onRelease(thing.id)}>Release</Button>
        )}
        {/* Last, and the only one that asks first — the order runs from
         *  harmless to irreversible, so the sharp edge is never where a
         *  thumb lands by accident. */}
        {onDelete && (
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>Delete</Button>
        )}
      </div>
      {onDelete && (
        <ConfirmModal
          isOpen={confirmingDelete}
          title="Delete this thing"
          message="This leaves the collection for good, along with any path drawn to it. Notion keeps it in its own trash for 30 days if you need it back. To simply let it go instead, use Release — it stays in the collection as compost."
          confirmText="Delete"
          variant="danger"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false)
            onDelete(thing.id)
          }}
        />
      )}
      {children}
    </article>
  )
}

/** A photographed page, in the same framed, low-key treatment as a link
 *  card's own image (see LinkCard below) — a border and rounded corners,
 *  never a drop shadow: SILVA.md's "depth read through an inset line" rule
 *  applies as much to a photograph as to a plate. */
function PlateImage({ image, alt }: { image: string; alt: string }) {
  const src = usePhotoUrl(image)
  if (!src) return null
  return <img className={styles.image} src={src} alt={alt} loading="lazy" />
}

/** A link, shown the way a label would print it: host and path, without the
 *  scheme's noise, truncated rather than wrapping across the plate. */
function displayUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const shown = `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`
    return shown.length > 48 ? `${shown.slice(0, 48)}…` : shown
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url
  }
}

/**
 * A link's Open Graph card — image, title, description, site — the same
 * framed, low-key treatment as a photographed page's `.image` (a border and
 * rounded corners, no drop shadow, no vignette or colour fade), so a Link
 * and an Image thing read as visual cousins rather than two unrelated
 * kinds. Degrades gracefully at every stage: no fetch yet, a fetch with no
 * image, or a fetch that failed all fall back to the plain host/path line
 * this used to be unconditionally — nothing here ever blocks reading.
 */
function LinkCard({ url }: { url: string }) {
  const preview = useLinkPreview(url)

  if (!preview || (!preview.title && !preview.image)) {
    return (
      <p className={styles.linkRow}>
        <a className={styles.link} href={url} target="_blank" rel="noopener noreferrer">
          {displayUrl(url)}
        </a>
      </p>
    )
  }

  return (
    <a className={styles.linkCard} href={url} target="_blank" rel="noopener noreferrer">
      {preview.image && <img className={styles.linkCardImage} src={preview.image} alt="" loading="lazy" />}
      <span className={styles.linkCardBody}>
        <span className={styles.linkCardTitle}>{preview.title || displayUrl(url)}</span>
        {preview.description && <span className={styles.linkCardDesc}>{preview.description}</span>}
        <span className={styles.linkCardSite}>{preview.siteName}</span>
      </span>
    </a>
  )
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
  // "sown" and "grown" rather than "encountered" and "kept" — the two dates
  // are the two ends of the same life, and the nursery already casts an
  // arrival as a seedling waiting to be planted out or not. Label layer
  // only: the Notion properties are still `Encountered` and `Kept`, and
  // the *act* is still Keep. Verb and timestamp, not two names for one
  // thing — you keep it, and from that day it grows.
  const dated = thing.kept && thing.kept !== thing.encountered
    ? [{ field: 'sown', value: thing.encountered }, { field: 'grown', value: thing.kept }]
    : [{ field: 'grown', value: thing.kept ?? thing.encountered }]

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
