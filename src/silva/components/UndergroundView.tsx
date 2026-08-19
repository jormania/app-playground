import { useState } from 'react'
import { Button, TextAreaField, ConfirmModal } from '../../ds'
import type { Thing } from '../lib/notion'
import type { Locus } from '../lib/loci'
import type { Path } from '../lib/paths'
import { UndergroundGraph } from './UndergroundGraph'
import { ExpandableText } from './ExpandableText'
import styles from './UndergroundView.module.css'

export interface UndergroundViewProps {
  things: Thing[]
  loci: Locus[]
  paths: Path[]
  /** Cached/indexed embedding vectors, owned by App — the graph draws its
   *  mycorrhiza from these and never loads the model itself. */
  vectorsById: Map<string, Float32Array>
  onMake: (fromId: string, toId: string, why: string) => void
  onEditWhy: (pathId: string, why: string) => void
  onRemove: (pathId: string) => void
  /** Settings' "Show the graph" — on by default. Off leaves the path list,
   *  the make-a-path form and paths themselves untouched; only the
   *  whole-forest visualisation is hidden, for the density it can reach at
   *  real scale rather than because it's wrong at smaller ones. */
  showGraph?: boolean
}

function summarize(thing: Thing | undefined, max = 60): string {
  if (!thing) return '(no longer here)'
  return thing.body.length > max ? `${thing.body.slice(0, max)}…` : thing.body
}

// A path's From/To can be a full passage, not just a line — preview a
// reasonable chunk and let the reader expand rather than dumping the whole
// body into the list by default.
const CONNECTION_PREVIEW_LENGTH = 160

/** Underground — the connections you've made (SILVA.md "Views"). The graph
 *  (solid Paths, faint unclickable mycorrhiza, clustered by locus) is the
 *  primary view; the make/edit/remove tools below it are unchanged from
 *  Session 6. */
export function UndergroundView({
  things,
  loci,
  paths,
  vectorsById,
  onMake,
  onEditWhy,
  onRemove,
  showGraph = true,
}: UndergroundViewProps) {
  const [making, setMaking] = useState(false)
  const kept = things.filter((t) => t.state === 'Kept')
  const byId = new Map(things.map((t) => [t.id, t]))

  return (
    <div className={styles.wrap}>
      {showGraph && <UndergroundGraph things={things} loci={loci} paths={paths} vectorsById={vectorsById} />}

      {making ? (
        <MakeForm
          kept={kept}
          onCancel={() => setMaking(false)}
          onMake={(fromId, toId, why) => {
            onMake(fromId, toId, why)
            setMaking(false)
          }}
        />
      ) : (
        <Button size="sm" onClick={() => setMaking(true)} disabled={kept.length < 2}>
          Walk a new path
        </Button>
      )}

      {paths.length === 0 ? (
        <p className={styles.empty}>
          No paths yet. Walk one when you notice two kept things belong together — say
          why, and it stays as a record of your own thinking.
        </p>
      ) : (
        <ul className={styles.list}>
          {paths.map((path) => (
            <PathRow
              key={path.id}
              path={path}
              fromThing={path.fromId ? byId.get(path.fromId) : undefined}
              toThing={path.toId ? byId.get(path.toId) : undefined}
              onEditWhy={onEditWhy}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function MakeForm({
  kept,
  onMake,
  onCancel,
}: {
  kept: Thing[]
  onMake: (fromId: string, toId: string, why: string) => void
  onCancel: () => void
}) {
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [why, setWhy] = useState('')

  const canMake = fromId && toId && fromId !== toId && why.trim().length > 0

  return (
    <div className={styles.form}>
      <div className={styles.pickRow}>
        <select className={styles.select} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">From…</option>
          {kept.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === toId}>{summarize(t, 40)}</option>
          ))}
        </select>
        <span className={styles.arrow}>→</span>
        <select className={styles.select} value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">To…</option>
          {kept.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === fromId}>{summarize(t, 40)}</option>
          ))}
        </select>
      </div>
      <TextAreaField
        label="What did you see between them?"
        hint="Required — a path is a record of this, not just the connection itself."
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        placeholder="Why these belong together"
        rows={3}
      />
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={!canMake} onClick={() => onMake(fromId, toId, why.trim())}>
          Walk this path
        </Button>
      </div>
    </div>
  )
}

function ConnectionEnd({ label, thing }: { label: string; thing: Thing | undefined }) {
  const body = thing?.body ?? '(no longer here)'

  return (
    <div className={styles.connectionEnd}>
      <span className={styles.connectionLabel}>{label}</span>
      <ExpandableText
        text={body}
        max={CONNECTION_PREVIEW_LENGTH}
        textClassName={styles.connectionBody}
        toggleClassName={styles.expandToggle}
      />
    </div>
  )
}

function PathRow({
  path,
  fromThing,
  toThing,
  onEditWhy,
  onRemove,
}: {
  path: Path
  fromThing: Thing | undefined
  toThing: Thing | undefined
  onEditWhy: (pathId: string, why: string) => void
  onRemove: (pathId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [why, setWhy] = useState(path.why)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  return (
    <li className={styles.row}>
      <div className={styles.connection}>
        <ConnectionEnd label="From" thing={fromThing} />
        <ConnectionEnd label="To" thing={toThing} />
      </div>

      {editing ? (
        <div className={styles.editBlock}>
          <TextAreaField label="What did you see between them?" value={why} onChange={(e) => setWhy(e.target.value)} rows={3} />
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={() => { setWhy(path.why); setEditing(false) }}>Cancel</Button>
            <Button
              size="sm"
              disabled={!why.trim()}
              onClick={() => { onEditWhy(path.id, why.trim()); setEditing(false) }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className={styles.why}>{path.why}</p>
      )}

      <div className={styles.rowFooter}>
        <span className={styles.meta}>
          {path.origin && <span className={styles.originBadge}>{path.origin}</span>} made {path.made}
        </span>
        {!editing && (
          <div className={styles.rowActions}>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit why</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingRemove(true)}>Remove</Button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmingRemove}
        title="Remove this path"
        message="This removes the path only — the two things it connects are never affected."
        confirmText="Remove"
        variant="danger"
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={() => { onRemove(path.id); setConfirmingRemove(false) }}
      />
    </li>
  )
}
