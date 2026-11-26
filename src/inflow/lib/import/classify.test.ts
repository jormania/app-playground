import { describe, expect, it } from 'vitest'
import type { Client, CostRecord, Features, IncomeRecord, InflowData, Refund } from '../../domain/types'
import { DEMO_SETTINGS_TAX } from '../../data/demo'
import { ALL_FEATURES } from '../../store/settings'
import { withRefunds } from '../refunds'
import { parseCsv } from './csv'
import { readStatement } from './revolut'
import { canRemember, classify, effective, expandFees, ruleFrom, rulesFor, type Choice, type Rule } from './classify'
import { blocker, buildPlan, rateKey } from './plan'

const client = (id: string, name: string): Client => ({ id, name, kind: 'business', country: 'RO', contact: '', notes: '', archived: false })
const pay = (p: Partial<IncomeRecord> & { id: string; amount: number; date: string }): IncomeRecord => ({
  description: 'Workshop', currency: 'RON', fxRate: 1, amountRon: p.amount, status: 'received', clientId: null, sourceId: null, venueId: null,
  category: 'workshop', recurring: false, notes: '', attendees: null, sessions: 1, hours: null, taxability: 'taxable', taxHandling: 'self_declared',
  vat: 'exempt', classification: 'confirmed', taxReserve: null, reserveSource: null, taxWithheld: 0, taxRules: '', ...p,
})
const cost = (p: Partial<CostRecord> & { id: string; amount: number; date: string }): CostRecord => ({
  description: 'Room', currency: 'RON', fxRate: 1, amountRon: p.amount, status: 'paid', group: 'direct', category: 'venue_hire',
  venueId: null, clientId: null, activity: null, recurring: false, deductible: true, notes: '', ...p,
})

/** A month of a coach's Revolut Pro account. Expected results below are worked out by hand. */
const CSV = [
  'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
  /* 2 */ 'TRANSFER,Current,2026-03-02 09:15:01,2026-03-02 09:15:44,Payment from Acme SRL,1200.00,0.00,RON,COMPLETED,5200.00',
  /* 3 */ 'TRANSFER,Current,2026-03-03 10:00:00,2026-03-03 10:00:05,Payment from Ana Popescu,450.00,0.00,RON,COMPLETED,5650.00',
  /* 4 */ 'CARD_PAYMENT,Current,2026-03-04 12:00:00,2026-03-05 08:00:00,"Zoom, Inc.",-75.50,0.00,RON,COMPLETED,5574.50',
  /* 5 */ 'TRANSFER,Current,2026-03-06 10:00:00,,To Ion Ionescu,-300.00,1.50,RON,PENDING,5274.50',
  /* 6 */ 'TRANSFER,Current,2026-03-07 10:00:00,2026-03-07 10:00:10,To Sala Lumina,-400.00,2.00,RON,COMPLETED,5172.50',
  /* 7 */ 'EXCHANGE,Current,2026-03-08 10:00:00,2026-03-08 10:00:00,Exchanged to EUR,-500.00,0.00,RON,COMPLETED,4672.50',
  /* 8 */ 'TRANSFER,Current,2026-03-09 11:00:00,2026-03-09 11:00:02,Payment from Beta Corp,800.00,0.00,RON,COMPLETED,5472.50',
  /* 9 */ 'TRANSFER,Current,2026-03-10 11:00:00,2026-03-10 11:00:02,To Acme SRL,-200.00,0.00,RON,COMPLETED,5272.50',
  /* 10 */ 'TRANSFER,Current,2026-03-11 11:00:00,2026-03-11 11:00:02,To Maria Stan,-120.00,0.00,RON,COMPLETED,5152.50',
  /* 11 */ 'FEE,Current,2026-03-31 23:59:59,2026-03-31 23:59:59,Pro plan fee,-29.00,0.00,RON,COMPLETED,5123.50',
  /* 12 */ 'CARD_PAYMENT,Current,2026-03-12 12:00:00,2026-03-12 12:00:00,Coffee Bar,-15.00,0.00,RON,COMPLETED,5108.50',
  /* 13 */ 'CARD_PAYMENT,Current,2026-03-12 12:05:00,2026-03-12 12:05:00,Coffee Bar,-15.00,0.00,RON,COMPLETED,5093.50',
  /* 14 */ 'TRANSFER,Current,2026-03-13 09:00:00,2026-03-13 09:00:00,Payment from Gamma SRL,300.00,0.00,EUR,COMPLETED,300.00',
].join('\n')

