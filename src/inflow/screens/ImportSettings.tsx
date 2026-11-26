/**
 * Settings for Import from Revolut (Release 2, experimental): your own account names, the rules
 * you saved, and every import with its undo.
 */
import { useState } from 'react'
import { Trash2, Undo2 } from 'lucide-react'
import { Button } from '../../ds'
import { useImports } from '../app/import'
import { useInflow } from '../app/state'
import { TextInput, SelectInput } from '../components/fields'
import { KIND_LABEL, KINDS_IN, KINDS_OUT, type Kind } from '../lib/import/classify'
import { shortDate } from '../lib/dates'
import type { Batch } from '../store/imports'
import { ExperimentalNote, UndoConfirm } from './Import'
import styles from '../styles/ui.module.css'

export function ImportSettings() {
  const { data, toast } = useInflow()
  const imports = useImports()
  const [names, setNames] = useState<string | null>(null)
  const [undoing, setUndoing] = useState<Batch | null>(null)
  const { rules, batches, ownNames } = imports.state
  const nameOf = (kind: 'client' | 'venue' | 'source', id: string | null | undefined) =>
    !id ? null : (kind === 'client' ? data.clients : kind === 'venue' ? data.venues : data.sources).find((x) => x.id === id)?.name ?? 'removed'

  return (
    <div className={styles.settingsGroup}>
      <ExperimentalNote />
      <p><a href="#/import" className={styles.linkButton}>Import a statement</a></p>

      <TextInput label="Your own names and accounts" value={names ?? ownNames.join(', ')} onChange={setNames}
        hint="Comma separated. Money to or from these is read as a transfer between your accounts, never income or a cost." />
      {names !== null && <Button size="sm" className={styles.hit} onClick={() => { void imports.setOwnNames(names.split(',')).then(() => setNames(null)) }}>Save names</Button>}

      <h3 className={styles.panelTitle}>Rules</h3>
      {rules.length === 0 ? <p className={styles.hint}>None yet. When you review an import, tick “Next time, treat … the same way” to make one.</p> : (
        <ul className={styles.lineList}>
          {[...rules].sort((a, b) => a.value.localeCompare(b.value)).map((r) => (
            <li key={r.id} className={styles.suggestRow}>
              <span style={{ minWidth: 0 }}>
                <strong>{r.match === 'counterparty' ? `“${r.value}”` : `Description contains “${r.value}”`}</strong> · money {r.direction}
                <br /><span className={styles.hint}>{[nameOf('client', r.clientId), nameOf('source', r.sourceId), nameOf('venue', r.venueId)].filter(Boolean).join(' · ') || 'no client or venue'}</span>
              </span>
              <SelectInput label="Treat as" value={r.kind} onChange={(v) => void imports.saveRule({ ...r, kind: v as Kind })}>
                {(r.direction === 'in' ? KINDS_IN : KINDS_OUT).filter((k) => k !== 'review').map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </SelectInput>
              <button type="button" className={`${styles.iconButton} ${styles.hit}`} aria-label={`Delete the rule for ${r.value}`} onClick={() => { void imports.deleteRule(r.id).then(() => toast('Rule deleted')) }}><Trash2 size={16} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}

      <h3 className={styles.panelTitle}>Imports</h3>
      {batches.length === 0 ? <p className={styles.hint}>Nothing imported yet.</p> : (
        <ul className={styles.lineList}>
          {batches.map((b) => (
            <li key={b.id} className={styles.suggestRow}>
              <span style={{ minWidth: 0 }}>
                <strong>{shortDate(b.at.slice(0, 10))}</strong> · {b.file.name}{b.file.from ? ` (${shortDate(b.file.from)} – ${shortDate(b.file.to!)})` : ''}
                <br /><span className={styles.hint}>{b.status === 'undone' ? `Undone ${b.undoneAt ? shortDate(b.undoneAt.slice(0, 10)) : ''}` : b.status === 'running' ? 'Stopped part way: import the file again to finish' : `${b.created.length} added · ${b.linked.length} matched · ${b.received.length} received · ${b.setAside} set aside`}</span>
              </span>
              {b.status !== 'undone' && <Button size="sm" variant="secondary" className={styles.hit} onClick={() => setUndoing(b)}><Undo2 size={14} aria-hidden /> Undo</Button>}
            </li>
          ))}
        </ul>
      )}
      {undoing && <UndoConfirm open batch={undoing} onCancel={() => setUndoing(null)} onConfirm={() => {
        const b = undoing
        setUndoing(null)
        void imports.undo(b).then(({ failed }) => toast({ message: failed ? `Import undone, except ${failed} ${failed === 1 ? 'entry' : 'entries'} that could not be changed.` : 'Import undone.', tone: failed ? 'danger' : 'success' }))
      }} />}
    </div>
  )
}
