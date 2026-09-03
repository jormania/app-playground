import { useEffect, useMemo, useState } from 'react'
import { Button, Field, TextAreaField, ConfirmModal } from '../../ds'
import type { Thing } from '../lib/notion'
import type { Locus } from '../lib/loci'
import type { Source, SourceKind } from '../lib/sources'
import { orderWithinSource } from '../lib/sources'
import { SpecimenPlate } from './SpecimenPlate'
import { RootstockGraph } from './RootstockGraph'
import styles from './RootsView.module.css'

export interface RootsViewProps {
  things: Thing[]
  sources: Source[]
  loci: Locus[]
  onEditThing: (id: string, patch: Partial<Thing>, sourceInput?: string) => void
  onReleaseThing: (id: string) => void
  onDeleteThing: (id: string) => void
  /** Plants a passage taken out of a link's own page as a thing of its own
   *  (App.tsx's `handleCutting`) — the same plate action the Forest offers,
   *  so the two reading surfaces stay the same surface. */
  onCutting?: (thing: Thing, body: string) => void
  onDeleteSource: (id: string) => void
  /** Hearth's "Show the rootstock" — on by default, exactly like the
   *  crossing at the head of Paths. */
  showRootstock?: boolean
  onSeen: (id: string) => void
  onEditSource: (id: string, patch: Partial<Source>) => void
}

const KIND_OPTIONS: { value: SourceKind; label: string }[] = [
  { value: 'Book', label: 'Book' },
  { value: 'Article', label: 'Article' },
  { value: 'Film', label: 'Film' },
  { value: 'Conversation', label: 'Conversation' },
  { value: 'Song', label: 'Song' },
  { value: 'Self', label: 'Self' },
  { value: 'Unknown', label: 'Unknown' },
]

type Screen = { kind: 'list' } | { kind: 'detail'; sourceId: string }

/**
 * Roots — what a kept thing came from, as a place you can actually stand in
 * rather than a filter dropdown (SILVA.md gives a Source its own database,
 * with a Notes field; until now nothing in the app read it). Labelled
 * "Roots" rather than "Sources" in the app — a source is what feeds a kept
 * thing, the same relation a root has to what grows from it — while the
 * underlying Notion database keeps its own name, `Sources`, same as every
 * other label-layer rename in this app (see SILVA.md's naming-map table).
 *
 * Deliberately not a shelf: SILVA.md's own line in the Forest's demo forest
 * is "a library is organized so you can find what you already know you
 * want" — the thing this app exists not to be. What keeps this from
 * becoming one is that it only ever holds sources a kept thing actually
 * points at (no cataloguing something you haven't drawn from yet), a
 * source's passages appear in the order they sit in it rather than any
 * sortable index, and there is nothing here to browse *by* — no genre, no
 * rating, no shelf. It's "what else came from here", reached by source
 * rather than by thing, same as Clearings is "what else belongs here"
 * reached by locus.
 */
