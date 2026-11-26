/**
 * The same statement reader when the bank app is not in Romanian: other languages' headers,
 * states, types and wording, and other ways of writing dates and numbers. Fixtures are invented
 * (`fixtures/README.md`); expected values are written out by hand.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { counterpartyOf, mapHeader, parseDateTime, readDirection, readMoney, readState, readStatement, readType, suggestColumns, type Statement } from './revolut'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
/** Most fixtures answer the file-level questions (Bucharest time, all completed) so other behaviour shows; the questions are tested on their own. */
const read = (name: string, opts: Parameters<typeof readStatement>[1] = {}) => readStatement(parseCsv(fixture(name)), { timeZone: 'local', allCompleted: true, ...opts })
const accounted = (s: Statement) => expect(s.txs.length + s.issues.length).toBe(s.summary.rows)
const brief = (s: Statement) => s.txs.map((t) => [t.date, t.direction, t.amount, t.currency, t.state, t.type])
const ready = (s: Statement) => expect(s.needs).toEqual({ mapping: false, currency: false, dateOrder: false, decimal: false, timeZone: false, stateless: false, signs: false, states: [], directions: [] })

describe('the app in English', () => {
  it('UK: day-first dates with a time, read without asking (14/09 settles it)', () => {
    const s = read('en-GB.csv')
    ready(s)
    accounted(s)
    expect(s.dateOrder).toBe('dmy')
    expect(brief(s)).toEqual([['2026-09-14', 'in', 640, 'GBP', 'COMPLETED', 'TRANSFER'], ['2026-10-03', 'out', 8.45, 'GBP', 'COMPLETED', 'CARD_PAYMENT']])
    expect(s.txs[0].startedAt).toBe('2026-09-14 08:12:00')
  })

  it('US: month-first dates and 12-hour times', () => {
    const s = read('en-US.csv')
    ready(s)
    expect(s.dateOrder).toBe('mdy')
    expect(brief(s)).toEqual([['2026-09-14', 'in', 1200, 'USD', 'COMPLETED', 'TRANSFER'], ['2026-10-03', 'out', 6.5, 'USD', 'COMPLETED', 'CARD_PAYMENT']])
    expect(s.txs[1].startedAt).toBe('2026-10-02 19:40:00')
    expect(parseDateTime('10/03/2026 12:05 AM', 'mdy')).toMatchObject({ date: '2026-10-03', time: '00:05:00' })
  })
})

describe('the app in German', () => {
  const s = read('de-DE.csv')
  it('German headers, states and types; semicolons; 1.500,00; 01.09.2026', () => {
    ready(s)
    accounted(s)
    expect(s.decimal).toBe(',')
    expect(brief(s)).toEqual([
      ['2026-09-01', 'in', 1500, 'EUR', 'COMPLETED', 'TRANSFER'],
      ['2026-09-03', 'out', 59.99, 'EUR', 'COMPLETED', 'CARD_PAYMENT'],
      ['2026-09-04', 'out', 400, 'EUR', 'COMPLETED', 'TRANSFER'],
      ['2026-09-05', 'out', 4.2, 'EUR', 'PENDING', 'CARD_PAYMENT'],
      ['2026-09-06', 'out', 200, 'EUR', 'COMPLETED', 'EXCHANGE'],
      ['2026-09-30', 'out', 7, 'EUR', 'COMPLETED', 'FEE'],
    ])
  })
  it('the fee, balance and other party read as in English', () => {
    expect(s.txs[0]).toMatchObject({ counterparty: 'Lumen Studio SRL', balance: 6500, fee: 0 })
    expect(s.txs[2]).toMatchObject({ counterparty: 'Sala Aurora', fee: 1.5, description: 'Überweisung an Sala Aurora' })
    expect(s.txs[3]).toMatchObject({ description: 'Bäckerei Müller' })
  })
})

describe('the app in French', () => {
  const s = read('fr-FR.csv')
  it('no-break spaces between thousands, a typeset minus, French states and types', () => {
    ready(s)
    accounted(s)
    expect(brief(s)).toEqual([
      ['2026-09-01', 'in', 1500, 'EUR', 'COMPLETED', 'TRANSFER'],
      ['2026-09-16', 'out', 4.8, 'EUR', 'COMPLETED', 'CARD_PAYMENT'],
      ['2026-09-20', 'out', 22, 'EUR', 'PENDING', 'CARD_PAYMENT'],
      ['2026-09-21', 'in', 12, 'EUR', 'COMPLETED', 'CARD_REFUND'],
    ])
    expect(s.txs[0]).toMatchObject({ counterparty: 'Atelier Lune', balance: 6500 })
    expect(s.txs[1]).toMatchObject({ description: 'Boulangerie Éclair', balance: 6495.2 })
  })
})

