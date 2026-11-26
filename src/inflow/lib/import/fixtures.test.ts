/**
 * The statement reader against synthetic fixtures (`fixtures/`, all invented; see its README).
 * Every expected value below is written out by hand from the file, never taken from the parser.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { decimalEvidence, detectDateOrder, mapHeader, readMoney, readStatement, type Statement } from './revolut'
import { classify, expandFees } from './classify'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const read = (name: string, opts: Parameters<typeof readStatement>[1] = {}) => readStatement(parseCsv(fixture(name)), opts)
/** Every data row is either read or reported: none disappears. */
const accounted = (s: Statement) => expect(s.txs.length + s.issues.length).toBe(s.summary.rows)
const brief = (s: Statement) => s.txs.map((t) => [t.line, t.date, t.direction, t.amount, t.currency, t.fee, t.state])

describe('fixture: personal-standard.csv (the layout third-party importers document)', () => {
  const s = read('personal-standard.csv')

  it('reads every row, with direction from the sign and the completed date where there is one', () => {
    expect(s.needs).toEqual({ mapping: false, currency: false, dateOrder: false })
    expect(s.issues).toEqual([])
    accounted(s)
    expect(brief(s)).toEqual([
      [2, '2026-09-01', 'in', 1500, 'RON', 0, 'COMPLETED'],
      [3, '2026-09-03', 'out', 59.99, 'RON', 0, 'COMPLETED'],
      [4, '2026-09-04', 'out', 400, 'RON', 1.5, 'COMPLETED'],
      [5, '2026-09-06', 'in', 59.99, 'RON', 0, 'COMPLETED'],
      [6, '2026-09-08', 'in', 842.35, 'RON', 0, 'COMPLETED'],
      [7, '2026-09-10', 'out', 1000, 'RON', 0, 'COMPLETED'],
      [8, '2026-09-11', 'in', 250, 'RON', 0, 'COMPLETED'],
      [9, '2026-09-12', 'out', 300, 'RON', 0, 'COMPLETED'],
      [10, '2026-09-14', 'out', 18.5, 'RON', 0, 'PENDING'],
      [11, '2026-09-16', 'out', 72, 'RON', 0, 'REVERTED'],
      [12, '2026-09-30', 'out', 29, 'RON', 0, 'COMPLETED'],
    ])
    expect(s.summary).toEqual({ rows: 11, read: 11, from: '2026-09-01', to: '2026-09-30', currencies: ['RON'], incoming: 4, outgoing: 7 })
    expect(s.decimal).toBe('.')
  })

  it('keeps descriptions as written, commas and Romanian letters included; types and balances as given', () => {
    expect(s.txs[1]).toMatchObject({ description: 'Canva, Inc.', counterparty: 'Canva, Inc.', type: 'CARD_PAYMENT', balance: 6440.01, product: 'Current' })
    expect(s.txs[4]).toMatchObject({ description: 'Payment from Plăți Card Demo SA', counterparty: 'Plăți Card Demo SA' })
    expect(s.txs[8]).toMatchObject({ description: 'Cafeneaua Măgura', startedAt: '2026-09-14 13:15:00' })
    expect(s.txs.map((t) => t.type)).toEqual(['TRANSFER', 'CARD_PAYMENT', 'TRANSFER', 'CARD_REFUND', 'TRANSFER', 'EXCHANGE', 'TOPUP', 'TRANSFER', 'CARD_PAYMENT', 'CARD_PAYMENT', 'FEE'])
  })

  it('a fee stays a fee and a refund a refund: neither is folded into another amount', () => {
    // The 1.50 fee is on top of the 400, not in it; the refund is money in, at its own amount.
    expect(s.txs[2]).toMatchObject({ amount: 400, fee: 1.5, counterparty: 'Sala Aurora' })
    expect(s.txs[3]).toMatchObject({ amount: 59.99, direction: 'in', type: 'CARD_REFUND' })
    const rows = classify(expandFees(s.txs), { data: { records: [], costs: [], clients: [], sources: [], venues: [], refunds: [] }, rules: [], ledger: {}, ownNames: [] })
    expect(rows.filter((r) => r.parent).map((r) => [r.tx.amount, r.suggestion.kind])).toEqual([[1.5, 'fee']])
    expect(rows.find((r) => r.tx.line === 5)!.suggestion.kind).toBe('refundReceived')
    expect(rows.find((r) => r.tx.line === 12)!.suggestion.kind).toBe('fee')
    expect(rows.find((r) => r.tx.line === 7)!.suggestion.kind).toBe('transfer')
    expect(rows.find((r) => r.tx.line === 9)!.suggestion.kind).toBe('transfer')
  })
})

