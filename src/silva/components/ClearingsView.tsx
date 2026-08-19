import { useState } from 'react'
import { Button, Field, ConfirmModal } from '../../ds'
import type { Thing } from '../lib/notion'
import type { Locus } from '../lib/loci'
import { ThingPicker } from './ThingPicker'
import styles from './ClearingsView.module.css'

export interface ClearingsViewProps {
  things: Thing[]
  loci: Locus[]
  onCoin: (name: string, meaning: string, seedThingIds: string[]) => void
  onRename: (locusId: string, name: string, meaning: string) => void
  onAddThings: (locusId: string, thingIds: string[]) => void
  onRemoveThing: (locusId: string, thingId: string) => void
  onMerge: (survivorId: string, mergeAwayId: string) => void
  onDissolve: (locusId: string) => void
}

type Screen = { kind: 'list' } | { kind: 'coin' } | { kind: 'detail'; locusId: string }

/** Clearings — the loci you've coined (SILVA.md "Views"). A locus can never
 *  be assigned at capture time, so every membership action (coin, rename,
 *  add, remove, merge, dissolve) lives here, not in the Forest or
 *  Understory. This is a heavier, more deliberate screen than Keep/Release
 *  on purpose — coining a clearing is a retrospective judgment call, not a
 *  quick daily action, so the copy here explains itself more than
 *  elsewhere in the app. */
