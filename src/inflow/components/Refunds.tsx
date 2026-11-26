/**
 * A received payment's refunds, on the payment itself: what went back and when, and a way to
 * record more. Each refund is its own transaction; the payment above it never changes
 * (`lib/refunds.ts`). Refused beyond what is left to refund.
 */
import { useState } from 'react'
import { Undo2, X } from 'lucide-react'
import { Button, Modal } from '../../ds'
import { useInflow } from '../app/state'
import type { IncomeRecord, Refund } from '../domain/types'
import { lastRate } from '../lib/guards'
import { fetchRonRate, lei, money, round2 } from '../lib/money'
import { defaultRefund, refundable, refundError, refundsOf } from '../lib/refunds'
import { shortDate } from '../lib/dates'
import { DateShortcuts, parseAmount, TextInput } from './fields'
import styles from '../styles/ui.module.css'

/** Nothing for a new or expected payment, or while the form is switching it to expected (`hidden`). */
export function Refunds({ paymentId, hidden = false }: { paymentId: string; hidden?: boolean }) {
  const { data, deleteRefund, on } = useInflow()
  const [adding, setAdding] = useState(false)
  const payment = paymentId ? data.records.find((r) => r.id === paymentId) : undefined
  if (hidden || !payment || payment.status !== 'received') return null
  const list = refundsOf(payment.id, data.refunds)
  const left = refundable(payment, data.refunds)
  // Off (the default), nothing shows, unless this payment already has refunds: those stay visible,
  // as they count in every total, but no new one is offered.
  const offered = on('refunds')
  if (!offered && list.length === 0) return null
  return (
    <section className={styles.refunds} aria-label="Refunds">
      {list.length > 0 && (
        <ul className={styles.refundList}>
          {list.map((f) => (
            <li key={f.id}>
              <span>Refunded {money(f.amount, f.currency)}{f.currency !== 'RON' ? ` (${lei(f.amountRon)})` : ''} on {shortDate(f.date, 0)}{f.notes ? ` · ${f.notes}` : ''}</span>
              <button type="button" className={styles.iconButton} aria-label={`Delete the refund of ${money(f.amount, f.currency)} on ${f.date}`} onClick={() => void deleteRefund(f)}>
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!offered ? null : left > 0 ? (
        <button type="button" className={styles.linkButton} onClick={() => setAdding(true)}>
          <Undo2 size={12} aria-hidden /> {list.length ? `Refund more (${money(left, payment.currency)} left)` : 'Refund…'}
        </button>
      ) : <p className={styles.hint} style={{ margin: 0 }}>Refunded in full.</p>}
      {adding && <RefundForm payment={payment} left={left} onClose={() => setAdding(false)} />}
    </section>
  )
}

function RefundForm({ payment, left, onClose }: { payment: IncomeRecord; left: number; onClose: () => void }) {
  const { data, today, saveRefund } = useInflow()
  const start = defaultRefund(payment, data.refunds)
  const [amount, setAmount] = useState(String(start.amount))
  const [date, setDate] = useState(today < payment.date ? payment.date : today)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const n = parseAmount(amount)
  const submit = async () => {
    // The rate on the day the money went back; offline, the last one used, else the payment's.
    const fxRate = payment.currency === 'RON' ? 1
      : (await fetchRonRate(payment.currency, date)) ?? lastRate(payment.currency, data.records) ?? payment.fxRate
    const f: Refund = { id: '', paymentId: payment.id, date, amount: round2(n), currency: payment.currency, fxRate, amountRon: round2(n * fxRate), notes: notes.trim() }
    const why = refundError(f, payment, data.refunds)
    if (why) { setError(why); return }
    if (await saveRefund(f)) onClose()
  }
  return (
    <Modal open onClose={onClose} title="Refund">
      {/* Rendered inside the payment form: React events cross the modal's portal, so this submit must stop here. */}
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); setBusy(true); void submit().finally(() => setBusy(false)) }}>
        <p className={styles.hint} style={{ marginTop: 0 }}>
          {payment.description}: {money(payment.amount, payment.currency)} received on {shortDate(payment.date, 0)}. The payment stays as it was; the refund
          is counted on its own date, in income, cash and tax for that period.
        </p>
        {start.withheld > 0 && (
          <p className={styles.hint} data-testid="refund-withheld">
            {money(payment.amount, payment.currency)} gross, {money(start.cashReceived, payment.currency)} arrived after {money(start.withheld, payment.currency)} of tax
            withheld by the payer, so the refund starts at what arrived. The withheld tax stays recorded as paid: a refund doesn't reverse it.
          </p>
        )}
        <TextInput label={`Amount paid back (${payment.currency})`} value={amount} onChange={setAmount} inputMode="decimal" autoFocus
          hint={`Up to ${money(left, payment.currency)}.`} />
        <TextInput label="Date paid back" type="date" value={date} onChange={setDate}
          hint={<DateShortcuts today={today} value={date} onPick={setDate} />} />
        <TextInput label="Note (optional)" value={notes} onChange={setNotes} placeholder="Cancelled, partly refunded…" />
        {error && <p className={styles.hint} role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <div className={styles.formActions}>
          <div />
          <div>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>Save refund</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
