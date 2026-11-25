/**
 * Add or edit a client, source or venue. Deliberately small: a name and the
 * two or three facts that change a number or a tax suggestion. Not a CRM.
 */
import { useState } from 'react'
import { Button, Modal, SettingsToggle } from '../../ds'
import type { Client, Source, Venue } from '../domain/types'
import { CLIENT_COUNTRY, CLIENT_KIND, DEAL, DEAL_HINT, SOURCE_TAX_DEFAULT, SOURCE_TYPE, VENUE_TYPE, options } from '../domain/vocabulary'
import { useInflow } from '../app/state'
import type { Entity, EntityKind } from '../store/repo'
import { NumberInput, SelectInput, TextArea, TextInput } from './fields'
import styles from '../styles/ui.module.css'

export const KIND_LABEL: Record<EntityKind, string> = { client: 'client', source: 'income source', venue: 'venue' }

export function blankEntity(kind: EntityKind, name = ''): Entity {
  if (kind === 'client') return { id: '', name, kind: 'individual', country: 'RO', contact: '', notes: '', archived: false } satisfies Client
  if (kind === 'source') return { id: '', name, type: 'direct', description: '', active: true, taxDefault: 'profile' } satisfies Source
  return { id: '', name, type: 'in_person', location: '', notes: '', archived: false, deal: 'none', feePerSession: 0, sharePct: 0, monthlyFee: 0 } satisfies Venue
}

export interface EntityEditorProps {
  kind: EntityKind
  entity: Entity | null
  open: boolean
  onClose: () => void
  onSaved?: (e: Entity) => void
  onDelete?: (e: Entity) => void
}

export function EntityEditor({ kind, entity, open, onClose, onSaved, onDelete }: EntityEditorProps) {
  const { saveEntity, on } = useInflow()
  const [draft, setDraft] = useState<Entity>(() => entity ?? blankEntity(kind))
  const [busy, setBusy] = useState(false)
  // Mounted fresh per opening by its parent, so the draft never carries over.
  const set = (patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch }) as Entity)

  const save = async () => {
    if (!draft.name.trim()) return
    setBusy(true)
    const saved = await saveEntity(kind, { ...draft, name: draft.name.trim() })
    setBusy(false)
    if (saved) { onSaved?.(saved); onClose() }
  }

  const title = `${draft.id ? 'Edit' : 'New'} ${KIND_LABEL[kind]}`
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void save() }}>
        <TextInput label="Name" value={draft.name} onChange={(v) => set({ name: v })} autoFocus={!draft.id} />
        {kind === 'client' && (() => {
          const c = draft as Client
          return (
            <>
              <div className={styles.formRow}>
                <SelectInput label="Kind" value={c.kind} onChange={(v) => set({ kind: v as Client['kind'] })}>
                  {options(CLIENT_KIND).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
                <SelectInput label="Based in" value={c.country} onChange={(v) => set({ country: v as Client['country'] })}>
                  {options(CLIENT_COUNTRY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </div>
              <p className={styles.hint}>Kind and country only decide the VAT suggestion.</p>
              <TextInput label="Contact (optional)" value={c.contact} onChange={(v) => set({ contact: v })} />
              <TextArea label="Notes" value={c.notes} onChange={(v) => set({ notes: v })} />
              <SettingsToggle label="Archived" hint="Hidden from the pickers; history stays." checked={c.archived} onChange={(e) => set({ archived: e.target.checked })} />
            </>
          )
        })()}
        {kind === 'source' && (() => {
          const s = draft as Source
          return (
            <>
              <SelectInput label="Type" value={s.type} onChange={(v) => set({ type: v as Source['type'] })}>
                {options(SOURCE_TYPE).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
              <SelectInput label="Usual tax treatment" value={s.taxDefault} onChange={(v) => set({ taxDefault: v as Source['taxDefault'] })}
                hint="Feeds the suggestion on new payments from this source. You can still change each payment.">
                {options(SOURCE_TAX_DEFAULT).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
              <TextArea label="Description" value={s.description} onChange={(v) => set({ description: v })} />
              <SettingsToggle label="Active" checked={s.active} onChange={(e) => set({ active: e.target.checked })} />
            </>
          )
        })()}
        {kind === 'venue' && (() => {
          const v = draft as Venue
          return (
            <>
              <SelectInput label="Type" value={v.type} onChange={(x) => set({ type: x as Venue['type'] })}>
                {options(VENUE_TYPE).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
              <TextInput label="Location or URL (optional)" value={v.location} onChange={(x) => set({ location: x })} />
              {on('deals') && (
                <>
                  {/* The venue sets the deal: a fixed fee or a revenue share. An older venue saved
                      with another kind keeps it, and the option stays so it reads true. */}
                  <SelectInput label="Deal with the venue" value={v.deal} onChange={(x) => set({ deal: x })} hint={DEAL_HINT[v.deal]}>
                    {options(DEAL).filter((o) => ['fixed', 'share', 'none'].includes(o.value) || o.value === v.deal)
                      .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </SelectInput>
                  {(v.deal === 'fixed' || v.deal === 'hybrid') && (
                    <NumberInput label="Fee per session (lei)" value={v.feePerSession} onCommit={(n) => set({ feePerSession: n ?? 0 })} />
                  )}
                  {(v.deal === 'share' || v.deal === 'hybrid') && (
                    <NumberInput label="Venue's share of takings (%)" value={v.sharePct} scale={100} onCommit={(n) => set({ sharePct: Math.min(1, n ?? 0) })} />
                  )}
                  {v.deal === 'monthly' && (
                    <NumberInput label="Rent per month (lei)" value={v.monthlyFee} onCommit={(n) => set({ monthlyFee: n ?? 0 })} />
                  )}
                </>
              )}
              <TextArea label="Notes" value={v.notes} onChange={(x) => set({ notes: x })} />
              <SettingsToggle label="Archived" hint="Hidden from the pickers; history stays." checked={v.archived} onChange={(e) => set({ archived: e.target.checked })} />
            </>
          )
        })()}
        <div className={styles.formActions}>
          <div>{draft.id && onDelete && <Button size="sm" variant="ghost" onClick={() => onDelete(draft)}>Delete</Button>}</div>
          <div>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !draft.name.trim()}>Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