export function ClearingsView({ things, loci, onCoin, onRename, onAddThings, onRemoveThing, onMerge, onDissolve }: ClearingsViewProps) {
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const kept = things.filter((thing) => thing.state === 'Kept')

  if (screen.kind === 'list') {
    return (
      <div className={styles.wrap}>
        <div className={styles.intro}>
          <Button size="sm" onClick={() => setScreen({ kind: 'coin' })}>Coin a new clearing</Button>
        </div>
        {loci.length === 0 ? (
          <p className={styles.empty}>
            No clearings yet. Once a few kept things feel like they belong together, coin
            one to name what you noticed.
          </p>
        ) : (
          <ul className={styles.list}>
            {loci.map((locus) => {
              const memberCount = things.filter((t) => t.lociIds.includes(locus.id)).length
              return (
                <li key={locus.id}>
                  <button
                    type="button"
                    className={styles.locusCard}
                    onClick={() => setScreen({ kind: 'detail', locusId: locus.id })}
                  >
                    <div className={styles.locusCardHeader}>
                      <strong>{locus.name}</strong>
                      <span className={styles.meta}>
                        {memberCount} thing{memberCount === 1 ? '' : 's'} →
                      </span>
                    </div>
                    {locus.meaning && <p className={styles.meaning}>{locus.meaning}</p>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  if (screen.kind === 'coin') {
    return (
      <CoinForm
        kept={kept}
        onCancel={() => setScreen({ kind: 'list' })}
        onCoin={(name, meaning, seedIds) => {
          onCoin(name, meaning, seedIds)
          setScreen({ kind: 'list' })
        }}
      />
    )
  }

  const locus = loci.find((l) => l.id === screen.locusId)
  if (!locus) {
    setScreen({ kind: 'list' })
    return null
  }

  return (
    <LocusDetail
      locus={locus}
      loci={loci}
      things={things}
      kept={kept}
      onBack={() => setScreen({ kind: 'list' })}
      onRename={onRename}
      onAddThings={onAddThings}
      onRemoveThing={onRemoveThing}
      onMerge={(survivorId) => {
        // "Combine into X" — X (the dropdown pick) survives; the clearing
        // being viewed is the one that gets merged away and dissolved.
        onMerge(survivorId, locus.id)
        setScreen({ kind: 'list' })
      }}
      onDissolve={() => {
        onDissolve(locus.id)
        setScreen({ kind: 'list' })
      }}
    />
  )
}

function CoinForm({
  kept,
  onCoin,
  onCancel,
}: {
  kept: Thing[]
  onCoin: (name: string, meaning: string, seedThingIds: string[]) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [meaning, setMeaning] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={styles.wrap}>
      <Button size="sm" variant="ghost" onClick={onCancel}>← Clearings</Button>
      <h3 className={styles.screenTitle}>Coin a clearing</h3>
      <p className={styles.introText}>
        Name the pattern you've noticed, in your own words — this is a place, not a
        category, so it only needs to make sense to you.
      </p>
      <Field
        label="What do you call this clearing?"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Small attentions"
      />
      <Field
        label="What you meant by it"
        hint="Shown at the top of the clearing whenever you open it."
        value={meaning}
        onChange={(e) => setMeaning(e.target.value)}
        placeholder="Why these belong together"
      />
      <div>
        <p className={styles.pickerLabel}>
          Pick which kept things belong here — optional, you can add more later:
        </p>
        <ThingPicker things={kept} selectedIds={selectedIds} onToggle={toggle} />
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={!name.trim()} onClick={() => onCoin(name.trim(), meaning.trim(), [...selectedIds])}>
          Coin this clearing
        </Button>
      </div>
    </div>
  )
}

function LocusDetail({
  locus,
  loci,
  things,
  kept,
  onBack,
  onRename,
  onAddThings,
  onRemoveThing,
  onMerge,
  onDissolve,
}: {
  locus: Locus
  loci: Locus[]
  things: Thing[]
  kept: Thing[]
  onBack: () => void
  onRename: (locusId: string, name: string, meaning: string) => void
  onAddThings: (locusId: string, thingIds: string[]) => void
  onRemoveThing: (locusId: string, thingId: string) => void
  onMerge: (survivorId: string) => void
  onDissolve: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(locus.name)
  const [editMeaning, setEditMeaning] = useState(locus.meaning)
  const [adding, setAdding] = useState(false)
  const [addSelection, setAddSelection] = useState<Set<string>>(new Set())
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [confirmingMerge, setConfirmingMerge] = useState(false)
  const [confirmingDissolve, setConfirmingDissolve] = useState(false)

  const members = things.filter((t) => t.lociIds.includes(locus.id))
  const nonMembers = kept.filter((t) => !t.lociIds.includes(locus.id))
  const otherLoci = loci.filter((l) => l.id !== locus.id)

  function toggleAdd(id: string) {
    setAddSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startEditing() {
    setEditName(locus.name)
    setEditMeaning(locus.meaning)
    setEditing(true)
  }

  return (
    <div className={styles.wrap}>
      <Button size="sm" variant="ghost" onClick={onBack}>← Clearings</Button>

      {editing ? (
        <div className={styles.editBlock}>
          <Field label="What do you call this clearing?" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Field label="What you meant by it" value={editMeaning} onChange={(e) => setEditMeaning(e.target.value)} />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              disabled={!editName.trim()}
              onClick={() => {
                onRename(locus.id, editName.trim(), editMeaning.trim())
                setEditing(false)
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.detailHeader}>
          <div>
            <h3 className={styles.screenTitle}>{locus.name}</h3>
            {locus.meaning && <p className={styles.meaning}>{locus.meaning}</p>}
            <p className={styles.meta}>coined {locus.coined}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={startEditing}>Edit</Button>
        </div>
      )}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Things in this clearing</h4>
        <ul className={styles.memberList}>
          {members.map((thing) => (
            <li key={thing.id} className={styles.memberRow}>
              <span>{thing.body.length > 80 ? `${thing.body.slice(0, 80)}…` : thing.body}</span>
              <Button size="sm" variant="ghost" onClick={() => onRemoveThing(locus.id, thing.id)}>Remove</Button>
            </li>
          ))}
          {members.length === 0 && <p className={styles.empty}>Nothing here yet.</p>}
        </ul>

        {adding ? (
          <>
            <ThingPicker things={nonMembers} selectedIds={addSelection} onToggle={toggleAdd} />
            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => { setAdding(false); setAddSelection(new Set()) }}>Cancel</Button>
              <Button
                disabled={addSelection.size === 0}
                onClick={() => {
                  onAddThings(locus.id, [...addSelection])
                  setAdding(false)
                  setAddSelection(new Set())
                }}
              >
                Add to this clearing
              </Button>
            </div>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>Add more things from the forest</Button>
        )}
      </section>

      {otherLoci.length > 0 && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Combine with another clearing</h4>
          <p className={styles.sectionHint}>
            Everything here moves to the clearing you pick, and this one is dissolved.
          </p>
          <div className={styles.mergeRow}>
            <select
              className={styles.select}
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
            >
              <option value="">Choose a clearing…</option>
              {otherLoci.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={!mergeTargetId} onClick={() => setConfirmingMerge(true)}>
              Combine
            </Button>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Dissolve this clearing</h4>
        <p className={styles.sectionHint}>
          Removes the clearing itself. The things in it are untouched — they simply won't
          show up here anymore.
        </p>
        <Button size="sm" variant="danger" onClick={() => setConfirmingDissolve(true)}>Dissolve</Button>
      </section>

      <ConfirmModal
        isOpen={confirmingMerge}
        title="Combine clearings"
        message={`Move every thing in "${locus.name}" into "${otherLoci.find((l) => l.id === mergeTargetId)?.name}", then dissolve "${locus.name}"? The things themselves are never affected.`}
        confirmText="Combine"
        variant="danger"
        onCancel={() => setConfirmingMerge(false)}
        onConfirm={() => {
          onMerge(mergeTargetId)
          setConfirmingMerge(false)
        }}
      />

      <ConfirmModal
        isOpen={confirmingDissolve}
        title="Dissolve this clearing"
        message={`"${locus.name}" will be dissolved. Nothing is lost — the things in it stay exactly where they are, just with no locus.`}
        confirmText="Dissolve"
        variant="danger"
        onCancel={() => setConfirmingDissolve(false)}
        onConfirm={onDissolve}
      />
    </div>
  )
}
