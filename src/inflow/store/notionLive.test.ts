/**
 * Values read back from the live InFlow databases on 26 Nov 2026 (a test venue at a 300-lei fixed
 * fee, a 1,000-lei payment there with its deal snapshot, a 250-lei refund of it, then the venue's
 * fee raised to 500 in Notion), put back into the API's page shape and loaded by InFlow's own
 * NotionRepo. What this proves and what it doesn't: INFLOW.md, "Notion reliability".
 */
import { describe, expect, it } from 'vitest'
import { memoryStore } from '../../shared/kvStore'
import { received, summarise } from '../lib/analytics'
import { venueDeal } from '../lib/deals'
import { buildCashFlow, buildPnl, monthColumns } from '../lib/finance'
import { withRefunds } from '../lib/refunds'
import { taxableGross } from '../tax/estimate'
import { NotionRepo, termsFromText } from './notion'

const t = (s: string) => ({ rich_text: s ? [{ plain_text: s }] : [] })
const title = (s: string) => ({ title: [{ plain_text: s }] })
const sel = (s: string | null) => ({ select: s ? { name: s } : null })
const n = (x: number | null) => ({ number: x })
const rel = (id: string) => ({ relation: [{ id }] })
const day = (d: string) => ({ date: { start: d } })

const VENUE = '424d3e6d-60db-8194-91a1-f045e97d5581'
const PAYMENT = '424d3e6d-60db-81f8-9fde-f46f68bd72c4'
// As Notion returned them; the snapshot exactly as the read showed it, braces escaped.
const venue = { id: VENUE, properties: { Name: title('ZZ InFlow live test venue (delete me)'), Type: sel('In person'), Deal: sel('Fixed fee'), 'Fee per session': n(500), 'Share %': n(0), 'Monthly fee': n(0), Archived: { checkbox: false }, Location: t(''), Notes: t('') } }
const payment = { id: PAYMENT, properties: {
  Description: title('ZZ InFlow live test payment (delete me)'), Amount: n(1000), Currency: sel('RON'), 'FX rate': n(1), 'Amount RON': n(1000), Date: day('2026-11-20'),
  Status: sel('Received'), Venue: rel(VENUE), Client: { relation: [] }, Source: { relation: [] }, Category: sel('Workshop'), Recurring: { checkbox: false }, Notes: t(''),
  Attendees: n(8), Sessions: n(1), Hours: n(null), Taxability: sel('Taxable'), 'Tax handling': sel('Self-declared'), VAT: sel('Exempt'), Classification: sel('Confirmed'),
  'Tax reserve RON': n(200), 'Reserve source': sel('Suggested'), 'Tax withheld RON': n(0), 'Tax rules': t('RO-2026'),
  'Venue terms': t('\\{"deal":"fixed","feePerSession":300,"sharePct":0,"monthlyFee":0\\}'), 'Refund of': t(''), 'Repays cost': t(''),
} }
const refund = { id: '424d3e6d-60db-8160-a279-e0c083e546b7', properties: {
  Description: title('Refund: ZZ InFlow live test payment (delete me)'), Amount: n(250), Currency: sel('RON'), 'FX rate': n(1), 'Amount RON': n(250), Date: day('2026-11-25'),
  Status: sel('Refund'), 'Refund of': t('424d3e6d60db81f89fdef46f68bd72c4'), Venue: rel(VENUE), Notes: t('Live test refund'),
} }

async function load() {
  const call = async (path: string, method: string) => {
    if (path === 'databases/inc' && method === 'GET') return { properties: { Description: {}, Amount: {}, Date: {}, Taxability: {}, Client: { relation: { database_id: 'cl' } }, Source: { relation: { database_id: 'so' } }, Venue: { relation: { database_id: 've' } } } }
    if (path === 'databases/inc/query') return { results: [refund, payment], has_more: false }
    if (path === 'databases/ve/query') return { results: [venue], has_more: false }
    if (path.endsWith('/query')) return { results: [], has_more: false }
    return {}
  }
  return new NotionRepo('t', 'inc', memoryStore(), call).load()
}

describe('the live Notion rows, through InFlow', () => {
  it('reads the payment with its snapshot, and the refund as a refund linked to it', async () => {
    const d = await load()
    expect(d.records).toHaveLength(1)
    expect(d.records[0].dealTerms).toEqual({ deal: 'fixed', feePerSession: 300, sharePct: 0, monthlyFee: 0 })
    expect(d.refunds).toEqual([expect.objectContaining({ paymentId: '424d3e6d60db81f89fdef46f68bd72c4', amount: 250, date: '2026-11-25' })])
    expect(d.refunds[0].paymentId).toBe(d.records[0].id)
  })

  it('the venue’s fee raised to 500 in Notion leaves the session at the 300 it was made under', async () => {
    const d = await load()
    const deal = venueDeal(d.venues[0], withRefunds(d).records, { from: '2026-11-01', to: '2026-11-30' })
    expect(d.venues[0].feePerSession).toBe(500)
    expect(deal.venueCost).toBe(300)
    expect(deal.revenue).toBe(750)
    expect(deal.underEarlierDeal).toBe(1)
  })

  it('every figure takes the refund on its date: revenue, cash, P&L, tax; the stored reserve stays', async () => {
    const d = withRefunds(await load())
    const nov = { from: '2026-11-01', to: '2026-11-30' }
    const s = summarise(received(d.records, nov))
    expect(s.total).toBe(750)
    expect(s.count).toBe(1)
    expect(s.reserve).toBe(200)
    const cols = monthColumns(nov)
    expect(buildPnl(d.records, d.costs, cols).lines.find((l) => l.key === 'revenue:refunds')!.total).toBe(-250)
    expect(buildCashFlow(d.records, d.costs, cols, 0, '').rows.find((r) => r.key === 'refunds')!.values).toEqual([250])
    expect(taxableGross(d.records, 2026)).toBe(750)
  })

  it('a snapshot with escaped braces is still read; plain JSON as InFlow writes it, of course', () => {
    expect(termsFromText('\\{"deal":"share","feePerSession":0,"sharePct":0.3,"monthlyFee":0\\}')).toEqual({ deal: 'share', feePerSession: 0, sharePct: 0.3, monthlyFee: 0 })
    expect(termsFromText('{"deal":"share","feePerSession":0,"sharePct":0.3,"monthlyFee":0}')).toEqual({ deal: 'share', feePerSession: 0, sharePct: 0.3, monthlyFee: 0 })
  })
})
