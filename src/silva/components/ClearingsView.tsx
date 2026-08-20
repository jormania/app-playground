import { useEffect, useState } from 'react'
import { Button, Field, TextAreaField, ConfirmModal } from '../../ds'
import type { Thing } from '../lib/notion'
import type { Locus } from '../lib/loci'
import { ThingPicker } from './ThingPicker'
import { ExpandableText } from './ExpandableText'
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
  onSplit: (locusId: string, thingIds: string[], name: string, meaning: string) => void
}

type Screen = { kind: 'list' } | { kind: 'coin' } | { kind: 'detail'; locusId: string }

// A member's body can be a full passage — preview it and let the reader
// expand rather than filling the member list with pages of text.
const MEMBER_PREVIEW_LENGTH = 80

/** Clearings — the loci you've coined (SILVA.md "Views"). A locus can never
 *  be assigned at capture time, so every membership action (coin, rename,
 *  add, remove, merge, dissolve) lives here, not in the Forest or
 *  Understory. This is a heavier, more deliberate screen than Keep/Release
 *  on purpose — coining a clearing is a retrospective judgment call, not a
 *  quick daily action, so the copy here explains itself more than
 *  elsewhere in the app. */
export function ClearingsView({ things, loci, onCoin, onRename, onAddThings, onRemoveThing, onMerge, onDissolve, onSplit }: ClearingsViewProps) {
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const kept = things.filter((thing) => thing.state === 'Kept')

  // A clearing can disappear from under the detail screen (dissolved, or
  // merged away). Falling back to the list belongs in an effect — doing it
  // inline during render was a state update mid-render, which React only
  // tolerates by accident.
  const missingLocus = screen.kind === 'detail' && !loci.some((l) => l.id === screen.locusId)
  useEffect(() => {
    if (missingLocus) setScreen({ kind: 'list' })
  }, [missingLocus])

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
              // Kept-only: a released (or returned-to-nursery) thing has left
              // the collection, and a clearing that still counts it is
              // exactly the debt SILVA.md's "compost, not debt" rules out.
              const memberCount = kept.filter((t) => t.lociIds.includes(locus.id)).length
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

  if (!locus) return null

  return (
    <LocusDetail
      locus={locus}
      loci={loci}
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
      onSplit={(thingIds, name, meaning) => onSplit(locus.id, thingIds, name, meaning)}
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
      <TextAreaField
        label="What you meant by it"
        hint="Shown at the top of the clearing whenever you open it."
        value={meaning}
        onChange={(e) => setMeaning(e.target.value)}
        placeholder="Why these belong together"
        rows={3}
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
  kept,
  onBack,
  onRename,
  onAddThings,
  onRemoveThing,
  onMerge,
  onDissolve,
  onSplit,
}: {
  locus: Locus
  loci: Locus[]
  kept: Thing[]
  onBack: () => void
  onRename: (locusId: string, name: string, meaning: string) => void
  onAddThings: (locusId: string, thingIds: string[]) => void
  onRemoveThing: (locusId: string, thingId: string) => void
  onMerge: (survivorId: string) => void
  onDissolve: () => void
  onSplit: (thingIds: string[], name: string, meaning: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(locus.name)
  const [editMeaning, setEditMeaning] = useState(locus.meaning)
  const [adding, setAdding] = useState(false)
  const [addSelection, setAddSelection] = useState<Set<string>>(new Set())
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [confirmingMerge, setConfirmingMerge] = useState(false)
  const [confirmingDissolve, setConfirmingDissolve] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [splitSelection, setSplitSelection] = useState<Set<string>>(new Set())
  const [splitName, setSplitName] = useState('')

  // Kept-only, same reasoning as the list screen's memberCount above — a
  // released member should disappear from its clearing, not linger in it.
  const members = kept.filter((t) => t.lociIds.includes(locus.id))
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

  function toggleSplit(id: string) {
    setSplitSelection((prev) => {
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
          <TextAreaField label="What you meant by it" value={editMeaning} onChange={(e) => setEditMeaning(e.target.value)} rows={3} />
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
              <div className={styles.memberBody}>
                <ExpandableText
                  text={thing.body}
                  max={MEMBER_PREVIEW_LENGTH}
                  textClassName={styles.memberText}
                  toggleClassName={styles.expandToggle}
                />
              </div>
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

      {members.length >= 2 && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Split into a new clearing</h4>
          <p className={styles.sectionHint}>
            Pick which things belong to a different pattern — they move to the new
            clearing, and stay exactly where they are here otherwise.
          </p>
          {splitting ? (
            <>
              <ThingPicker things={members} selectedIds={splitSelection} onToggle={toggleSplit} />
              <Field
                label="What do you call the new clearing?"
                value={splitName}
                onChange={(e) => setSplitName(e.target.value)}
                placeholder="e.g. Small attentions"
              />
              <div className={styles.actions}>
                <Button
                  variant="ghost"
                  onClick={() => { setSplitting(false); setSplitSelection(new Set()); setSplitName('') }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={splitSelection.size === 0 || !splitName.trim()}
                  onClick={() => {
                    onSplit([...splitSelection], splitName.trim(), '')
                    setSplitting(false)
                    setSplitSelection(new Set())
                    setSplitName('')
                  }}
                >
                  Split off {splitSelection.size} thing{splitSelection.size === 1 ? '' : 's'}
                </Button>
              </div>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setSplitting(true)}>Split this clearing</Button>
          )}
        </section>
      )}

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