const base = (): InflowData => ({
  clients: [client('acme', 'ACME S.R.L.'), client('ana', 'Ana Popescu'), client('gamma', 'Gamma SRL')],
  sources: [], venues: [],
  records: [
    // Ana's payment, entered by hand the day before the bank booked it: a likely or possible duplicate.
    pay({ id: 'r-ana', amount: 450, date: '2026-03-02', clientId: 'ana' }),
    // Acme paid earlier in the year; a refund of 200 can be against it.
    pay({ id: 'r-acme-jan', amount: 1000, date: '2026-01-10', clientId: 'acme', sourceId: 'src-direct', category: 'coaching_1on1' }),
    // Gamma owes 500 EUR: 300 arrives (part payment).
    pay({ id: 'r-gamma-exp', amount: 500, currency: 'EUR', fxRate: 4.97, amountRon: 2485, date: '2026-03-20', clientId: 'gamma', status: 'expected' }),
  ],
  costs: [], refunds: [],
})

const read = () => readStatement(parseCsv(CSV)).txs
const ctx = (data: InflowData, rules: Rule[] = []) => ({ data, rules, ledger: {}, ownNames: ['Maria Stan'] })
const byLine = (rows: ReturnType<typeof classify>, line: number, fee = false) => rows.find((r) => r.tx.line === line && !!r.parent === fee)!