describe('fixture: business-utc.csv (fields Revolut names for Business; header wording assumed)', () => {
  const s = read('business-utc.csv')

  it('maps UTC dates, ID, Payer, payment currency; leaves Total amount, card and account unused', () => {
    const m = s.map
    expect(m.conflicts).toEqual([])
    expect(m.columns).toMatchObject({ started: 0, completed: 1, id: 2, type: 3, state: 4, description: 5, reference: 6, counterparty: 7, origCurrency: 9, origAmount: 10, currency: 11, amount: 12, fee: 14, feeCurrency: 15, balance: 16 })
    expect(m.unused).toEqual(['Card number', 'Total amount', 'Account'])
    expect(m.unknown).toEqual([])
  })

  it('reads amounts in the payment currency, keeps the original amount for the record, and the bank id as the key', () => {
    accounted(s)
    expect(brief(s)).toEqual([
      [2, '2026-10-01', 'in', 1035, 'EUR', 0, 'COMPLETED'],
      [3, '2026-10-03', 'out', 14.72, 'EUR', 0, 'COMPLETED'],
      [4, '2026-10-05', 'out', 250, 'EUR', 1.2, 'COMPLETED'],
      [5, '2026-10-06', 'in', 120, 'EUR', null, 'COMPLETED'],
      [6, '2026-10-07', 'out', 310, 'EUR', 0, 'DECLINED'],
    ])
    expect(s.txs[0]).toMatchObject({ key: 'rv:id:a1f0c2d4-0001-4b1e-9c00-000000000001', counterparty: 'Northgate Learning Ltd', reference: 'INV-2026-041', original: { amount: 900, currency: 'GBP' } })
    expect(s.txs[1]).toMatchObject({ counterparty: 'Zoomly Video, Inc.', original: { amount: 15.99, currency: 'USD' } })
    expect(s.txs[2]).toMatchObject({ counterparty: 'Atelier Verde SRL', reference: 'Chirie sala oct' })
  })

  it('a fee in another currency is not imported as if it were in the transaction\'s, and says so', () => {
    expect(s.txs[3].fee).toBeNull()
    expect(s.notes).toEqual([{ line: 5, message: expect.stringMatching(/0\.50 GBP.*another currency/) }])
  })

  it('a UTC and a local date column: the local one is used, and that is no conflict', () => {
    const m = mapHeader(['Date started (UTC)', 'Date started (Europe/Bucharest)', 'Amount', 'Currency'])
    expect([m.columns.started, m.conflicts]).toEqual([1, []])
  })
})

describe('fixture: ro-money-in-out.csv (Romanian names, semicolons, comma decimals)', () => {
  const s = read('ro-money-in-out.csv')

  it('money in and money out columns give the direction; "1.250,00" is 1,250', () => {
    accounted(s)
    expect(s.decimal).toBe(',')
    expect(brief(s)).toEqual([
      [2, '2026-11-03', 'in', 1250, 'RON', null, 'COMPLETED'],
      [3, '2026-11-05', 'out', 89.9, 'RON', null, 'COMPLETED'],
      [4, '2026-11-14', 'out', 9, 'RON', null, 'COMPLETED'],
      [5, '2026-11-20', 'in', 45.5, 'RON', null, 'COMPLETED'],
      [6, '2026-11-21', 'in', 318.4, 'RON', null, 'COMPLETED'],
    ])
  })

  it('keeps Romanian text, the semicolon inside quotes, references and balances', () => {
    expect(s.txs[0]).toMatchObject({ description: 'Plată de la Ștefănescu Ioana; atelier copii', counterparty: 'Ștefănescu Ioana; atelier copii', reference: 'REF 2026/77', balance: 4250 })
    expect(s.txs[1]).toMatchObject({ description: 'Librăria Cărturești', reference: '', balance: 4160.1 })
    // No fee column: the fee is unknown, not zero.
    expect(s.txs.every((t) => t.fee === null)).toBe(true)
  })
})

