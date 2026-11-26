/**
 * Independent adversarial audit of the statement importer (parser, classification, plan).
 * Each expectation was written from the input by hand before running the code; a failing case
 * here was a reproduced defect, fixed and kept as a regression test. Ids (A-nn) match the audit
 * report; the established behaviour is written up in INFLOW.md, "Release 2".
 */
import { describe, expect, it } from 'vitest'
import type { Client, CostRecord, IncomeRecord, InflowData } from '../../domain/types'
import { DEMO_SETTINGS_TAX } from '../../data/demo'
import { ALL_FEATURES } from '../../store/settings'
import { classify, effective, expandFees, type Rule } from './classify'
import { CsvError, parseCsv } from './csv'
import { blocker, buildPlan } from './plan'
import { readMoney, readStatement, type BankTx, type Statement } from './revolut'

const HEAD = 'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance'
const csv = (...rows: string[]) => [HEAD, ...rows].join('\n')
const read = (text: string, opts: Parameters<typeof readStatement>[1] = {}) => readStatement(parseCsv(text), opts)
const accounted = (s: Statement) => expect(s.txs.length + s.issues.length).toBe(s.summary.rows)
const empty = (): InflowData => ({ records: [], costs: [], clients: [], sources: [], venues: [], refunds: [] })
const client = (id: string, name: string): Client => ({ id, name, kind: 'business', country: 'RO', contact: '', notes: '', archived: false })
const pay = (p: Partial<IncomeRecord> & { id: string; amount: number; date: string }): IncomeRecord => ({
  description: 'Workshop', currency: 'RON', fxRate: 1, amountRon: p.amount, status: 'received', clientId: null, sourceId: null, venueId: null,
  category: 'workshop', recurring: false, notes: '', attendees: null, sessions: 1, hours: null, taxability: 'taxable', taxHandling: 'self_declared',
  vat: 'exempt', classification: 'confirmed', taxReserve: null, reserveSource: null, taxWithheld: 0, taxRules: '', ...p,
})
const rowsOf = (txs: BankTx[], data: InflowData = empty(), rules: Rule[] = []) => classify(expandFees(txs), { data, rules, ledger: {}, ownNames: [] })

describe('A-01..A-06 CSV syntax', () => {
  it('A-01 a lone CR ends a line (old Mac exports), not glued into one field', () => {
    const t = parseCsv('a,b\r1,2\r3,4\r')
    expect(t.rows.map((r) => r.cells)).toEqual([['1', '2'], ['3', '4']])
  })
  it('A-02 text after a closing quote marks the row malformed; it is reported, never read shifted', () => {
    const s = read(csv('TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:00,"Acme" SRL,100.00,0.00,RON,COMPLETED,100.00', 'TRANSFER,Current,2026-03-03 09:00:00,2026-03-03 09:00:00,Fine,50.00,0.00,RON,COMPLETED,150.00'))
    accounted(s)
    expect(s.txs.map((t) => t.line)).toEqual([3])
    expect(s.issues).toEqual([{ line: 2, message: expect.stringMatching(/after a closing quote/) }])
  })
  it('A-03 a truncated final row with an open quote is reported; the rows before it are kept', () => {
    const s = read(csv('TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:00,Fine,100.00,0.00,RON,COMPLETED,100.00', 'TRANSFER,Current,2026-03-03 09:00:00,2026-03-03 09:00:00,"Cut sho'))
    accounted(s)
    expect(s.txs.map((t) => t.line)).toEqual([2])
    expect(s.issues).toEqual([{ line: 3, message: expect.stringMatching(/never closed/) }])
  })
  it('A-04 the size limit counts bytes, not characters', () => {
    // 2.7 M two-byte characters = 5.4 MB of UTF-8, under 5 M characters.
    expect(() => parseCsv(`a\n${'ă'.repeat(2_700_000)}`)).toThrow(CsvError)
  })
  it('A-05 a header that splits equally by comma and semicolon is refused as ambiguous', () => {
    expect(() => parseCsv('Date;Amount,Currency\n2026-01-01;5,RON\n')).toThrow(/delimiter/)
  })
  it('A-06 quoted delimiters, line breaks and doubled quotes inside a field stay in it', () => {
    const t = parseCsv('a,b\n"x, y; z\tw","line1\nline2 ""q"""\n')
    expect(t.rows[0].cells).toEqual(['x, y; z\tw', 'line1\nline2 "q"'])
  })
})