describe('classifying a statement (Release 2, experimental)', () => {
  const data = base()
  const rows = classify(expandFees(read()), ctx(data))

  it('a fee in the Fee column becomes its own row, only for completed transactions', () => {
    const fees = rows.filter((r) => r.parent)
    expect(fees.map((r) => [r.tx.line, r.tx.amount, r.suggestion.kind, r.suggestion.costCategory])).toEqual([[6, 2, 'fee', 'bank_fees']])
    // The pending transfer's 1.50 fee is not a row: nothing about it happened yet.
    expect(rows.find((r) => r.tx.line === 5 && r.parent)).toBeUndefined()
  })

  it('pending is locked out; an exchange is a transfer; your own name is a transfer', () => {
    expect(byLine(rows, 5).locked).toMatch(/pending/)
    expect(byLine(rows, 7).suggestion).toMatchObject({ kind: 'transfer', action: 'skip' })
    expect(byLine(rows, 10).suggestion).toMatchObject({ kind: 'transfer', action: 'skip' })
  })

  it('a client named exactly (accents, dots and case aside) is suggested; an unknown name is not invented', () => {
    const acme = byLine(rows, 2)
    expect(acme.suggestion).toMatchObject({ kind: 'income', action: 'import', clientId: 'acme', sourceId: 'src-direct', category: 'coaching_1on1', venueId: null })
    const beta = byLine(rows, 8)
    expect(beta.suggestion).toMatchObject({ kind: 'income', clientId: null, venueId: null })
  })

  it('money matching a hand-entered payment is never imported silently', () => {
    const ana = byLine(rows, 3)
    expect(ana.match.status).toBe('possible')
    expect(ana.match.candidates.map((c) => c.id)).toEqual(['r-ana'])
    expect(blocker(ana, ana.suggestion, data, ALL_FEATURES)).toMatch(/may already be in InFlow/)
    expect(blocker(ana, { ...ana.suggestion, action: 'link', target: 'r-ana' }, data, ALL_FEATURES)).toBeNull()
    expect(blocker(ana, { ...ana.suggestion, anyway: true }, data, ALL_FEATURES)).toBeNull()
  })

  it('same amount, same day, same client: likely, and linking is suggested', () => {
    const d = base()
    d.records[0] = { ...d.records[0], date: '2026-03-03' }
    const r = byLine(classify(expandFees(read()), ctx(d)), 3)
    expect(r.match.status).toBe('likely')
    expect(r.suggestion).toMatchObject({ action: 'link', target: 'r-ana' })
  })

  it('a cost entered by hand two days off: possible duplicate, linkable; linking never touches its fields', () => {
    const d = base()
    d.costs.push(cost({ id: 'c-zoom', description: 'Zoom subscription', amount: 75.5, date: '2026-03-03', group: 'operating', category: 'software' }))
    const r = byLine(classify(expandFees(read()), ctx(d)), 4)
    expect(r.match).toMatchObject({ status: 'possible', candidates: [{ kind: 'cost', id: 'c-zoom' }] })
    const p = buildPlan({ rows: [r], data: d, features: ALL_FEATURES, profile: DEMO_SETTINGS_TAX, rates: new Map(), batch: 'b', choices: new Map([[r.tx.key, { ...r.suggestion, kind: 'cost', action: 'link', target: 'c-zoom' }]]) })
    expect(p.ops).toEqual([{ op: 'link', key: r.tx.key, kind: 'cost', counterparty: 'Zoom, Inc.', target: { kind: 'cost', id: 'c-zoom' } }])
  })

  it('two identical coffees a few minutes apart are two transactions, flagged for a look', () => {
    expect(byLine(rows, 12).tx.key).not.toBe(byLine(rows, 13).tx.key)
    expect(byLine(rows, 12).match.status).toBe('new')
    expect(byLine(rows, 13).match.status).toBe('possible')
    expect(byLine(rows, 13).match.reason).toMatch(/line 12/)
  })

  it('money out to a client with a payment to refund: a refund is suggested against that payment', () => {
    expect(byLine(rows, 9).suggestion).toMatchObject({ kind: 'refundIssued', paymentId: 'r-acme-jan', clientId: 'acme' })
  })

  it('money out is not called business or personal for you; words only suggest a category', () => {
    expect(byLine(rows, 4).suggestion).toMatchObject({ kind: 'review', costCategory: 'software', costGroup: 'operating' })
    expect(byLine(rows, 4).confidence).toBe('none')
    expect(byLine(rows, 6).suggestion.kind).toBe('review')
    expect(byLine(rows, 11).suggestion).toMatchObject({ kind: 'fee', costCategory: 'bank_fees' })
  })

  it('an expected payment from that client is suggested as received, in part', () => {
    expect(byLine(rows, 14).suggestion).toMatchObject({ kind: 'income', action: 'receive', target: 'r-gamma-exp' })
  })

  it('rules: exact counterparty beats description words; longest words first; a row choice beats both', () => {
    const rules: Rule[] = [
      { id: 'w1', match: 'contains', value: 'sala', direction: 'out', kind: 'personal', created: '2026-01-01' },
      { id: 'w2', match: 'contains', value: 'sala lumina', direction: 'out', kind: 'cost', costCategory: 'venue_hire', created: '2026-01-02' },
      { id: 'c1', match: 'counterparty', value: 'sala lumina', direction: 'out', kind: 'cost', costCategory: 'venue_hire', venueId: 'v-lumina', created: '2026-01-03' },
    ]
    const tx = byLine(rows, 6).tx
    expect(rulesFor(tx, rules).map((r) => r.id)).toEqual(['c1', 'w2', 'w1'])
    const r = byLine(classify(expandFees(read()), ctx(data, rules)), 6)
    expect(r.rule?.id).toBe('c1')
    expect(r.confidence).toBe('rule')
    expect(r.suggestion).toMatchObject({ kind: 'cost', costGroup: 'direct', costCategory: 'venue_hire', venueId: 'v-lumina', deductible: true })
    expect(effective(r, { kind: 'personal' })).toMatchObject({ kind: 'personal', action: 'skip' })
    // A rule for money in never touches money out with the same name.
    expect(rulesFor(tx, [{ ...rules[2], direction: 'in' }])).toEqual([])
  })

  it('a rule is only made from a decided, new, completed row with a name', () => {
    const r = byLine(rows, 8)
    const c: Choice = { ...r.suggestion, clientId: 'new-beta' }
    expect(canRemember(r, c)).toBe(true)
    expect(ruleFrom(r, c, 'x', '2026-03-31')).toMatchObject({ match: 'counterparty', value: 'Beta Corp', direction: 'in', kind: 'income', clientId: 'new-beta' })
    expect(canRemember(byLine(rows, 3), byLine(rows, 3).suggestion)).toBe(false) // possible duplicate
    expect(canRemember(byLine(rows, 5), byLine(rows, 5).suggestion)).toBe(false) // pending
    expect(canRemember(byLine(rows, 4), byLine(rows, 4).suggestion)).toBe(false) // undecided
  })

  it('already imported: found by its key on the record, whatever the file is called or the ledger says', () => {
    const tx = byLine(rows, 2).tx
    const d = base()
    d.records.push(pay({ id: 'r-imp', amount: 1200, date: '2026-03-02', importMeta: { key: tx.key, batch: 'b0', counterparty: 'Acme SRL' } }))
    const again = classify(expandFees(read()), ctx(d))
    expect(byLine(again, 2).match).toMatchObject({ status: 'exact', candidates: [{ id: 'r-imp' }] })
    expect(byLine(again, 2).suggestion.action).toBe('skip')
  })

  it('set aside before: the same decision comes back; deleted since: stays out unless asked', () => {
    const t7 = byLine(rows, 4).tx.key
    const t2 = byLine(rows, 2).tx.key
    const again = classify(expandFees(read()), { ...ctx(base()), ledger: { [t7]: { batch: 'b0', outcome: 'skipped', kind: 'personal' }, [t2]: { batch: 'b0', outcome: 'created', kind: 'income', target: 'gone' } } })
    expect(byLine(again, 4).suggestion).toMatchObject({ kind: 'personal', action: 'skip' })
    expect(byLine(again, 2).match.status).toBe('exact')
  })
})

