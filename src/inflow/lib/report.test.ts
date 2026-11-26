import { describe, expect, it } from 'vitest'
import { buildDemo, DEMO_SETTINGS_TAX } from '../data/demo'
import { defaultReportOptions, presetOptions, renderReport } from './report'
import { received, sum } from './analytics'
import { lei } from './money'

const today = '2026-11-25'
const demo = buildDemo(today)
const range = { from: '2026-10-01', to: '2026-10-31' }
const ctx = { today, trackTax: true, tax: DEMO_SETTINGS_TAX }

describe('renderReport', () => {
  it('is a complete, self-contained HTML document with the period total', () => {
    const html = renderReport(demo, defaultReportOptions(range, true), ctx)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<style>')
    expect(html).not.toMatch(/<script|<link /)
    expect(html).toContain('October 2026')
    expect(html).toContain(lei(sum(received(demo.records, range))))
  })

  it('renders only the chosen sections', () => {
    const html = renderReport(demo, { ...defaultReportOptions(range, true), sections: ['clients'] }, ctx)
    expect(html).toContain('By client')
    expect(html).not.toContain('By venue')
    expect(html).not.toContain('Trend')
  })

  it('leaves tax out entirely when tax tracking is off', () => {
    const html = renderReport(demo, { ...defaultReportOptions(range, true), sections: ['summary', 'tax', 'payments'] }, { ...ctx, trackTax: false })
    expect(html).not.toContain('Tax summary')
    expect(html).not.toContain('Set aside for tax')
    expect(html).not.toContain('Tax*')
  })

  it('becomes a client statement when limited to one client', () => {
    const client = demo.clients.find((c) => c.name === 'Radu Stoica')!
    const html = renderReport(demo, { ...defaultReportOptions(range, true), ...presetOptions('client', range, today, true), clientId: client.id }, ctx)
    expect(html).toContain('Client: Radu Stoica')
    expect(html).not.toContain('Nordwind')
    const total = sum(received(demo.records, range).filter((r) => r.clientId === client.id))
    expect(html).toContain(lei(total))
  })

  it('escapes what the user typed', () => {
    const html = renderReport(demo, { ...defaultReportOptions(range, true), title: '<img src=x onerror=alert(1)>' }, ctx)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('caps breakdown tables at the chosen row count and sums the rest', () => {
    const html = renderReport(demo, { ...defaultReportOptions({ from: '2026-01-01', to: '2026-12-31' }, true), sections: ['clients'], topN: 5 }, ctx)
    expect(html).toMatch(/\d+ more<\/td>/)
  })
})

describe('the accountant’s report lists every cost (audit F-03)', () => {
  it('has a cost list with deductible marked, paid ones totalled, due ones greyed', () => {
    const year = { from: '2026-01-01', to: '2026-12-31' }
    const opt = presetOptions('accountant', year, today, true, true)
    expect(opt.sections).toContain('costs')
    const html = renderReport(demo, { ...defaultReportOptions(year, true), ...opt }, { ...ctx, trackCosts: true })
    expect(html).toContain('<h2>Costs</h2>')
    const paid = demo.costs.filter((c) => c.status === 'paid' && c.date >= year.from && c.date <= year.to)
    expect(html).toContain(lei(paid.reduce((t, c) => t + c.amountRon, 0)))
    expect(html).toContain('Deductible')
  })
  it('is left out with costs off', () => {
    const year = { from: '2026-01-01', to: '2026-12-31' }
    expect(presetOptions('accountant', year, today, true, false).sections).not.toContain('costs')
  })
})