describe('A-07..A-10 amounts and signs', () => {
  const v = (s: string, d: '.' | ',' | null = null) => { const m = readMoney(s, d); return m.ok ? m.value : 'refused' }
  it('A-07 two signs at once are refused, not cancelled out', () => {
    expect([v('(-12.50)'), v('-12.50-'), v('--12.50'), v('+-12.50')]).toEqual(['refused', 'refused', 'refused', 'refused'])
    expect([v('(12.50)'), v('12.50-'), v('-12.50'), v('+12.50')]).toEqual([-12.5, -12.5, -12.5, 12.5])
  })
  it('A-08 numbers beyond exact precision are refused', () => {
    expect(v('12345678901234567.00')).toBe('refused')
  })
  it('A-09 the amount\'s decimal mark is never inferred from another column (balance, fee)', () => {
    // Balance "6,440.01" says comma = thousands; the Amount "1,234" alone could be 1.234 or 1234.
    const s = read(csv('TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:00,Acme,"1,234",0.00,RON,COMPLETED,"6,440.01"'))
    expect(s.txs).toEqual([])
    expect(s.needs.decimal).toBe(true)
    const told = read(csv('TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:00,Acme,"1,234",0.00,RON,COMPLETED,"6,440.01"'), { decimal: '.' })
    expect(told.txs[0].amount).toBe(1234)
  })
  it('A-10 a malformed optional fee keeps the transaction, with the fee unknown and a note', () => {
    const s = read(csv('TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:00,Acme,100.00,abc,RON,COMPLETED,100.00'))
    accounted(s)
    expect(s.txs.map((t) => [t.amount, t.fee])).toEqual([[100, null]])
    expect(s.notes).toEqual([{ line: 2, message: expect.stringMatching(/Fee not read/) }])
  })
  it('A-11 a malformed balance, rate or original amount keeps the transaction and says so', () => {
    const t = 'Started Date,Description,Amount,Currency,Balance,Exchange rate,Orig amount,Orig currency\n2026-03-02 09:00:00,Acme,100.00,RON,x,y,z,EUR\n'
    const s = read(t, { allCompleted: true })
    expect(s.txs.map((x) => [x.amount, x.balance, x.fileRate, x.original])).toEqual([[100, null, null, null]])
    expect(s.notes.map((n) => n.message)).toEqual([expect.stringMatching(/Balance/), expect.stringMatching(/rate/i), expect.stringMatching(/Original amount/)])
  })
  it('A-12 fees of both signs in one file: the sign is unclear, so no fee row is made', () => {
    const s = read(csv('TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:00,A,-100.00,1.00,RON,COMPLETED,99.00', 'TRANSFER,Current,2026-03-03 09:00:00,2026-03-03 09:00:00,B,-100.00,-1.00,RON,COMPLETED,-2.00'))
    expect(s.txs.map((t) => t.fee)).toEqual([null, null])
    expect(s.notes).toEqual([{ line: 0, message: expect.stringMatching(/Fees in this file are both positive and negative/) }])
  })
})