describe('fixture: minimal-file-currency.csv (date, description, amount; optional columns absent)', () => {
  it('asks for the currency and reads nothing until it is given', () => {
    const s = read('minimal-file-currency.csv')
    expect(s.needs).toEqual({ mapping: false, currency: true, dateOrder: false })
    expect(s.txs).toEqual([])
  })

  it('with the currency named: day-first dates (13/10 settles it), and every optional field empty, not zero', () => {
    const s = read('minimal-file-currency.csv', { fileCurrency: 'RON' })
    accounted(s)
    expect(s.dateOrder).toBe('dmy')
    expect(brief(s)).toEqual([
      [2, '2026-10-13', 'in', 600, 'RON', null, 'COMPLETED'],
      [3, '2026-10-14', 'out', 45, 'RON', null, 'COMPLETED'],
      [4, '2026-11-02', 'in', 600, 'RON', null, 'COMPLETED'],
    ])
    expect(s.txs[1]).toMatchObject({ description: 'Ticketeria, plata bilet', balance: null, reference: '', bankId: '', type: '', product: '' })
    // Two identical payments on different days are two transactions.
    expect(s.txs[0].key).not.toBe(s.txs[2].key)
  })
})

describe('fixture: reordered-quoted.csv (other column order, BOM, CRLF, quotes)', () => {
  const s = read('reordered-quoted.csv')
  it('finds every column by name, keeps doubled quotes and commas inside quotes, and two currencies', () => {
    accounted(s)
    expect(brief(s)).toEqual([
      [2, '2026-08-03', 'in', 200, 'EUR', null, 'COMPLETED'],
      [3, '2026-08-07', 'out', 12.3, 'EUR', null, 'COMPLETED'],
      [4, '2026-08-09', 'in', 75, 'GBP', null, 'COMPLETED'],
    ])
    expect(s.txs[0]).toMatchObject({ description: 'Payment from "Blue Door" Coaching, Cluj', counterparty: '"Blue Door" Coaching, Cluj', startedAt: '2026-08-03 10:00:00' })
    expect(s.summary.currencies).toEqual(['EUR', 'GBP'])
  })
})

describe('what needs a person to decide', () => {
  it('ambiguous-dates.csv: no day after the 12th, so the order is asked, and read as told', () => {
    const s = read('ambiguous-dates.csv')
    expect(s.needs.dateOrder).toBe(true)
    expect(s.txs).toEqual([])
    expect(read('ambiguous-dates.csv', { dateOrder: 'dmy' }).txs.map((t) => t.date)).toEqual(['2026-04-03', '2026-06-05'])
    expect(read('ambiguous-dates.csv', { dateOrder: 'mdy' }).txs.map((t) => t.date)).toEqual(['2026-03-04', '2026-05-06'])
    expect(detectDateOrder(['03/04/2026', '25/04/2026'])).toBe('dmy')
    expect(detectDateOrder(['04/25/2026'])).toBe('mdy')
    expect(detectDateOrder(['25/04/2026', '04/25/2026'])).toBe('mixed')
  })

  it('ambiguous-decimals.csv: "1,250" alone could be 1.25 or 1,250, so neither is imported', () => {
    const s = read('ambiguous-decimals.csv')
    accounted(s)
    expect(s.txs).toEqual([])
    expect(s.issues).toEqual([
      { line: 2, message: expect.stringMatching(/could be 1\.250 or 1250/) },
      { line: 3, message: expect.stringMatching(/could be 2\.500 or 2500/) },
    ])
    expect(read('ambiguous-decimals.csv', { decimal: '.' }).txs.map((t) => t.amount)).toEqual([1250, 2500])
  })

  it('unknown-headers.csv: asks for mapping, names what it didn\'t recognise, and reads once mapped', () => {
    const s = read('unknown-headers.csv')
    expect(s.needs.mapping).toBe(true)
    expect(s.txs).toEqual([])
    expect(s.map.missing).toHaveLength(3)
    expect(s.map.unknown).toEqual(['When', 'What', 'How much', 'Ccy'])
    const m = read('unknown-headers.csv', { columns: { started: 0, description: 1, amount: 2, currency: 3 } })
    expect(m.needs.mapping).toBe(false)
    expect(brief(m)).toEqual([[2, '2026-04-01', 'in', 300, 'RON', null, 'COMPLETED']])
  })

  it('conflicting-columns.csv: two amount columns are never picked between', () => {
    const s = read('conflicting-columns.csv')
    expect(s.needs.mapping).toBe(true)
    expect(s.map.conflicts).toEqual(['"Amount" and "Suma" could each be the amount (signed: money out negative).'])
    expect(s.txs).toEqual([])
  })

  it('a signed amount and money in / out together, or one column mapped twice, is a conflict', () => {
    expect(mapHeader(['Date', 'Amount', 'Money in', 'Money out', 'Currency']).conflicts).toEqual([expect.stringMatching(/Both a signed amount/)])
    const s = read('unknown-headers.csv', { columns: { started: 0, description: 2, amount: 2, currency: 3 } })
    expect(s.needs.mapping).toBe(true)
    expect(s.map.conflicts).toEqual([expect.stringMatching(/"How much" is mapped as both/)])
  })

  it('total-amount-only.csv: "Total amount" may include the fee, so it is not taken for the amount', () => {
    const s = read('total-amount-only.csv')
    expect(s.needs.mapping).toBe(true)
    expect(s.map.unused).toEqual(['Total amount'])
    expect(s.map.missing).toEqual([expect.stringMatching(/an amount/)])
  })
})

