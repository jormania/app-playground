import { useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button, Field, ConfirmModal } from '../../ds'
import {
  sortWardrobes, checkWardrobeName, describeDeletion, nextOrder, isLastActive,
  garmentCount, type Wardrobe,
} from '../lib/wardrobes.ts'
import type { Garment } from '../lib/types.ts'

interface Props {
  wardrobes: Wardrobe[]
  garments: Garment[]
  busy: boolean
  progress: string
  onCreate: (name: string, order: number) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onToggleActive: (id: string, active: boolean) => Promise<void>
  onDelete: (wardrobe: Wardrobe) => Promise<void>
}

/**
 * Add, rename, switch on/off and delete wardrobes.
 *
 * Lives in Settings rather than on the Wardrobe tab: this is setup, done rarely,
 * and putting destructive controls next to the everyday grid invites accidents.
 */
export default function WardrobeManager({
  wardrobes, garments, busy, progress,
  onCreate, onRename, onToggleActive, onDelete,
}: Props) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Wardrobe | null>(null)

  const ordered = sortWardrobes(wardrobes)

  async function add() {
    const check = checkWardrobeName(newName, wardrobes)
    if (!check.ok) {
      setError(check.error ?? 'That name will not work.')
      return
    }
    setError('')
    setWarning(check.warning ?? '')
    await onCreate(newName.trim(), nextOrder(wardrobes))
    setNewName('')
  }

  async function rename(wardrobe: Wardrobe, name: string) {
    const check = checkWardrobeName(name, wardrobes, wardrobe.id)
    // Renaming is only committed when it's valid; an empty box on blur simply
    // reverts, rather than leaving a nameless chip in the filter.
    if (!check.ok) return
    if (name.trim() === wardrobe.name) return
    await onRename(wardrobe.id, name.trim())
  }

  return (
    <section className="fc-settings-group">
      <h2>Wardrobes</h2>
      <p className="fc-settings-hint">
        The places your clothes live. Switch one off to hide it for a while —
        nothing is thrown away.
      </p>

      <ul className="fc-wardrobe-list">
        {ordered.map((w) => {
          const count = garmentCount(w.id, garments)
          const lastOn = w.active && isLastActive(w.id, wardrobes)
          return (
            <li key={w.id} className="fc-wardrobe-row" data-inactive={!w.active}>
              <input
                className="fc-wardrobe-name"
                defaultValue={w.name}
                aria-label={`Name of ${w.name}`}
                disabled={busy}
                onBlur={(e) => { void rename(w, e.target.value) }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              />
              <span className="fc-wardrobe-count">{count}</span>
              <label className="fc-wardrobe-toggle">
                <input
                  type="checkbox"
                  checked={w.active}
                  disabled={busy}
                  onChange={(e) => { void onToggleActive(w.id, e.target.checked) }}
                />
                <span className="fc-visually-hidden">
                  {w.active ? `Switch off ${w.name}` : `Switch on ${w.name}`}
                </span>
                <span aria-hidden="true">{w.active ? 'On' : 'Off'}</span>
              </label>
              <button
                type="button"
                className="fc-wardrobe-delete"
                aria-label={`Delete ${w.name}`}
                disabled={busy}
                onClick={() => setPendingDelete(w)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
              {lastOn && (
                <p className="fc-wardrobe-note">
                  This is your only one switched on — turning it off empties the app
                  until you turn something back on.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="fc-add-wardrobe">
        <Field
          label="Add a wardrobe"
          value={newName}
          placeholder="Nan's"
          disabled={busy}
          error={error || undefined}
          onChange={(e) => { setNewName(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
        />
        <Button variant="secondary" onClick={() => void add()} disabled={busy || !newName.trim()}>
          <Plus size={16} aria-hidden="true" /> Add
        </Button>
      </div>

      {warning && <p className="fc-settings-hint">{warning}</p>}
      {busy && progress && (
        <p className="fc-status" role="status">
          <Loader2 size={14} className="fc-spin" aria-hidden="true" /> {progress}
        </p>
      )}

      {pendingDelete && (
        <ConfirmModal
          isOpen
          title="Delete this wardrobe?"
          message={describeDeletion(pendingDelete, garments).message}
          confirmText="Delete"
          cancelText="Keep it"
          variant="danger"
          onConfirm={() => {
            const target = pendingDelete
            setPendingDelete(null)
            void onDelete(target)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  )
}