describe('A-13..A-17 dates and time zones (accounting date: Europe/Bucharest)', () => {
  it('A-13 a UTC timestamp at 22:30 on 31 Dec is 1 Jan in Bucharest', () => {
    const s = read('Date,Description,Amount,Currency\n2026-12-31T22:30:00Z,Acme,100.00,RON\n', { allCompleted: true })
    expect(s.txs.map((t) => [t.date, t.startedAt])).toEqual([['2027-01-01', '2027-01-01 00:30:00']])
  })
  it('A-14 an explicit offset is honoured; a summer UTC time converts at +3', () => {
    expect(read('Date,Description,Amount,Currency\n2026-07-01T23:30:00+00:00,A,1.00,RON\n', { allCompleted: true }).txs[0].date).toBe('2026-07-02')
    expect(read('Date,Description,Amount,Currency\n2026-07-01T23:30:00+03:00,A,1.00,RON\n', { allCompleted: true }).txs[0].date).toBe('2026-07-01')
  })
  it('A-15 a column labelled (UTC) is converted even without a Z', () => {
    const s = read('Date started (UTC),Description,Amount,Currency\n2026-03-31 22:15:00,A,1.00,RON\n', { allCompleted: true })
    expect(s.txs[0].date).toBe('2026-04-01')
  })
  it('A-16 naive times near midnight could fall on two dates: the time zone is asked', () => {
    const t = 'Started Date,Description,Amount,Currency\n2026-03-31 23:10:00,A,1.00,RON\n'
    const s = read(t, { allCompleted: true })
    expect(s.needs.timeZone).toBe(true)
    expect(s.txs).toEqual([])
    expect(read(t, { allCompleted: true, timeZone: 'utc' }).txs[0].date).toBe('2026-04-01')
    expect(read(t, { allCompleted: true, timeZone: 'local' }).txs[0].date).toBe('2026-03-31')
  })
  it('A-17 naive times away from midnight are the same day either way: nothing to ask', () => {
    const s = read('Started Date,Description,Amount,Currency\n2026-03-31 12:00:00,A,1.00,RON\n', { allCompleted: true })
    expect([s.needs.timeZone, s.txs[0].date]).toEqual([false, '2026-03-31'])
  })
  it('A-18 a completed date before the started date is noted', () => {
    const s = read(csv('TRANSFER,Current,2026-03-05 09:00:00,2026-03-02 09:00:00,A,1.00,0.00,RON,COMPLETED,1.00'))
    expect(s.notes).toEqual([{ line: 2, message: expect.stringMatching(/completed before it started/) }])
  })
})

describe('A-19..A-21 states and directions', () => {
  it('A-19 an empty state in a file that has a state column is not "completed"', () => {
    const s = read(csv('TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:00,Acme,100.00,0.00,RON,,100.00'))
    expect(s.txs[0].state).toBe('UNKNOWN')
    expect(rowsOf(s.txs)[0].locked).toMatch(/no state/i)
  })
  it('A-20 a file with no state column asks whether its rows are all completed', () => {
    const t = 'Date,Description,Amount,Currency\n2026-03-02,Acme,100.00,RON\n'
    expect(read(t).needs.stateless).toBe(true)
    expect(read(t).txs).toEqual([])
    expect(read(t, { allCompleted: true }).txs[0].state).toBe('COMPLETED')
  })
  it('A-21 all-positive amounts with card payments among them: direction must be confirmed', () => {
    const rows = Array.from({ length: 5 }, (_, i) => `CARD_PAYMENT,Current,2026-03-0${i + 1} 12:00:00,2026-03-0${i + 1} 12:00:00,Shop ${i},10.00,0.00,RON,COMPLETED,${100 + i}.00`)
    const s = read(csv(...rows))
    expect(s.needs.signs).toBe(true)
    expect(s.txs).toEqual([])
    expect(read(csv(...rows), { positivesConfirmed: true }).txs).toHaveLength(5)
  })
})

describe('A-22..A-25 counterparty columns', () => {
  const T = 'Started Date,Description,Amount,Currency,State,Payer,Beneficiary\n'
  it('A-22 money in takes the payer; money out the beneficiary; never the first filled column', () => {
    const s = read(`${T}2026-03-02 09:00:00,Incoming,100.00,RON,COMPLETED,Acme SRL,Me Myself\n2026-03-03 09:00:00,Outgoing,-50.00,RON,COMPLETED,Me Myself,Sala Aurora\n`)
    expect(s.txs.map((t) => t.counterparty)).toEqual(['Acme SRL', 'Sala Aurora'])
  })
  it('A-23 only the wrong-side column filled: the description is read instead', () => {
    const s = read(`${T}2026-03-02 09:00:00,Payment from Beta SRL,100.00,RON,COMPLETED,,Me Myself\n`)
    expect(s.txs[0].counterparty).toBe('Beta SRL')
  })
})