describe('planning an import', () => {
  const features: Features = { ...ALL_FEATURES }
  const data = base()
  const rows = classify(expandFees(read()), ctx(data))
  const decide = (over: Record<number, Partial<Choice>>, fee: Record<number, Partial<Choice>> = {}) => {
    const m = new Map<string, Choice>()
    for (const r of rows) m.set(r.tx.key, effective(r, (r.parent ? fee : over)[r.tx.line]))
    return m
  }
  const rates = new Map([[rateKey('EUR', '2026-03-13'), 4.9775]])
  const plan = buildPlan({
    rows, data, features, profile: DEMO_SETTINGS_TAX, rates, batch: 'b1',
    choices: decide({ 3: { anyway: true }, 4: { kind: 'cost' }, 6: { kind: 'cost', costGroup: 'direct', costCategory: 'venue_hire' }, 12: { kind: 'personal' }, 13: { kind: 'personal' } }),
    suggestReserve: (r) => ({ amount: Math.round(r.amountRon * 0.1 * 100) / 100, rulesId: 'RO-2026' }),
  })

  it('counts every row exactly once', () => {
    // 14 bank rows + 1 fee row = 15: 1 never (pending), 4 set aside (exchange, own name, 2 coffees),
    // income 3 (Acme, Ana anyway, Beta), 1 received (Gamma part), costs 3 (Zoom, Sala, its fee) + 1 plan fee, 1 refund.
    expect(plan.counts).toEqual({ records: 3, costs: 4, refunds: 1, linked: 0, received: 1, setAside: 4, waiting: 0, alreadyIn: 0, never: 1 })
    expect(plan.blocked).toEqual([])
  })

  it('totals by currency, fees apart from costs, nothing counted twice', () => {
    expect(plan.totals).toEqual({
      income: { RON: 2450, EUR: 300 }, recovery: {}, costs: { RON: 475.5 }, fees: { RON: 31 }, refunds: { RON: 200 },
    })
  })

  it('a new payment: original amount and currency, no sessions or withholding invented, reserve as suggested, the key kept', () => {
    const op = plan.ops.find((o) => o.op === 'createRecord' && o.record.clientId === 'acme')
    expect(op).toBeDefined()
    if (op?.op !== 'createRecord') throw new Error()
    expect(op.record).toMatchObject({
      id: '', amount: 1200, currency: 'RON', fxRate: 1, amountRon: 1200, date: '2026-03-02', status: 'received',
      sessions: 0, hours: null, attendees: null, taxWithheld: 0, classification: 'suggested', taxability: 'taxable',
      taxReserve: 120, reserveSource: 'suggested', venueId: null,
      importMeta: { batch: 'b1', counterparty: 'Acme SRL' },
    })
  })

  it('part of an expected EUR payment: received at the day rate, converted once; the rest still expected', () => {
    const op = plan.ops.find((o) => o.op === 'receive')
    if (op?.op !== 'receive') throw new Error('no receive')
    expect(op.received).toMatchObject({ id: '', amount: 300, currency: 'EUR', fxRate: 4.9775, amountRon: 1493.25, status: 'received', date: '2026-03-13' })
    expect(op.remaining).toMatchObject({ id: 'r-gamma-exp', amount: 200, status: 'expected', amountRon: 994 })
  })

  it('a refund against the payment it refunds, in its currency; a fee as a bank fee cost; deductible as the form would set it', () => {
    const f = plan.ops.find((o) => o.op === 'createRefund')
    if (f?.op !== 'createRefund') throw new Error()
    expect(f.refund).toMatchObject({ paymentId: 'r-acme-jan', amount: 200, currency: 'RON', amountRon: 200, date: '2026-03-10' })
    const fees = plan.ops.filter((o) => o.op === 'createCost' && o.cost.category === 'bank_fees')
    expect(fees.map((o) => (o.op === 'createCost' ? o.cost.amount : 0)).sort()).toEqual([2, 29])
    const sala = plan.ops.find((o) => o.op === 'createCost' && o.cost.amount === 400)
    expect(sala?.op === 'createCost' && sala.cost).toMatchObject({ group: 'direct', category: 'venue_hire', deductible: true, status: 'paid' })
  })

  it('after the import, the books agree with the bank to the ban', () => {
    // Apply the plan as the executor would and read the figures back.
    const d: InflowData = structuredClone(data)
    let n = 0
    for (const o of plan.ops) {
      if (o.op === 'createRecord') d.records.push({ ...o.record, id: `n${n++}` })
      if (o.op === 'createCost') d.costs.push({ ...o.cost, id: `n${n++}` })
      if (o.op === 'createRefund') d.refunds.push({ ...o.refund, id: `n${n++}` } as Refund)
      if (o.op === 'receive') { d.records.push({ ...o.received, id: `n${n++}` }); d.records = d.records.map((r) => (r.id === o.expectedId ? o.remaining! : r)) }
    }
    const books = withRefunds(d)
    const march = (xs: { date: string; amountRon: number; status?: string }[]) => xs.filter((x) => x.date.startsWith('2026-03') && x.status !== 'expected').reduce((s, x) => s + x.amountRon, 0)
    // In: 450 (Ana, by hand) + 1200 + 450 (Ana, anyway) + 800 + 1493.25 (Gamma) − 200 refund.
    expect(Math.round(march(books.records) * 100) / 100).toBe(4193.25)
    // Out: 75.5 + 400 + 2 + 29.
    expect(Math.round(march(d.costs) * 100) / 100).toBe(506.5)
  })

  it('a refund beyond what is left, a missing rate, or a switched-off feature waits, with a reason', () => {
    const big = rows.find((r) => r.tx.line === 9)!
    const d2 = { ...data, refunds: [{ id: 'f0', paymentId: 'r-acme-jan', date: '2026-02-01', amount: 900, currency: 'RON', fxRate: 1, amountRon: 900, notes: '' } as Refund] }
    const p = buildPlan({ rows: [big], data: d2, features, profile: DEMO_SETTINGS_TAX, rates, batch: 'b2', choices: new Map([[big.tx.key, big.suggestion]]) })
    expect(p.blocked[0].message).toMatch(/more than the 100 RON/)
    const eur = rows.find((r) => r.tx.line === 14)!
    const p2 = buildPlan({ rows: [eur], data, features, profile: DEMO_SETTINGS_TAX, rates: new Map(), batch: 'b3', choices: new Map([[eur.tx.key, { ...eur.suggestion, action: 'import', target: null }]]) })
    expect(p2.blocked[0].message).toMatch(/No EUR rate/)
    expect(blocker(eur, eur.suggestion, data, { ...features, currencies: false })).toMatch(/Foreign currencies are off/)
    const zoom = rows.find((r) => r.tx.line === 4)!
    expect(blocker(zoom, { ...zoom.suggestion, kind: 'cost' }, data, { ...features, costs: false })).toMatch(/Costs are off/)
  })

  it('two rows can never both settle all of one expected payment', () => {
    const eur = rows.find((r) => r.tx.line === 14)!
    const twin = { ...eur, tx: { ...eur.tx, key: `${eur.tx.key}#x`, amount: 300 } }
    const p = buildPlan({ rows: [eur, twin], data, features, profile: DEMO_SETTINGS_TAX, rates, batch: 'b4', choices: new Map([[eur.tx.key, eur.suggestion], [twin.tx.key, twin.suggestion]]) })
    expect(p.counts.received).toBe(1)
    expect(p.blocked[0].message).toMatch(/already settles/)
  })
})