export function RootsView({ things, sources, loci, onEditThing, onReleaseThing, onDeleteThing, onCutting, onDeleteSource, onSeen, onEditSource, showRootstock = true }: RootsViewProps) {
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const locusById = useMemo(() => new Map(loci.map((l) => [l.id, l])), [loci])

  const usedSourceIds = useMemo(
    () => new Set(things.filter((t) => t.state === 'Kept' && t.sourceId).map((t) => t.sourceId as string)),
    [things],
  )
  const usedSources = useMemo(
    () => sources.filter((s) => usedSourceIds.has(s.id)).sort((a, b) => a.title.localeCompare(b.title)),
    [sources, usedSourceIds],
  )

  const missingSource = screen.kind === 'detail' && !usedSources.some((s) => s.id === screen.sourceId)
  useEffect(() => {
    if (missingSource) setScreen({ kind: 'list' })
  }, [missingSource])

  if (screen.kind === 'list') {
    return (
      <div className={styles.wrap}>
        {showRootstock && <RootstockGraph things={things} sources={sources} />}
        {usedSources.length === 0 ? (
          <p className={styles.empty}>
            Nothing kept has a source yet. Name where something came from when you keep
            it, and it will gather here.
          </p>
        ) : (
          <ul className={styles.list}>
            {usedSources.map((source) => {
              const count = things.filter((t) => t.state === 'Kept' && t.sourceId === source.id).length
              return (
                <li key={source.id}>
                  <button
                    type="button"
                    className={styles.sourceCard}
                    onClick={() => setScreen({ kind: 'detail', sourceId: source.id })}
                  >
                    {source.cover && <img className={styles.cover} src={source.cover} alt="" loading="lazy" />}
                    <div className={styles.sourceCardBody}>
                      <div className={styles.sourceCardHeader}>
                        <strong>{source.title || 'Untitled'}</strong>
                        <span className={styles.meta}>
                          {count} thing{count === 1 ? '' : 's'} →
                        </span>
                      </div>
                      {(source.author || source.kind) && (
                        <p className={styles.byline}>
                          {[source.author, source.kind].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  const source = usedSources.find((s) => s.id === screen.sourceId)
  if (!source) return null

  const passages = orderWithinSource(things.filter((t) => t.state === 'Kept' && t.sourceId === source.id))

  return (
    <SourceDetail
      source={source}
      passages={passages}
      locusById={locusById}
      onBack={() => setScreen({ kind: 'list' })}
      onEditThing={onEditThing}
      onReleaseThing={onReleaseThing}
      onDeleteThing={onDeleteThing}
      onDeleteSource={onDeleteSource}
      onSeen={onSeen}
      onCutting={onCutting}
      onEditSource={onEditSource}
      allSources={sources}
    />
  )
}

function SourceDetail({
  source,
  passages,
  locusById,
  onBack,
  onEditThing,
  onReleaseThing,
  onDeleteThing,
  onDeleteSource,
  onSeen,
  onCutting,
  onEditSource,
  allSources,
}: {
  source: Source
  passages: Thing[]
  locusById: Map<string, Locus>
  onBack: () => void
  onEditThing: (id: string, patch: Partial<Thing>, sourceInput?: string) => void
  onReleaseThing: (id: string) => void
  onDeleteThing: (id: string) => void
  onDeleteSource: (id: string) => void
  onSeen: (id: string) => void
  onCutting?: (thing: Thing, body: string) => void
  onEditSource: (id: string, patch: Partial<Source>) => void
  /** Offered back as the Source field on a plate is typed — the same
   *  autocomplete intake has, for the same duplicate-source reason. */
  allSources: Source[]
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(source.title)
  const [author, setAuthor] = useState(source.author)
  const [kind, setKind] = useState<SourceKind | ''>(source.kind ?? '')
  const [notes, setNotes] = useState(source.notes)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function startEditing() {
    setTitle(source.title)
    setAuthor(source.author)
    setKind(source.kind ?? '')
    setNotes(source.notes)
    setEditing(true)
  }

  return (
    <div className={styles.wrap}>
      <Button size="sm" variant="ghost" onClick={onBack}>← Roots</Button>

      {editing ? (
        <div className={styles.editBlock}>
          <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Field label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <div className={styles.kindRow}>
            <span className={styles.kindLabel}>Kind</span>
            <select
              className={styles.select}
              value={kind}
              onChange={(e) => setKind(e.target.value as SourceKind | '')}
            >
              <option value="">No kind set</option>
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <TextAreaField
            label="Notes"
            hint="Your note on the source itself — not any one passage from it."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          {/* Delete sits apart on the left, away from the Cancel/Save pair a
           *  thumb travels to — destructive first in the source order so a
           *  screen reader meets it before the ordinary way out, but never
           *  adjacent to the button you press to finish an edit.
           *
           *  Cancel and Save are grouped in their own flex box rather than
           *  split from Delete by a stretchy spacer: a spacer has no width
           *  of its own to give up, so on a narrow phone the row didn't wrap
           *  — it simply overflowed past the left edge of the screen, taking
           *  the leading half of "Delete this source" with it. Two groups
           *  with `flex-wrap` lets Delete drop to its own line above Cancel
           *  and Save when there isn't room for all three. */}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>Delete this source</Button>
            <div className={styles.actionsRight}>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button
                disabled={!title.trim()}
                onClick={() => {
                  onEditSource(source.id, { title: title.trim(), author: author.trim(), kind: kind || null, notes: notes.trim() })
                  setEditing(false)
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.detailHeader}>
          {source.cover && <img className={styles.detailCover} src={source.cover} alt="" loading="lazy" />}
          <div className={styles.detailHeaderBody}>
            <h3 className={styles.screenTitle}>{source.title || 'Untitled'}</h3>
            {(source.author || source.kind) && (
              <p className={styles.byline}>{[source.author, source.kind].filter(Boolean).join(' · ')}</p>
            )}
            {source.notes && <p className={styles.notes}>{source.notes}</p>}
          </div>
          <Button size="sm" variant="ghost" onClick={startEditing}>Edit source</Button>
        </div>
      )}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>
          {passages.length} thing{passages.length === 1 ? '' : 's'} from here
        </h4>
        <div className={styles.plates}>
          {passages.map((thing) => (
            <SpecimenPlate
              key={thing.id}
              thing={thing}
              source={source}
              locusNames={thing.lociIds.map((id) => locusById.get(id)?.name).filter((n): n is string => Boolean(n))}
              allSources={allSources}
              onEdit={onEditThing}
              onRelease={onReleaseThing}
              onDelete={onDeleteThing}
              onCutting={onCutting}
              onSeen={onSeen}
            />
          ))}
        </div>
      </section>

      <ConfirmModal
        isOpen={confirmingDelete}
        title="Delete this source"
        message={
          passages.length > 0
            ? `"${source.title || 'Untitled'}" will be deleted. The ${passages.length} thing${passages.length === 1 ? '' : 's'} from it stay exactly where they are — they simply stop saying where they came from.`
            : `"${source.title || 'Untitled'}" will be deleted. Nothing came from it, so nothing else changes.`
        }
        confirmText="Delete"
        variant="danger"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false)
          onDeleteSource(source.id)
        }}
      />
    </div>
  )
}
