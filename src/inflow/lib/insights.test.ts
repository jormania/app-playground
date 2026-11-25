import { describe, expect, it } from 'vitest'
import { buildDemo } from '../data/demo'
import { applyFeedback } from '../app/insightFeedback'
import { insights, practice, type Insight } from './insights'

const today = '2026-11-25'
const demo = buildDemo(today)
const year = { from: '2026-01-01', to: '2026-12-31' }
const all = { deals: true, costs: true, expected: true }
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
  it('names the room that lost money, the overdue payment, intro clients and the same workshop at two rooms', () => {
    expect(rules).toEqual(expect.arrayContaining(['losing-sessions', 'overdue', 'intro-clients', 'venue-for-the-same-work']))
    expect(list.find((i) => i.rule === 'losing-sessions')!.detail).toMatch(/once 3 people have booked/)
  })

  it('calls only regular clients quiet: an agency that books twice a year is not fading', () => {
    const quiet = list.filter((i) => i.rule === 'regular-fading').map((i) => i.title)
    expect(quiet.length).toBeGreaterThan(0)
    expect(quiet.some((t) => /Aegean/.test(t))).toBe(false)
    const p = practice(demo, today)
    for (const i of list.filter((x) => x.rule === 'regular-fading')) expect(p.regularClients.has(i.id.replace('fading-', ''))).toBe(true)
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

  it('counts only individual clients as intro clients, not companies with a project', () => {
    const intro = list.find((i) => i.rule === 'intro-clients')!
    expect(intro.title).toMatch(/new individual clients/)
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
