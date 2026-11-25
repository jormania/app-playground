import { describe, expect, it } from 'vitest'
import { buildDemo } from '../data/demo'
import { applyFeedback } from '../app/insightFeedback'
import { insights, practice, type Insight } from './insights'

const today = '2026-11-25'
const demo = buildDemo(today)
const year = { from: '2026-01-01', to: '2026-12-31' }
const all = { deals: true, costs: true, expected: true, tax: true }
const list = insights(demo, year, today, all)
const rules = list.map((i) => i.rule)

describe('reading the practice', () => {
  it('knows its regular clients, its full months and that it runs group work', () => {
    const p = practice(demo, today)
    expect(p.groupWork).toBe(true)
    expect(p.fullMonths).toBeGreaterThanOrEqual(12)
    expect(p.regularClients.size).toBeGreaterThan(5)
  })
})

describe('insights that apply to this practice', () => {
  it('names the room that lost money, the overdue payment, the tax decisions and the same workshop at two rooms', () => {
    expect(rules).toEqual(expect.arrayContaining(['losing-sessions', 'overdue', 'tax-review', 'venue-for-the-same-work']))
    expect(list.find((i) => i.rule === 'losing-sessions')!.detail).toMatch(/once 3 people have booked/)
  })

  it('keeps pain points for what costs money or needs a decision', () => {
    // One evening that lost a little is a tip; overdue money and open tax questions are pain points.
    expect(list.find((i) => i.rule === 'losing-sessions')!.kind).toBe('tip')
    expect(list.filter((i) => i.kind === 'pain').map((i) => i.rule).sort()).toEqual(['overdue', 'tax-review'])
  })

  it('does not call a client who finished coaching "quiet": only a recurring arrangement that stopped, as a note', () => {
    const stopped = list.filter((i) => i.rule === 'regular-fading')
    expect(stopped.map((i) => i.title).join()).toMatch(/Pași Mici/)
    for (const i of stopped) expect(i.kind).toBe('tip')
    // A couple whose sessions ended, course sales tapering off, an agency booking twice a year: not flagged.
    expect(stopped.some((i) => /Mihai|Courseline|Aegean/.test(i.title))).toBe(false)
  })

  it('does not call a new client growth, and treats intro clients who mostly return as fine', () => {
    expect(list.some((i) => i.rule === 'regular-growing' && /Andreea/.test(i.title))).toBe(false)
    expect(rules).not.toContain('intro-clients')
  })

  it('flags costs past their date, and nothing about tax with tax switched off', () => {
    const late = { ...demo, costs: [...demo.costs, { ...demo.costs[0], id: 'late', status: 'due' as const, date: '2026-11-01' }] }
    expect(insights(late, year, today, all).find((i) => i.rule === 'costs-overdue')?.kind).toBe('pain')
    expect(insights(demo, year, today, { ...all, tax: false }).map((i) => i.rule)).not.toContain('tax-review')
  })

  it('never picks the running month, or a first month while the practice started up, as the quietest', () => {
    const q = list.find((i) => i.rule === 'quiet-month')
    if (q) {
      expect(q.title).not.toMatch(/^Nov 2026/)
      expect(q.title).not.toMatch(/^(Oct|Nov) 2025/)
      expect(q.title).toMatch(/\d{4} was your quietest month/)
    }
  })

  it('compares the same work only at rooms, never on an online platform paid monthly', () => {
    for (const i of list.filter((x) => x.rule === 'venue-for-the-same-work')) expect(i.title).not.toMatch(/Coachlane|Online/)
  })

  it('needs five sessions before calling a kind of work the best', () => {
    const best = list.find((i) => i.rule === 'best-work')
    if (best) expect(Number(best.detail.match(/^(\d+) sessions/)![1])).toBeGreaterThanOrEqual(5)
    expect(list.some((i) => /^Retreat keeps the most/.test(i.title))).toBe(false)
  })

  it('speaks about intro clients only when most of them never came back', () => {
    const lost = { ...demo, records: demo.records.filter((r) => !['demo_c_intro_irina', 'demo_c_intro_mara'].includes(r.clientId ?? '')) }
    const intro = insights(lost, year, today, all).find((i) => i.rule === 'intro-clients')
    if (intro) { expect(intro.kind).toBe('tip'); expect(intro.title).toMatch(/new individual clients/) }
  })

  it('does not read one week as leaning on one client', () => {
    const week = insights(demo, { from: '2026-11-23', to: '2026-11-29' }, today, all)
    for (const i of week.filter((x) => x.rule === 'one-client')) expect(i.title).toMatch(/last twelve months/)
  })

  it('leaves out what is switched off', () => {
    const lean = insights(demo, year, today, { deals: false, costs: false, expected: false }).map((i) => i.rule)
    expect(lean).not.toContain('losing-sessions')
    expect(lean).not.toContain('venue-for-the-same-work')
    expect(lean).not.toContain('thin-margin')
    expect(lean).not.toContain('overdue')
  })

  it('puts the period first, then longer trends, each ordered by what is at stake', () => {
    const firstTrend = list.findIndex((i) => i.span)
    expect(firstTrend).toBeGreaterThan(0)
    expect(list.slice(firstTrend).every((i) => i.span)).toBe(true)
    for (const part of [list.slice(0, firstTrend), list.slice(firstTrend)])
      for (let i = 1; i < part.length; i++) expect(part[i - 1].weight).toBeGreaterThanOrEqual(part[i].weight)
  })

  it('a new practice with two months of records gets no seasonal or client-trend insights', () => {
    const young = { ...demo, records: demo.records.filter((r) => r.date >= '2026-10-01') }
    const r = insights(young, year, today, all).map((i) => i.rule)
    expect(r).not.toContain('quiet-month')
    expect(r).not.toContain('regular-fading')
    expect(r).not.toContain('one-client')
  })
})

describe('feedback', () => {
  const mk = (id: string, rule: Insight['rule']): Insight => ({ id, rule, kind: 'tip', title: id, detail: '', weight: 1 })
  const xs = [mk('a', 'overdue'), mk('b', 'regular-fading'), mk('c', 'regular-fading'), mk('d', 'quiet-month')]
  it('hides one, mutes a rule, and puts liked ones first', () => {
    expect(applyFeedback(xs, { liked: ['d'], hidden: ['a'], muted: [] }).map((i) => i.id)).toEqual(['d', 'b', 'c'])
    expect(applyFeedback(xs, { liked: [], hidden: [], muted: ['regular-fading'] }).map((i) => i.id)).toEqual(['a', 'd'])
  })
})