describe('the app in Spanish', () => {
  it('dates in words', () => {
    const s = read('es-ES.csv')
    ready(s)
    accounted(s)
    expect(brief(s)).toEqual([
      ['2026-09-05', 'in', 350, 'EUR', 'COMPLETED', ''],
      ['2026-10-12', 'out', 120.5, 'EUR', 'COMPLETED', ''],
      ['2026-11-03', 'out', 3.4, 'EUR', 'PENDING', ''],
    ])
    expect(s.txs.map((t) => t.counterparty)).toEqual(['Clara Ruiz', 'Estudio Norte', 'Cafetería Plaza'])
  })
})

describe('a Dutch bank layout', () => {
  it('unsigned amounts with Af/Bij, the currency in the amount header, dates as 20260903', () => {
    const s = read('nl-NL.csv')
    ready(s)
    accounted(s)
    expect(s.map.headerCurrency).toBe('EUR')
    expect(s.txs.map((t) => [t.date, t.direction, t.amount, t.currency, t.counterparty, t.description])).toEqual([
      ['2026-09-03', 'in', 450, 'EUR', 'Studio Tulp', 'Factuur 2026-31'],
      ['2026-09-05', 'out', 23.15, 'EUR', 'Albert Heijn 1234', 'Pinbetaling'],
      ['2026-09-10', 'out', 600, 'EUR', 'Huur Atelier', 'Kenmerk 88'],
    ])
  })

  it('an unknown direction word is asked, not guessed', () => {
    const csv = 'Datum,Bedrag (EUR),Af Bij\n20260903,"450,00",Plus\n20260904,"10,00",Minus\n'
    const s = readStatement(parseCsv(csv), { allCompleted: true })
    expect(s.needs.directions).toEqual(['Plus', 'Minus'])
    expect(s.txs).toEqual([])
    const answered = readStatement(parseCsv(csv), { allCompleted: true, directions: { plus: 'in', minus: 'out' } })
    expect(answered.txs.map((t) => [t.direction, t.amount])).toEqual([['in', 450], ['out', 10]])
  })
})

describe('a language InFlow has no words for', () => {
  it('Swedish: the unknown amount header goes to the picker, suggested from the content; unknown states are asked', () => {
    const table = parseCsv(fixture('sv-SE-unknown.csv'))
    const s = readStatement(table)
    expect(s.needs.mapping).toBe(true)
    expect(s.txs).toEqual([])
    expect(s.map.unknown).toEqual(['Beskrivning', 'Belopp'])
    expect(suggestColumns(table, s.map.columns)).toEqual({ amount: 3, description: 2 })
    const mapped = readStatement(table, { columns: { ...s.map.columns, amount: 3, description: 2 } })
    expect(mapped.needs.states).toEqual(['SLUTFÖRD', 'VÄNTANDE'])
    expect(mapped.txs).toEqual([])
    const answered = readStatement(table, { columns: { ...s.map.columns, amount: 3, description: 2 }, states: { slutford: 'COMPLETED', vantande: 'PENDING' } })
    accounted(answered)
    expect(answered.txs.map((t) => [t.date, t.direction, t.amount, t.currency, t.state])).toEqual([
      ['2026-09-01', 'in', 1200, 'SEK', 'COMPLETED'],
      ['2026-09-02', 'out', 45, 'SEK', 'COMPLETED'],
      ['2026-09-03', 'out', 32, 'SEK', 'PENDING'],
    ])
  })

  it('Cyrillic headers are kept as written (not erased), listed, and every field suggested from the content', () => {
    const table = parseCsv(fixture('bg-BG-headers.csv'))
    const s = readStatement(table)
    expect(s.map.unknown).toEqual(['Дата', 'Описание', 'Сума', 'Валута'])
    const g = suggestColumns(table, s.map.columns)
    expect(g).toEqual({ started: 0, currency: 3, amount: 2, description: 1 })
    const m = readStatement(table, { columns: g, allCompleted: true })
    expect(m.txs.map((t) => [t.date, t.direction, t.amount, t.currency, t.description])).toEqual([
      ['2026-09-01', 'in', 800, 'EUR', 'Плащане от Студио Изток'],
      ['2026-09-02', 'out', 6.5, 'EUR', 'Кафе Витоша'],
    ])
  })
})