describe('A-26..A-33 identity and duplicates', () => {
  const ID = 'Started Date,Completed Date,ID,Description,Amount,Currency,State,Balance\n'
  it('A-26 the same bank ID twice in one file is one transaction, read once', () => {
    const s = read(`${ID}2026-03-02 09:00:00,2026-03-02 09:00:00,tx-1,Acme,100.00,RON,COMPLETED,100.00\n2026-03-02 09:00:00,2026-03-02 09:00:00,tx-1,Acme,100.00,RON,COMPLETED,100.00\n`)
    accounted(s)
    expect(s.txs.map((t) => t.key)).toEqual(['rv:id:tx-1'])
    expect(s.issues).toEqual([{ line: 3, message: expect.stringMatching(/same transaction ID as line 2/) }])
  })
  it('A-27 the same bank ID with different details: both rows held back, nothing guessed', () => {
    const s = read(`${ID}2026-03-02 09:00:00,2026-03-02 09:00:00,tx-1,Acme,100.00,RON,COMPLETED,100.00\n2026-03-02 09:00:00,2026-03-02 09:00:00,tx-1,Acme,999.00,RON,COMPLETED,999.00\n`)
    accounted(s)
    expect(s.txs).toEqual([])
    expect(s.issues.map((i) => i.line)).toEqual([2, 3])
  })
  it('A-28 identical rows with no ID and no balance can\'t be told apart: both need a decision', () => {
    const t = 'Started Date,Description,Amount,Currency,State\n2026-03-02 12:00:00,Coffee,-5.00,RON,COMPLETED\n2026-03-02 12:00:00,Coffee,-5.00,RON,COMPLETED\n'
    const rows = rowsOf(read(t).txs)
    expect(rows.map((r) => r.match.status)).toEqual(['possible', 'possible'])
    expect(rows.map((r) => blocker(r, effective(r, { kind: 'cost' }), empty(), ALL_FEATURES))).toEqual([expect.stringMatching(/may already be in InFlow/), expect.stringMatching(/may already be in InFlow/)])
  })
  it('A-29 a re-export with a reworded description is still the same transaction (balance present)', () => {
    const a = read(csv('CARD_PAYMENT,Current,2026-03-02 09:00:00,2026-03-02 10:00:00,ZOOM.US 888-799,-15.00,0.00,RON,COMPLETED,85.00')).txs[0]
    const b = read(csv('CARD_PAYMENT,Current,2026-03-02 09:00:00,2026-03-03 10:00:00,Zoom,-15.00,0.00,RON,COMPLETED,85.00')).txs[0]
    expect(b.key).toBe(a.key)
  })
  it('A-30 the same transaction exported with and without its bank ID is recognised', () => {
    const withId = read(`${ID}2026-03-02 09:00:00,2026-03-02 09:00:00,tx-9,Acme,100.00,RON,COMPLETED,100.00\n`).txs[0]
    const without = read(csv('TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:00,Acme,100.00,0.00,RON,COMPLETED,100.00')).txs[0]
    const d = empty()
    d.records.push(pay({ id: 'r1', amount: 100, date: '2026-03-02', importMeta: { key: withId.key, fp: withId.fp, batch: 'b', counterparty: 'Acme' } }))
    expect(rowsOf([without], d)[0].match).toMatchObject({ status: 'exact', candidates: [{ id: 'r1' }] })
  })
  it('A-31 two transactions with different bank IDs are never merged, even with equal content', () => {
    const a = read(`${ID}2026-03-02 09:00:00,2026-03-02 09:00:00,tx-1,Coffee,-5.00,RON,COMPLETED,95.00\n`).txs[0]
    const b = read(`${ID}2026-03-02 09:00:00,2026-03-02 09:00:00,tx-2,Coffee,-5.00,RON,COMPLETED,95.00\n`).txs[0]
    const d = empty()
    d.costs.push({ id: 'c1', description: 'Coffee', amount: 5, currency: 'RON', fxRate: 1, amountRon: 5, date: '2026-03-02', status: 'paid', group: 'operating', category: 'other_operating', venueId: null, clientId: null, activity: null, recurring: false, deductible: true, notes: '', importMeta: { key: a.key, fp: a.fp, batch: 'b', counterparty: 'Coffee' } } as CostRecord)
    expect(rowsOf([b], d)[0].match.status).not.toBe('exact')
  })
  it('A-32 the same transaction in UTC in one export and Bucharest time in another has one key', () => {
    const utc = read('Date started (UTC),Description,Amount,Currency,State,Balance\n2026-03-02 07:15:00,Acme,100.00,RON,COMPLETED,100.00\n').txs[0]
    const local = read('Started Date,Description,Amount,Currency,State,Balance\n2026-03-02 09:15:00,Acme,100.00,RON,COMPLETED,100.00\n').txs[0]
    expect(local.key).toBe(utc.key)
  })
  it('A-33 a fee row keeps its own identity tied to its parent: re-reading makes the same fee key', () => {
    const t = csv('TRANSFER,Current,2026-03-04 10:00:00,2026-03-04 10:00:20,To Sala,-400.00,1.50,RON,COMPLETED,600.00')
    const k1 = expandFees(read(t).txs).map((x) => x.tx.key)
    const k2 = expandFees(read(t).txs).map((x) => x.tx.key)
    expect(k1).toEqual(k2)
    expect(k1[1]).toBe(`${k1[0]}:fee`)
  })
})

