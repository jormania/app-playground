import { describe, expect, it } from 'vitest'
import { CsvError, parseCsv } from './csv'
import { counterpartyOf, mapHeader, parseAmount, parseDateTime, readStatement } from './revolut'

/** The account-statement layout open-source importers agree on (no official Revolut Pro sample exists). */
export const REVOLUT_CSV = [
  'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
  'TRANSFER,Current,2026-03-02 09:15:01,2026-03-02 09:15:44,Payment from Ana Popescu,1200.00,0.00,RON,COMPLETED,5200.00',
  'CARD_PAYMENT,Current,2026-03-03 12:00:00,2026-03-04 08:00:00,"Zoom, Inc.",-75.50,0.00,RON,COMPLETED,5124.50',
  'TRANSFER,Current,2026-03-05 10:00:00,,To Ion Ionescu,-300.00,1.50,RON,PENDING,4823.00',
  'EXCHANGE,Current,2026-03-06 10:00:00,2026-03-06 10:00:00,Exchanged to EUR,-500.00,2.00,RON,COMPLETED,4322.00',
  'FEE,Current,2026-03-31 23:59:59,2026-03-31 23:59:59,Pro plan fee,-29.00,0.00,RON,COMPLETED,4293.00',
].join('\n')

describe('reading a statement (Release 2, experimental)', () => {
  it('reads the standard layout: direction, fee apart, completed date preferred, pending kept for review', () => {
    const s = readStatement(parseCsv(REVOLUT_CSV))
    expect(s.issues).toEqual([])
    expect(s.summary).toMatchObject({ rows: 5, read: 5, from: '2026-03-02', to: '2026-03-31', currencies: ['RON'], incoming: 1, outgoing: 4 })
    expect(s.txs[0]).toMatchObject({ direction: 'in', amount: 1200, fee: 0, counterparty: 'Ana Popescu', type: 'TRANSFER', state: 'COMPLETED', date: '2026-03-02' })
    expect(s.txs[1]).toMatchObject({ direction: 'out', amount: 75.5, description: 'Zoom, Inc.', date: '2026-03-04' })
    expect(s.txs[2]).toMatchObject({ state: 'PENDING', fee: 1.5, date: '2026-03-05', counterparty: 'Ion Ionescu' })
  })
  it('any column order, other names, semicolons, decimal commas, Romanian text, a BOM, CRLF', () => {
    const csv = '﻿Data;Descriere;Suma;Moneda;Stare\r\n02.03.2026;"Plată de la Ștefan Țepeș; atelier";"1.250,75";EUR;Completed\r\n'
    const s = readStatement(parseCsv(csv))
    expect(s.issues).toEqual([])
    expect(s.txs[0]).toMatchObject({ date: '2026-03-02', description: 'Plată de la Ștefan Țepeș; atelier', amount: 1250.75, currency: 'EUR', direction: 'in', state: 'COMPLETED' })
  })
  it('money in / money out columns; several currencies', () => {
    const csv = 'Date,Description,Money out,Money in,Currency\n2026-04-01,Payment from Acme,,500,EUR\n2026-04-02,Canva,12.99,,USD\n'
    const s = readStatement(parseCsv(csv))
    expect(s.txs.map((t) => [t.direction, t.amount, t.currency])).toEqual([['in', 500, 'EUR'], ['out', 12.99, 'USD']])
    expect(s.summary.currencies).toEqual(['EUR', 'USD'])
  })
  it('missing required columns: says which; a file without a currency column reads once its currency is named', () => {
    expect(mapHeader(['Description', 'Balance']).missing).toHaveLength(3)
    const csv = 'Date,Description,Amount\n2026-04-01,Payment from Acme,500\n'
    expect(readStatement(parseCsv(csv)).map.missing).toEqual([expect.stringMatching(/currency/)])
    expect(readStatement(parseCsv(csv), { fileCurrency: 'EUR' }).txs[0].currency).toBe('EUR')
  })
  it('bad rows are reported by line and left out, never read as zero', () => {
    const csv = 'Date,Description,Amount,Currency\n2026-04-01,Ok,10,RON\nnot a date,Bad,10,RON\n2026-04-02,Bad amount,ten,RON\n2026-04-03,Odd,5,XYZ\n'
    const s = readStatement(parseCsv(csv))
    expect(s.txs).toHaveLength(1)
    expect(s.issues.map((i) => i.line)).toEqual([3, 4, 5])
  })
  it('numbers and dates as banks write them', () => {
    expect([parseAmount('1,234.50'), parseAmount('1.234,50'), parseAmount("1'234.50"), parseAmount('(12.50)'), parseAmount('12.50-'), parseAmount('-0.99'), parseAmount('1,5'), parseAmount('€ 20'), parseAmount('abc')])
      .toEqual([1234.5, 1234.5, 1234.5, -12.5, -12.5, -0.99, 1.5, 20, NaN])
    expect(parseDateTime('2026-03-02 09:15:01')).toEqual({ date: '2026-03-02', time: '09:15:01' })
    expect(parseDateTime('2/3/2026')).toEqual({ date: '2026-03-02', time: '00:00:00' })
    expect(parseDateTime('5 Nov 2026')).toEqual({ date: '2026-11-05', time: '00:00:00' })
    expect(parseDateTime('2026-13-01')).toBeNull()
  })
  it('the same transaction has the same fingerprint in any export; identical twins in one file stay apart', () => {
    const a = readStatement(parseCsv(REVOLUT_CSV)).txs
    const reordered = [REVOLUT_CSV.split('\n')[0], ...REVOLUT_CSV.split('\n').slice(1).reverse()].join('\n')
    const b = readStatement(parseCsv(reordered)).txs
    expect(new Set(a.map((t) => t.key))).toEqual(new Set(b.map((t) => t.key)))
    const twin = REVOLUT_CSV + '\n' + REVOLUT_CSV.split('\n')[1]
    const keys = readStatement(parseCsv(twin)).txs.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('unreadable files fail with a sentence', () => {
    expect(() => parseCsv('')).toThrow(CsvError)
    expect(() => parseCsv('a,b\n"open,1')).toThrow(/never closed/)
  })
  it('counterparty from Revolut wording', () => {
    expect([counterpartyOf('Payment from SC Alfa SRL'), counterpartyOf('To Ion'), counterpartyOf('Transfer to Maria'), counterpartyOf('Uber')]).toEqual(['SC Alfa SRL', 'Ion', 'Maria', 'Uber'])
  })
})