describe('words and numbers in each language', () => {
  it('headers', () => {
    const m = (h: string[]) => mapHeader(h).columns
    expect(m(['Data rozpoczęcia', 'Kwota', 'Waluta', 'Opis'])).toEqual({ started: 0, amount: 1, currency: 2, description: 3 })
    expect(m(['Data di inizio', 'Importo', 'Valuta', 'Descrizione', 'Stato'])).toEqual({ started: 0, amount: 1, currency: 2, description: 3, state: 4 })
    expect(m(['Kezdés dátuma', 'Összeg', 'Pénznem', 'Leírás'])).toEqual({ started: 0, amount: 1, currency: 2, description: 3 })
    expect(m(['Datum', 'Částka', 'Měna', 'Popis', 'Poplatek'])).toEqual({ started: 0, amount: 1, currency: 2, description: 3, fee: 4 })
  })
  it('dates with the month in words', () => {
    const d = (s: string) => parseDateTime(s)?.date ?? null
    expect([d('1. März 2026'), d('Mar 1, 2026'), d('1 mars 2026'), d('2026. márc. 1.'), d('1 marca 2026 14:05'), d('5 nov. 2026'), d('5 noiembrie 2026'), d('3 de agosto de 2026'), d('03-04-2026')])
      .toEqual(['2026-03-01', '2026-03-01', '2026-03-01', '2026-03-01', '2026-03-01', '2026-11-05', '2026-11-05', '2026-08-03', '2026-04-03'])
    expect([parseDateTime('03-04-2026', null), parseDateTime('01/03/26'), parseDateTime('Tuesday 1 March 2026'), parseDateTime('20261340')]).toEqual([null, null, null, null])
  })
  it('numbers', () => {
    const v = (s: string) => { const m = readMoney(s); return m.ok ? m.value : 'refused' }
    expect([v('−4,80'), v('1 500,00 €'), v('1.500,00 lei'), v('12,50 zł'), v('CHF 1\'250.00'), v('-1 234,56')]).toEqual([-4.8, 1500, 1500, 12.5, 1250, -1234.56])
  })
  it('states, types and directions', () => {
    expect(['Terminé', 'ABGESCHLOSSEN', 'zakończono', 'Finalizat', 'voltooid', 'Teljesített'].map(readState)).toEqual(Array(6).fill('COMPLETED'))
    expect(['En attente', 'Ausstehend', 'În așteptare', 'Pendiente'].map(readState)).toEqual(Array(4).fill('PENDING'))
    expect(['Storniert', 'Annulé', 'Respins', 'Rechazado'].map(readState)).toEqual(['REVERTED', 'CANCELLED', 'DECLINED', 'DECLINED'])
    expect(readState('Slutförd')).toBeNull()
    expect(['Überweisung', 'Paiement par carte', 'Schimb valutar', 'Rimborso', 'CARD_PAYMENT', 'Topup'].map(readType)).toEqual(['TRANSFER', 'CARD_PAYMENT', 'EXCHANGE', 'CARD_REFUND', 'CARD_PAYMENT', 'TOPUP'])
    expect(['Bij', 'Af', 'Credit', 'Debit', 'H', 'S', '?'].map(readDirection)).toEqual(['in', 'out', 'in', 'out', 'in', 'out', null])
  })
  it('the other party, from each language\'s wording; names that start like a preposition stay whole', () => {
    expect(['Zahlung von Lumen GmbH', 'Virement de Atelier Lune', 'Plată de la Ștefan Țepeș', 'Pago de Clara Ruiz', 'Bonifico da Studio Rosa', 'Przelew od Jan Kowalski', 'Betaling van Studio Tulp', 'Către Sala Aurora', 'To Mike', 'Van Gogh Museum', 'Don Quijote Libros', 'An Post'].map(counterpartyOf))
      .toEqual(['Lumen GmbH', 'Atelier Lune', 'Ștefan Țepeș', 'Clara Ruiz', 'Studio Rosa', 'Jan Kowalski', 'Studio Tulp', 'Sala Aurora', 'Mike', 'Van Gogh Museum', 'Don Quijote Libros', 'An Post'])
  })
})
