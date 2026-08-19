import { useMemo, useState } from 'react'
import { Button, Field } from '../../ds'
import type { Thing, ThingKind } from '../lib/notion'
import type { Source } from '../lib/sources'
import { inferKind } from '../lib/kindInference'
import styles from './ForestView.module.css'

export interface ForestViewProps {
  things: Thing[]
  sources: Source[]
  onEdit: (id: string, patch: Partial<Thing>) => void
}

const ALL_KINDS: ThingKind[] = ['Passage', 'Observation', 'Dialogue', 'Question', 'Image', 'Link', 'Fragment', 'Mine']

/** The kept collection, read one thing at a time — typeset to be read, not a
 *  row in a table (SILVA.md: "Scroll is a walk, not a list"). Sorted by most
 *  recently kept; ordering by affinity (loci, mycorrhiza) is a later session. */
export function ForestView({ things, sources, onEdit }: ForestViewProps) {
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])

  const kept = [...things]
    .filter((thing) => thing.state === 'Kept')
    .sort((a, b) => (b.kept || '').localeCompare(a.kept || ''))

  if (kept.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing kept yet. Things you keep from the understory gather here.
      </p>
    )
  }

  return (
    <div className={styles.forest}>
      {kept.map((thing) => {
        const sourceTitle = thing.sourceId ? sourceById.get(thing.sourceId)?.title : undefined
        return (
          <SpecimenCard key={thing.id} thing={thing} sourceTitle={sourceTitle} onEdit={onEdit} hasSource={Boolean(thing.sourceId)} />
        )
      })}
    </div>
  )
}

function SpecimenCard({
  thing,
  sourceTitle,
  hasSource,
  onEdit,
}: {
  thing: Thing
  sourceTitle?: string
  hasSource: boolean
  onEdit: (id: string, patch: Partial<Thing>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(thing.body)
  const [kind, setKind] = useState<ThingKind | ''>(thing.kind ?? '')
  const [locator, setLocator] = useState(thing.locator)
  const [note, setNote] = useState(thing.note)
  const [link, setLink] = useState(thing.link ?? '')

  function startEditing() {
    setBody(thing.body)
    setKind(thing.kind ?? '')
    setLocator(thing.locator)
    setNote(thing.note)
    setLink(thing.link ?? '')
    setEditing(true)
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

  if (!editing) {
    return (
      <article className={styles.plate}>
        {thing.kind && <p className={styles.kind}>{thing.kind}</p>}
        <p className={styles.body}>{thing.body}</p>
        {thing.note && <p className={styles.note}>{thing.note}</p>}
        <ThingLabel thing={thing} sourceTitle={sourceTitle} />
        <Button size="sm" variant="ghost" onClick={startEditing}>Edit</Button>
      </article>
    )
  }

  return (
    <article className={styles.plate}>
      <div className={styles.editBlock}>
        <Field label="Body" value={body} onChange={(e) => setBody(e.target.value)} />
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
        <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        <Field label="Link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" disabled={!body.trim()} onClick={save}>Save</Button>
        </div>
      </div>
    </article>
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