describe('A-44 rows imported before content fingerprints', () => {
  it('a row imported with an old-style key (no fingerprint) is offered as a possible duplicate, never missed', () => {
    const d = empty()
    d.records.push(pay({ id: 'old', amount: 100, date: '2026-03-02', importMeta: { key: 'rv:0123456789abcdef', batch: 'b0', counterparty: 'Acme' } }))
    const r = rowsOf(read(csv('TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:00,Payment from Acme,100.00,0.00,RON,COMPLETED,100.00')).txs, d)[0]
    expect(r.match).toMatchObject({ status: 'possible', candidates: [{ id: 'old' }] })
  })
})

describe('A-34..A-41 classification safety', () => {
  const T = 'Started Date,Description,Amount,Currency,State,Balance\n'
  it('A-34 two clients whose names fold the same: no client is picked', () => {
    const d = empty()
    d.clients.push(client('c1', 'Acme SRL'), client('c2', 'ACME S.R.L.'))
    const r = rowsOf(read(`${T}2026-03-02 09:00:00,Payment from Acme SRL,100.00,RON,COMPLETED,100.00\n`).txs, d)[0]
    expect(r.suggestion.clientId).toBeNull()
    expect(r.reason).toMatch(/2 clients/)
  })
  it('A-35 money in from an unknown name is not taken for service income', () => {
    const r = rowsOf(read(`${T}2026-03-02 09:00:00,Payment from Stranger Ltd,100.00,RON,COMPLETED,100.00\n`).txs)[0]
    expect(r.suggestion.kind).toBe('review')
  })
  it('A-36 two exact rules for one name that disagree: neither applies', () => {
    const rules: Rule[] = [
      { id: 'a', match: 'counterparty', value: 'Sala', direction: 'out', kind: 'cost', created: '2026-01-01' },
      { id: 'b', match: 'counterparty', value: 'Sala', direction: 'out', kind: 'personal', created: '2026-01-02' },
    ]
    const r = rowsOf(read(`${T}2026-03-02 09:00:00,To Sala,-100.00,RON,COMPLETED,100.00\n`).txs, empty(), rules)[0]
    expect([r.rule, r.suggestion.kind]).toEqual([null, 'review'])
    expect(r.reason).toMatch(/rules disagree/)
  })
  it('A-37 a rule naming a client or venue that no longer exists is not used for them', () => {
    const rules: Rule[] = [{ id: 'a', match: 'counterparty', value: 'Acme', direction: 'in', kind: 'income', clientId: 'gone', venueId: 'gone-v', created: '2026-01-01' }]
    const r = rowsOf(read(`${T}2026-03-02 09:00:00,Payment from Acme,100.00,RON,COMPLETED,100.00\n`).txs, empty(), rules)[0]
    expect([r.suggestion.clientId, r.suggestion.venueId]).toEqual([null, null])
  })
  it('A-38 a stale id chosen on a row blocks it', () => {
    const r = rowsOf(read(`${T}2026-03-02 09:00:00,Payment from Acme,100.00,RON,COMPLETED,100.00\n`).txs)[0]
    expect(blocker(r, effective(r, { kind: 'income', clientId: 'nope' }), empty(), ALL_FEATURES)).toMatch(/no longer there/)
  })
  it('A-39 linking, receiving and a suggested refund need the target confirmed', () => {
    const d = empty()
    d.clients.push(client('c1', 'Acme'))
    d.records.push(pay({ id: 'e1', amount: 500, date: '2026-03-20', clientId: 'c1', status: 'expected' }), pay({ id: 'p1', amount: 900, date: '2026-01-10', clientId: 'c1' }))
    const [rin, rout] = rowsOf(read(`${T}2026-03-02 09:00:00,Payment from Acme,100.00,RON,COMPLETED,100.00\n2026-03-03 09:00:00,To Acme,-50.00,RON,COMPLETED,50.00\n`).txs, d)
    expect(rin.suggestion.action).toBe('receive')
    expect(blocker(rin, rin.suggestion, d, ALL_FEATURES)).toMatch(/Confirm/)
    expect(blocker(rin, effective(rin, { confirmed: true }), d, ALL_FEATURES)).toBeNull()
    expect(rout.suggestion.kind).toBe('refundIssued')
    expect(blocker(rout, rout.suggestion, d, ALL_FEATURES)).toMatch(/Confirm/)
  })
  it('A-40 a refund in another currency than the payment is refused', () => {
    const d = empty()
    d.records.push(pay({ id: 'p1', amount: 900, date: '2026-01-10' }))
    const r = rowsOf(read(`${T}2026-03-03 09:00:00,To Acme,-50.00,EUR,COMPLETED,50.00\n`).txs, d)[0]
    expect(blocker(r, effective(r, { kind: 'refundIssued', action: 'import', paymentId: 'p1', confirmed: true }), d, ALL_FEATURES)).toMatch(/currency/)
  })
  it('A-41 money back for more than is left of the cost is refused', () => {
    const d = empty()
    d.costs.push({ id: 'k1', description: 'Room', amount: 100, currency: 'RON', fxRate: 1, amountRon: 100, date: '2026-03-01', status: 'paid', group: 'direct', category: 'venue_hire', venueId: null, clientId: null, activity: null, recurring: false, deductible: true, notes: '' })
    d.records.push(pay({ id: 'r0', amount: 70, date: '2026-03-02', category: 'reimbursement', repaysCostId: 'k1' }))
    const r = rowsOf(read(`${T}2026-03-05 09:00:00,Payment from Client,50.00,RON,COMPLETED,50.00\n`).txs, d)[0]
    expect(blocker(r, effective(r, { kind: 'recovery', action: 'import', repaysCostId: 'k1' }), d, ALL_FEATURES)).toMatch(/30 RON/)
  })
})