describe('fixture: malformed-rows.csv (one bad row of each kind)', () => {
  const s = read('malformed-rows.csv')
  it('reads the good rows, reports every bad one by line with why, and drops none silently', () => {
    accounted(s)
    expect(brief(s)).toEqual([
      [2, '2026-05-01', 'in', 300, 'RON', null, 'COMPLETED'],
      [13, '2026-05-11', 'out', 1234.56, 'RON', 0, 'COMPLETED'],
    ])
    expect(s.issues.map((i) => i.line)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const why = Object.fromEntries(s.issues.map((i) => [i.line, i.message]))
    expect(why[3]).toMatch(/"12\.5\.0" is not a well-formed number/)
    expect(why[4]).toMatch(/"1\.250" has more decimals than an amount of money/)
    expect(why[5]).toMatch(/"XYZ" isn't a currency/)
    expect(why[6]).toMatch(/"\$" isn't a currency/)
    expect(why[7]).toMatch(/7 values for 6 columns/)
    expect(why[8]).toMatch(/cut short/)
    expect(why[9]).toMatch(/zero/)
    expect(why[10]).toMatch(/No amount/)
    expect(why[11]).toMatch(/Unreadable date "2026-02-30 10:00:00"/)
    expect(why[12]).toMatch(/Fee: "abc" is not a number/)
  })
})

describe('money values, one rule at a time', () => {
  it('reads what is certain', () => {
    const ok = (raw: string, d: '.' | ',' | null = null) => { const m = readMoney(raw, d); return m.ok ? m.value : m.error }
    expect([ok('1,234.50'), ok('1.234,50'), ok("1'234.50"), ok('(12.50)'), ok('12.50-'), ok('-0.99'), ok('€ 20'), ok('+5'), ok('1 234,50'), ok('1.234.567', ','), ok('1,234', '.'), ok('1.250', ',')])
      .toEqual([1234.5, 1234.5, 1234.5, -12.5, -12.5, -0.99, 20, 5, 1234.5, 1234567, 1234, 1250])
  })
  it('refuses what is not', () => {
    const bad = (raw: string, d: '.' | ',' | null = null) => { const m = readMoney(raw, d); return m.ok ? `read as ${m.value}` : 'refused' }
    expect([bad('1,250'), bad('1.250'), bad('12,50', '.'), bad('1.234.567', '.'), bad('12.5.0'), bad('1,2,3'), bad('0.123'), bad('abc'), bad(''), bad('1.2,3.4')])
      .toEqual(Array(10).fill('refused'))
  })
  it('only well-formed values count as evidence of the decimal mark', () => {
    expect([decimalEvidence('12.50'), decimalEvidence('1.234,5'), decimalEvidence('1.234.567'), decimalEvidence('12.5.0'), decimalEvidence('1,250'), decimalEvidence('300')])
      .toEqual(['.', ',', ',', null, null, null])
  })
})
