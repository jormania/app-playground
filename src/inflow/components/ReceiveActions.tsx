/**
 * The actions on an expected payment, the same wherever it is listed (Overview, Income):
 * **Received** marks all of it received today in one tap; **Part…** asks how much arrived and
 * when, and keeps the rest expected. Both go through `useReceive` (audit B-02, B-03, E-01).
 */
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Modal } from '../../ds'
import { useInflow } from '../app/state'
import { useReceive } from '../app/receive'
import type { IncomeRecord } from '../domain/types'
import { money } from '../lib/money'
import { DateShortcuts, parseAmount, TextInput } from './fields'
import styles from '../styles/ui.module.css'

/**
 * `only="part"`: just the Part… action, for the payment form, which marks all of it received
 * through its own Status field. `onDone` runs once a part is saved (the form closes).
 */
export function ReceiveActions({ r, only, onDone }: { r: IncomeRecord; only?: 'part'; onDone?: () => void }) {
  const receive = useReceive()
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  return (
    <>
      {only !== 'part' && (
        <button type="button" className={styles.chip} disabled={busy} onClick={() => void run(() => receive(r))} aria-label={`Mark ${r.description} received`}>
          <Check size={12} aria-hidden /> Received
        </button>
      )}
      <button type="button" className={styles.chip} disabled={busy} onClick={() => setAsking(true)} aria-label={`Part of ${r.description} received`}>
        Part…
      </button>
      {asking && <PartReceived r={r} onClose={() => setAsking(false)} onReceive={(amount, date) => run(async () => { if (await receive(r, { amount, date })) { setAsking(false); onDone?.() } })} />}
    </>
  )
}

function PartReceived({ r, onClose, onReceive }: { r: IncomeRecord; onClose: () => void; onReceive: (amount: number, date: string) => void }) {
  const { today } = useInflow()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const n = parseAmount(amount)
  const submit = () => {
    if (!Number.isFinite(n) || n <= 0) { setError('Enter the amount that arrived.'); return }
    if (n > r.amount) { setError(`That is more than the ${money(r.amount, r.currency)} expected.`); return }
    if (!date) { setError('Pick the date it arrived.'); return }
    onReceive(n, date)
  }
  return (
    <Modal open onClose={onClose} title="Part received">
      {/* Also opened from inside the payment form: React events cross the modal's portal, so this submit stops here. */}
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); submit() }}>
        <p className={styles.hint} style={{ marginTop: 0 }}>{r.description}: {money(r.amount, r.currency)} expected. The rest stays expected.</p>
        <TextInput label={`Amount received (${r.currency})`} value={amount} onChange={setAmount} inputMode="decimal" placeholder="0" autoFocus
          hint={Number.isFinite(n) && n > 0 && n < r.amount ? `${money(r.amount - n, r.currency)} will still be expected.` : undefined} />
        <TextInput label="Date received" type="date" value={date} onChange={setDate}
          hint={<DateShortcuts today={today} value={date} onPick={setDate} />} />
        {error && <p className={styles.hint} role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <div className={styles.formActions}>
          <div />
          <div>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