describe('A-42..A-43 the plan says what will happen', () => {
  it('A-42 a refund from a supplier is counted as unsupported, never quietly "set aside"', () => {
    const s = read(csv('CARD_REFUND,Current,2026-03-06 12:00:00,2026-03-06 12:00:00,Refund from Canva,10.00,0.00,RON,COMPLETED,110.00'))
    const rows = rowsOf(s.txs)
    const p = buildPlan({ rows, choices: new Map(rows.map((r) => [r.tx.key, r.suggestion])), data: empty(), features: ALL_FEATURES, profile: DEMO_SETTINGS_TAX, rates: new Map(), batch: 'b' })
    expect([p.counts.unsupported, p.counts.setAside, p.ops.length]).toEqual([1, 0, 0])
  })
  it('A-43 every row has exactly one outcome in the plan', () => {
    const s = read(csv(
      'TRANSFER,Current,2026-03-02 09:00:00,2026-03-02 09:00:01,Payment from Acme,100.00,0.00,RON,COMPLETED,100.00',
      'CARD_PAYMENT,Current,2026-03-03 09:00:00,,Shop,-10.00,0.00,RON,PENDING,90.00',
      'EXCHANGE,Current,2026-03-04 09:00:00,2026-03-04 09:00:00,Exchanged to EUR,-20.00,0.00,RON,COMPLETED,70.00',
      'CARD_PAYMENT,Current,2026-03-05 09:00:00,2026-03-05 09:00:00,Shop,-5.00,1.00,RON,COMPLETED,64.00',
    ))
    const rows = rowsOf(s.txs)
    const p = buildPlan({ rows, choices: new Map(rows.map((r) => [r.tx.key, r.suggestion])), data: empty(), features: ALL_FEATURES, profile: DEMO_SETTINGS_TAX, rates: new Map(), batch: 'b' })
    const c = p.counts
    // 5 rows (4 + 1 fee): pending never; exchange set aside; Acme (unknown) and Shop wait for a decision; the fee is a cost.
    expect(c).toMatchObject({ never: 1, setAside: 1, waiting: 2, costs: 1, records: 0 })
    expect(c.records + c.costs + c.refunds + c.linked + c.received + c.setAside + c.waiting + c.alreadyIn + c.never + c.unsupported).toBe(rows.length)
  })
})
