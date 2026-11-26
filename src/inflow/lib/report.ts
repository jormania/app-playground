/**
 * Printable reports: one self-contained HTML document, built from the records
 * on the fly. It carries its own styles and charts (inline SVG), so the same
 * string is the in-app preview, the "Save as PDF" print, and the downloadable
 * .html file someone can open years later with nothing else.
 *
 * Pure: options and data in, a string out. Every user-supplied string is escaped.
 */
import type { InflowData, TaxProfile } from '../domain/types'
import { ACTIVITY, COST_CATEGORY, COST_GROUP_SHORT, PROFILE, TAX_HANDLING, TAXABILITY, VAT } from '../domain/vocabulary'
import {
  breakdown, DIMENSION_NOUN, earned, inScope, isCostRecovery, NO_ENTITY, outstanding, received, recovered, scopeIsSet, series, summarise, sum,
  type BreakdownRow, type Dimension, type Scope,
} from './analytics'
import { buildCashFlow, buildPnl, monthColumns } from './finance'
import { earnings } from './earnings'
import { addDays, daysBetween, monthLabel, shortDate, yearOf } from './dates'
import { delta, lei, money, percent } from './money'
import { buckets, inRange } from './period'
import { projectYear, taxPosition } from '../tax/estimate'
import { insights } from './insights'
import { applyFeedback, type Feedback } from '../app/insightFeedback'
import { movers, reviewHighlights } from './review'

export type ReportSection =
  | 'summary' | 'review' | 'insights' | 'trend' | 'clients' | 'venues' | 'activities' | 'sources' | 'mix' | 'margins'
  | 'pnl' | 'cashflow' | 'outstanding' | 'tax' | 'payments' | 'costs'

export const SECTION_LABEL: Record<ReportSection, string> = {
  summary: 'Headline figures',
  review: 'In short, and the main movers',
  insights: 'Pain points and wins',
  trend: 'Trend chart',
  clients: 'By client',
  venues: 'By venue',
  activities: 'By activity',
  sources: 'By source',
  mix: 'Recurring, one-off & currencies',
  margins: 'What you kept, by client & work',
  pnl: 'Profit & loss (costs)',
  cashflow: 'Cash flow (costs)',
  outstanding: 'Expected payments',
  tax: 'Tax summary (optional)',
  payments: 'Payment list',
  costs: 'Cost list (costs)',
}

/** Sections that need costs tracked, or tax tracked. */
export const COST_SECTIONS: ReportSection[] = ['margins', 'pnl', 'cashflow', 'costs']

export interface ReportOptions {
  title: string
  subtitle: string
  from: string
  to: string
  sections: ReportSection[]
  /** Rows per breakdown table; 0 = all. */
  topN: number
  compare: boolean
  /** Limit the whole report to one client ('' = everyone): a client statement. */
  clientId: string
  /** The same narrowing for a source, venue and activity ('' = all). */
  sourceId: string
  venueId: string
  activity: string
  showOriginalCurrency: boolean
  paymentsSort: 'date' | 'amount'
  includeNotes: boolean
}

export type ReportPreset = 'monthly' | 'annual' | 'client' | 'accountant'

export const PRESET_LABEL: Record<ReportPreset, string> = {
  monthly: 'Month at a glance',
  annual: 'Year in review',
  client: 'Client statement',
  accountant: 'For my accountant',
}

/** When to print each one, and what it holds: the builder's recommendations. */
export const PRESET_ADVICE: Record<ReportPreset, { when: string; holds: string }> = {
  monthly: { when: 'At the end of each month.', holds: 'What came in, what moved, who paid most, and what to look at next.' },
  annual: { when: 'Once a year, or before planning the next.', holds: 'The year’s shape, the best and weakest work, venues and clients, and the profit.' },
  client: { when: 'When a client asks what they’ve paid.', holds: 'Their payments in the period and the total — nothing about anyone else.' },
  accountant: { when: 'Before filing, or when they ask.', holds: 'Income by source, the P&L, the tax summary, every payment with its notes, and every cost with whether it is deductible.' },
}

export function presetOptions(preset: ReportPreset, range: { from: string; to: string }, today: string, trackTax: boolean, trackCosts = false): Partial<ReportOptions> {
  const year = today.slice(0, 4)
  const keep = (s: ReportSection[]) => s.filter((x) => (x !== 'tax' || trackTax) && (!COST_SECTIONS.includes(x) || trackCosts))
  switch (preset) {
    case 'monthly':
      return { title: 'Month at a glance', subtitle: '', from: range.from, to: range.to, sections: keep(['summary', 'review', 'clients', 'insights']), topN: 5, compare: true, ...ALL }
    case 'annual':
      return { title: `${year} in review`, subtitle: '', from: `${year}-01-01`, to: `${year}-12-31`, sections: keep(['summary', 'review', 'trend', 'clients', 'venues', 'activities', 'pnl', 'insights']), topN: 10, compare: true, ...ALL }
    case 'client':
      return { title: 'Statement of payments', subtitle: '', from: range.from, to: range.to, sections: ['summary', 'payments'], topN: 0, compare: false, paymentsSort: 'date', includeNotes: false, sourceId: '', venueId: '', activity: '' }
    case 'accountant':
      return { title: `Income for ${year}`, subtitle: 'Prepared for my accountant', from: `${year}-01-01`, to: `${year}-12-31`, sections: keep(['summary', 'sources', 'pnl', 'tax', 'payments', 'costs']), topN: 0, compare: false, ...ALL, showOriginalCurrency: true, paymentsSort: 'date', includeNotes: true }
  }
}

const ALL = { clientId: '', sourceId: '', venueId: '', activity: '' }

export function defaultReportOptions(range: { from: string; to: string }, _trackTax?: boolean, _trackCosts?: boolean): ReportOptions {
  return {
    title: 'Month at a glance', subtitle: '', from: range.from, to: range.to,
    sections: ['summary', 'review', 'clients', 'insights'],
    topN: 5, compare: true, ...ALL, showOriginalCurrency: true, paymentsSort: 'date', includeNotes: false,
  }
}

export interface ReportContext {
  today: string
  trackTax: boolean
  trackCosts?: boolean
  openingCash?: number
  openingCashDate?: string
  tax: TaxProfile
  /** Features on, for the insight rules (venue deals, costs, expected payments). */
  trackDeals?: boolean
  trackExpected?: boolean
  /** Insights hidden or muted with 👎 stay out of the print too. */
  insightFeedback?: Feedback
  /** Shown in the footer, e.g. the practice's name. */
  owner?: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** Whole lei for statement cells; a dash for nothing. */
function num(v: number) {
  return v === 0 ? '–' : lei(v).replace(' lei', '')
}

function previous(from: string, to: string) {
  const len = daysBetween(from, to) + 1
  return { from: addDays(from, -len), to: addDays(from, -1) }
}

function trendSvg(values: number[], labels: string[]): string {
  const W = 640, H = 170, top = 10, bottom = 22
  const plot = H - top - bottom
  const max = Math.max(1, ...values)
  const slot = W / Math.max(1, values.length)
  const bw = Math.max(3, Math.min(36, slot * 0.6))
  const every = values.length > 16 ? Math.ceil(values.length / 8) : 1
  const bars = values.map((v, i) => {
    const h = (v / max) * plot
    const x = slot * i + (slot - bw) / 2
    const label = i % every === 0 ? `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(labels[i])}</text>` : ''
    return `${h > 0 ? `<rect x="${x.toFixed(1)}" y="${(top + plot - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>` : ''}${label}`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Income trend">
<line x1="0" x2="${W}" y1="${top + plot}" y2="${top + plot}" class="axis"/>
<line x1="0" x2="${W}" y1="${top}" y2="${top}" class="grid"/><text x="${W}" y="${top - 2}" text-anchor="end" class="tick">${esc(lei(max))}</text>
<g class="bars">${bars}</g></svg>`
}

function table(rows: BreakdownRow[], noun: string, topN: number, compare: boolean, countNoun: string): string {
  const shown = topN > 0 ? rows.slice(0, topN) : rows
  const rest = topN > 0 ? rows.slice(topN) : []
  const body = shown.map((r) => {
    const d = delta(r.total, r.previous)
    return `<tr><td>${esc(r.name)}</td><td>${lei(r.total)}</td><td>${percent(r.share)}</td><td>${r.count}</td><td>${lei(r.average)}</td>${compare ? `<td class="${d.direction}">${d.text}</td>` : ''}
<td class="barcell"><span style="width:${(r.share * 100).toFixed(1)}%"></span></td></tr>`
  }).join('')
  const other = rest.length ? `<tr class="muted"><td>${rest.length} more</td><td>${lei(sum2(rest))}</td><td>${percent(rest.reduce((s, r) => s + r.share, 0))}</td><td>${rest.reduce((s, r) => s + r.count, 0)}</td><td></td>${compare ? '<td></td>' : ''}<td></td></tr>` : ''
  return `<table><thead><tr><th>${noun}</th><th>Total</th><th>Share</th><th>${countNoun}</th><th>Average</th>${compare ? '<th>vs before</th>' : ''}<th></th></tr></thead><tbody>${body}${other}</tbody></table>`
}

const sum2 = (rows: BreakdownRow[]) => rows.reduce((s, r) => s + r.total, 0)

export function renderReport(data: InflowData, opt: ReportOptions, ctx: ReportContext): string {
  const from = opt.from <= opt.to ? opt.from : opt.to
  const to = opt.from <= opt.to ? opt.to : opt.from
  const client = opt.clientId ? data.clients.find((c) => c.id === opt.clientId) : undefined
  const sc: Scope = { clientId: opt.clientId ?? '', sourceId: opt.sourceId ?? '', venueId: opt.venueId ?? '', activity: opt.activity ?? '' }
  const scopedCosts = (data.costs ?? []).filter((c) => !sc.sourceId && (!sc.clientId || c.clientId === sc.clientId) && (!sc.venueId || c.venueId === sc.venueId) && (!sc.activity || c.activity === sc.activity))
  const scoped: InflowData = { ...data, records: data.records.filter((r) => inScope(r, sc)), costs: scopedCosts }
  const range = { from, to }
  const prevRange = previous(from, to)
  // Service payments drive every figure; cost recovery is shown on its own line (audit B-01).
  const allCur = received(scoped.records, range)
  const allBefore = received(scoped.records, prevRange)
  const cur = earned(allCur)
  const before = earned(allBefore)
  const s = summarise(cur, recovered(allCur))
  const ps = summarise(before, recovered(allBefore))
  // A comparison reaching before the first record would show "new" and runaway percentages.
  const firstRec = data.records.reduce((m, r) => (r.status === 'received' && r.date < m ? r.date : m), '9999')
  const comparable = !(firstRec > prevRange.from && ps.total > 0)
  const has = (x: ReportSection) => opt.sections.includes(x) && (x !== 'tax' || ctx.trackTax) && (!COST_SECTIONS.includes(x) || !!ctx.trackCosts || (x === 'margins' && !!ctx.trackDeals))
  const parts: string[] = []

  if (has('summary')) {
    const first = data.records.reduce((m, r) => (r.status === 'received' && r.date < m ? r.date : m), '9999')
    const partialPrev = first > prevRange.from && ps.total > 0
    const d = delta(s.total, ps.total)
    const cards = [
      ['Earned (service revenue)', lei(s.total), opt.compare ? (partialPrev ? `records start ${monthLabel(first)}: no full period to compare` : `${d.text} vs previous ${daysBetween(from, to) + 1} days (${lei(ps.total)})`) : `${s.count} payments`],
      ['Payments', String(s.count), `average ${lei(s.count ? s.total / s.count : 0)}`],
      ['Clients paid', String(new Set(cur.map((r) => r.clientId).filter(Boolean)).size), opt.clientId ? '' : `largest: ${esc(breakdown(scoped, cur, [], 'client')[0]?.name ?? '—')}`],
      ...(s.costRecovery > 0 ? [['Cost recovery', lei(s.costRecovery), 'reimbursed costs, not earnings']] : []),
      ...(ctx.trackTax ? [['Set aside for tax*', lei(s.reserve), `withheld ${lei(s.taxWithheld)}`]] : []),
    ]
    parts.push(`<section class="cards">${cards.map(([k, v, n]) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="n">${n}</div></div>`).join('')}</section>`)
  }

  if (has('review')) {
    const list = insights(scoped, range, ctx.today, { deals: !!ctx.trackDeals, costs: !!ctx.trackCosts, expected: !!ctx.trackExpected, tax: ctx.trackTax })
    const kept = ctx.trackCosts ? buildPnl(scoped.records, scoped.costs, monthColumns(range)).lines.find((l) => l.key === 'net')!.total : null
    const firstRecord = data.records.reduce((m, r) => (r.status === 'received' && r.date < m ? r.date : m), '9999')
    const facts = reviewHighlights({ data: scoped, cur, before, prevLabel: 'the period before', kept, insights: list, periodLabel: 'this period', prevFrom: prevRange.from, firstRecord })
    const mark = { in: '◆', kept: '◆', top: '★', up: '▲', down: '▼', look: '!' } as const
    const m = movers(scoped, cur, before)
    const max = Math.max(1, ...m.map((x) => Math.abs(x.change)))
    const rows = m.map((x) => {
      const w = ((Math.abs(x.change) / max) * 100).toFixed(1)
      return `<tr><td>${esc(x.name)} <span class="muted">${DIMENSION_NOUN[x.dim].toLowerCase()}</span></td><td class="mv"><div class="mvbar"><span class="half l">${x.change < 0 ? `<i class="dn" style="width:${w}%"></i>` : ''}</span><span class="half">${x.change > 0 ? `<i class="upb" style="width:${w}%"></i>` : ''}</span></div></td><td class="${x.change > 0 ? 'up' : 'down'}">${x.change > 0 ? '+' : '−'}${lei(Math.abs(x.change))}</td><td class="muted">${lei(x.previous)} → ${lei(x.current)}</td></tr>`
    }).join('')
    parts.push(`<section><h2>In short</h2><ul class="facts">${facts.map((f) => `<li class="${f.tone}"><span class="mk">${mark[f.kind]}</span><span class="k">${esc(f.label)}</span><b>${esc(f.value)}</b><span class="n">${esc(f.note)}</span></li>`).join('')}</ul>${m.length ? `<h3>Main movers, against the period before</h3><table class="movers"><tbody>${rows}</tbody></table>` : ''}</section>`)
  }

  if (has('insights')) {
    const raw = insights(scoped, range, ctx.today, { deals: !!ctx.trackDeals, costs: !!ctx.trackCosts, expected: !!ctx.trackExpected, tax: ctx.trackTax })
    const list = ctx.insightFeedback ? applyFeedback(raw, ctx.insightFeedback) : raw
    const word = { pain: 'Look at', win: 'Working', tip: 'Note' } as const
    parts.push(`<section><h2>Pain points and wins</h2>${list.length ? `<ul class="insights">${list.map((i) => `<li class="${i.kind}"><b><span class="kind">${word[i.kind]}</span> ${esc(i.title)}</b><div>${esc(i.detail)}</div></li>`).join('')}</ul>` : '<p class="muted">Nothing stands out in this period.</p>'}</section>`)
  }

  if (has('trend')) {
    const bs = buckets(range)
    parts.push(`<section><h2>Trend</h2>${trendSvg(series(scoped.records, bs), bs.map((b) => b.label))}</section>`)
  }

  const dims: [ReportSection, Dimension, string, string][] = [
    ['clients', 'client', 'Client', 'Payments'], ['venues', 'venue', 'Venue', 'Engagements'],
    ['activities', 'activity', 'Activity', 'Engagements'], ['sources', 'source', 'Source', 'Payments'],
  ]
  for (const [sec, dim, noun, countNoun] of dims) {
    if (!has(sec)) continue
    const rows = breakdown(scoped, cur, opt.compare ? before : [], dim)
    parts.push(`<section><h2>By ${dim}</h2>${rows.length ? table(rows, noun, opt.topN, opt.compare && comparable, countNoun) : '<p class="muted">Nothing in this period.</p>'}</section>`)
  }

  if (has('mix')) {
    const rec = sum(cur.filter((r) => r.recurring))
    const byCur = new Map<string, number>()
    for (const r of cur) byCur.set(r.currency, (byCur.get(r.currency) ?? 0) + r.amountRon)
    parts.push(`<section><h2>Recurring, one-off & currencies</h2><table><tbody>
<tr><td>Recurring</td><td>${lei(rec)}</td><td>${percent(s.total ? rec / s.total : 0)}</td></tr>
<tr><td>One-off</td><td>${lei(s.total - rec)}</td><td>${percent(s.total ? (s.total - rec) / s.total : 0)}</td></tr>
${[...byCur.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => `<tr><td>Paid in ${c}</td><td>${lei(v)}</td><td>${percent(s.total ? v / s.total : 0)}</td></tr>`).join('')}
</tbody></table></section>`)
  }

  if (has('margins')) {
    // The same "kept" as Clients & work: income less each venue's deal fee and the direct costs that belong to it.
    const block = (by: Dimension, noun: string) => {
      const e = earnings(scoped, range, by, { deals: !!ctx.trackDeals, costs: !!ctx.trackCosts })
      const shown = opt.topN > 0 ? e.rows.slice(0, opt.topN) : e.rows
      return `<h3>${noun}</h3><table><thead><tr><th>${noun}</th><th>Income</th><th>Venue fees</th><th>Direct costs</th><th>Kept</th><th>Sessions</th><th>A session</th></tr></thead><tbody>${shown.map((r) =>
        `<tr><td>${esc(r.name)}</td><td>${lei(r.income)}</td><td>${r.venueFees ? lei(r.venueFees) : '–'}</td><td>${r.directCosts ? lei(r.directCosts) : '–'}</td><td class="${r.kept < 0 ? 'down' : ''}">${lei(r.kept)}</td><td>${r.sessions}</td><td>${lei(r.keptPerSession)}</td></tr>`).join('')}</tbody></table>`
    }
    parts.push(`<section><h2>What you kept</h2>${block('client', 'Client')}${block('activity', 'Work')}<p class="muted">As in Clients &amp; work: income less each venue's deal fee and the direct costs linked to that venue or client, nearest in date. Overheads are not shared out.</p></section>`)
  }

  if (has('pnl')) {
    const cols = monthColumns(range)
    const pnl = buildPnl(scoped.records, scoped.costs, cols)
    const rev = pnl.lines[0].total
    const many = cols.length > 1
    parts.push(`<section class="break"><h2>Profit &amp; loss</h2><table class="statement${cols.length > 6 ? ' wide' : ''}"><thead><tr><th></th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}${many ? '<th>Total</th>' : ''}<th>%</th></tr></thead><tbody>${
      // Paper can't expand a line, so each cost's categories print under it.
      pnl.lines.map((l) => `<tr class="${l.kind === 'subtotal' || l.kind === 'revenue' ? 'total' : l.kind === 'detail' ? 'detail' : ''}"><td>${l.kind === 'cost' ? '− ' : l.kind === 'recovery' ? '+ ' : ''}${esc(l.label)}</td>${l.values.map((v) => `<td class="${v < 0 ? 'down' : ''}">${num(v)}</td>`).join('')}${many ? `<td>${num(l.total)}</td>` : ''}<td>${rev && l.kind !== 'detail' ? percent(l.total / rev) : ''}</td></tr>`).join('')
    }</tbody></table><p class="muted">Cash basis: income when received, costs when paid. Lei.${scopeIsSet(sc) ? ' Filtered: only costs linked to the filters are counted.' : ''}</p></section>`)
  }

  if (has('cashflow')) {
    const cols = monthColumns(range)
    const cf = buildCashFlow(data.records, data.costs ?? [], cols, ctx.openingCash ?? 0, ctx.openingCashDate ?? '')
    parts.push(`<section class="break"><h2>Cash flow</h2><table class="statement${cols.length > 6 ? ' wide' : ''}"><thead><tr><th></th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${
      cf.rows.map((r) => `<tr class="${r.kind === 'subtotal' || r.kind === 'balance' ? 'total' : ''}"><td>${r.kind === 'out' ? '− ' : r.kind === 'in' ? '+ ' : ''}${esc(r.label)}</td>${r.values.map((v) => `<td class="${v < 0 ? 'down' : ''}">${num(v)}</td>`).join('')}</tr>`).join('')
    }</tbody></table><p class="muted">${scopeIsSet(sc) ? 'The whole business, not just the filter above. ' : ''}${cf.relative ? 'No opening balance was set, so balances start at zero.' : `From ${lei(ctx.openingCash ?? 0)} on ${esc(ctx.openingCashDate ?? '')}.`}</p></section>`)
  }

  if (has('outstanding')) {
    const o = outstanding(scoped.records, ctx.today)
    parts.push(`<section><h2>Expected payments</h2>${o.count ? `<table><thead><tr><th>Due</th><th>Description</th><th>Client</th><th>Amount</th></tr></thead><tbody>${o.records.map((r) => `<tr><td>${r.date}${r.date < ctx.today ? ' <b class="down">overdue</b>' : ''}</td><td>${esc(r.description)}</td><td>${esc(data.clients.find((c) => c.id === r.clientId)?.name ?? '—')}</td><td>${esc(money(r.amount, r.currency))}</td></tr>`).join('')}</tbody></table><p class="muted">Total ${lei(o.total)}, not counted in the figures above.</p>` : '<p class="muted">Nothing outstanding.</p>'}</section>`)
  }

  if (has('tax')) {
    const year = yearOf(to > ctx.today ? ctx.today : to)
    const p = projectYear(ctx.tax, data.records, year, ctx.today, 0, ctx.trackCosts ? data.costs ?? [] : [])
    parts.push(`<section><h2>Tax summary*</h2><table><tbody>
<tr><td>Taxable income</td><td>${lei(s.taxable)}</td></tr>
<tr><td>&nbsp;&nbsp;with tax withheld at source</td><td>${lei(s.withheld)}</td></tr>
<tr><td>&nbsp;&nbsp;to declare yourself</td><td>${lei(s.selfDeclared)}</td></tr>
<tr><td>Non-taxable income</td><td>${lei(s.nonTaxable)}</td></tr>
<tr><td>Needs review</td><td>${lei(s.review)}</td></tr>
<tr><td>Tax withheld or paid</td><td>${lei(s.taxWithheld)}</td></tr>
<tr><td>Set aside on these payments</td><td>${lei(s.reserve)}</td></tr>
</tbody></table>
<h3>${year} estimate · ${esc(PROFILE[ctx.tax.id])} · rules ${p.estimate.rules.id}${p.estimate.provisional ? ' (provisional)' : ''}</h3>
<table><tbody><tr><td>Taxable income, full year (${p.method === 'expected' ? 'expected' : p.method === 'actual' ? 'actual' : 'projected'})</td><td>${lei(p.projected)}</td></tr>
${p.estimate.lines.map((l) => `<tr><td>${esc(l.label)}${l.rate !== null && l.base !== null ? ` <span class="muted">${percent(l.rate)} of ${lei(l.base)}</span>` : ''}</td><td>${lei(l.amount)}</td></tr>`).join('')}
<tr class="total"><td>Estimated total</td><td>${lei(p.estimate.total)}</td></tr><tr><td>Effective rate</td><td>${percent(p.rate, 1)}</td></tr></tbody></table>
${(() => {
    // The same "still to set aside" as the app's Tax report.
    const { owed, withheld, reserved, gap } = taxPosition(ctx.tax, data.records, year, ctx.today, ctx.trackCosts ? data.costs : [])
    return `<table><tbody><tr><td>Owed on ${year} income so far, at that rate</td><td>${lei(owed)}</td></tr><tr><td>Withheld or paid this year</td><td>− ${lei(withheld)}</td></tr><tr><td>Already set aside this year</td><td>− ${lei(reserved)}</td></tr><tr class="total"><td>${gap > 0 ? 'Still to set aside' : 'Ahead of the reserve by'}</td><td>${lei(Math.abs(gap))}</td></tr></tbody></table>`
  })()}
<p class="muted">${p.estimate.notes.map(esc).join(' ')}</p></section>`)
  }

  if (has('payments')) {
    const rs = [...allCur, ...scoped.records.filter((r) => r.status === 'expected' && inRange(r.date, range))]
      .sort(opt.paymentsSort === 'amount' ? (a, b) => b.amountRon - a.amountRon : (a, b) => a.date.localeCompare(b.date))
    const name = (l: { id: string; name: string }[], id: string | null) => esc(l.find((x) => x.id === id)?.name ?? '')
    const taxCols = ctx.trackTax
    const rows = rs.map((r) => `<tr${r.status === 'expected' ? ' class="muted"' : ''}><td>${r.date}</td><td>${esc(r.description)}${r.status === 'expected' ? ' (expected)' : ''}${isCostRecovery(r) ? ' <span class="muted">(cost recovery)</span>' : ''}${opt.includeNotes && r.notes ? `<div class="note">${esc(r.notes)}</div>` : ''}</td>
${opt.clientId ? '' : `<td>${name(data.clients, r.clientId)}</td>`}<td>${name(data.venues, r.venueId)}</td>
${opt.showOriginalCurrency ? `<td>${r.currency === 'RON' ? '' : esc(money(r.amount, r.currency))}</td>` : ''}<td>${lei(r.amountRon)}</td>
${taxCols ? `<td>${TAXABILITY[r.taxability]}${r.taxability === 'taxable' ? `, ${TAX_HANDLING[r.taxHandling].toLowerCase()}` : ''}; VAT ${VAT[r.vat].toLowerCase()}${r.taxWithheld ? `; withheld ${lei(r.taxWithheld)}` : ''}</td>` : ''}</tr>`).join('')
    parts.push(`<section class="break"><h2>Payments</h2>${rs.length ? `<table class="list"><thead><tr><th>Date</th><th>Description</th>${opt.clientId ? '' : '<th>Client</th>'}<th>Venue</th>${opt.showOriginalCurrency ? '<th>Original</th>' : ''}<th>Lei</th>${taxCols ? '<th>Tax*</th>' : ''}</tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td></td><td>Earned${s.costRecovery ? ` (plus ${lei(s.costRecovery)} cost recovery)` : ''}</td>${opt.clientId ? '' : '<td></td>'}<td></td>${opt.showOriginalCurrency ? '<td></td>' : ''}<td>${lei(s.total)}</td>${taxCols ? '<td></td>' : ''}</tr></tfoot></table>` : '<p class="muted">No payments in this period.</p>'}</section>`)
  }

  if (has('costs')) {
    // Every cost in the period, for the accountant: paid ones counted, due ones shown greyed (audit F-03).
    const cs = (scoped.costs ?? []).filter((c) => inRange(c.date, range)).sort((a, b) => a.date.localeCompare(b.date))
    const paid = cs.filter((c) => c.status === 'paid')
    const total = (xs: typeof cs) => Math.round(xs.reduce((t, c) => t + c.amountRon, 0) * 100) / 100
    const name = (l: { id: string; name: string }[], id: string | null) => esc(l.find((x) => x.id === id)?.name ?? '')
    const rows = cs.map((c) => `<tr${c.status === 'due' ? ' class="muted"' : ''}><td>${c.date}</td><td>${esc(c.description)}${c.status === 'due' ? ' (due)' : ''}${opt.includeNotes && c.notes ? `<div class="note">${esc(c.notes)}</div>` : ''}</td><td>${esc(COST_GROUP_SHORT[c.group])} · ${esc(COST_CATEGORY[c.category])}</td><td>${name(data.venues, c.venueId) || name(data.clients, c.clientId)}</td>${opt.showOriginalCurrency ? `<td>${c.currency === 'RON' ? '' : esc(money(c.amount, c.currency))}</td>` : ''}<td>${lei(c.amountRon)}</td><td>${c.deductible ? 'yes' : ''}</td></tr>`).join('')
    parts.push(`<section class="break"><h2>Costs</h2>${cs.length ? `<table class="list"><thead><tr><th>Date</th><th>Description</th><th>Kind</th><th>Venue / client</th>${opt.showOriginalCurrency ? '<th>Original</th>' : ''}<th>Lei</th><th>Deductible</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td></td><td>Paid</td><td></td><td></td>${opt.showOriginalCurrency ? '<td></td>' : ''}<td>${lei(total(paid))}</td><td>${lei(total(paid.filter((c) => c.deductible)))}</td></tr></tfoot></table><p class="muted">Paid costs counted; due ones shown greyed, not counted. "Deductible" is as you marked each cost.</p>` : '<p class="muted">No costs in this period.</p>'}</section>`)
  }

  const periodText = `${shortDate(from, 0)} – ${shortDate(to, 0)}`
  const monthTitle = from.slice(8) === '01' && to === lastDay(from) ? monthLabel(from) : periodText
  const venue = data.venues.find((v) => v.id === opt.venueId)
  const source = data.sources.find((x) => x.id === opt.sourceId)
  const subtitle = [
    opt.subtitle,
    client ? `Client: ${client.name}` : '',
    venue ? `Venue: ${venue.name}` : '',
    opt.activity && opt.activity !== NO_ENTITY ? `Activity: ${ACTIVITY[opt.activity as keyof typeof ACTIVITY]}` : '',
    source ? `Source: ${source.name}` : '',
  ].filter(Boolean).map(esc).join(' · ')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opt.title || 'Income report')} — ${esc(monthTitle)}</title><style>${CSS}</style></head><body><main>
<header><div class="brand">InFlow</div><h1>${esc(opt.title || 'Income report')}</h1><div class="period">${esc(monthTitle)}${subtitle ? ` · ${subtitle}` : ''}</div></header>
${parts.join('\n') || '<p class="muted">Pick at least one section.</p>'}
<footer>Generated ${shortDate(ctx.today, 0)} by InFlow${ctx.owner ? ` for ${esc(ctx.owner)}` : ''}. Amounts in lei, converted at the rate recorded on each payment; received payments only unless marked expected.${ctx.trackTax && (has('tax') || has('summary') || has('payments')) ? ' * Tax figures are optional estimates from published Romanian rules, not tax advice.' : ''}</footer>
</main></body></html>`
}

function lastDay(from: string) {
  const d = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0)
  return `${from.slice(0, 7)}-${String(d.getDate()).padStart(2, '0')}`
}


const CSS = `
:root{--ink:#1d2321;--muted:#5d6561;--faint:#8b928e;--line:#e2dfd7;--accent:#1e6b57;--soft:#f4f3ef;--up:#2f7d4f;--down:#b3412f}
*{box-sizing:border-box}html{background:#fff}body{margin:0;color:var(--ink);font:14px/1.5 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
main{max-width:820px;margin:0 auto;padding:40px 32px}
header{border-bottom:2px solid var(--ink);padding-bottom:14px;margin-bottom:22px}
.brand{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700}
h1{font-size:28px;letter-spacing:-.02em;margin:4px 0 2px}.period{color:var(--muted)}
h2{font-size:15px;margin:26px 0 8px;letter-spacing:-.01em}h3{font-size:13px;margin:16px 0 6px;color:var(--muted)}
section{break-inside:avoid}section.break{break-inside:auto}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.card{border:1px solid var(--line);border-radius:10px;padding:12px 14px}.card .k{font-size:12px;color:var(--muted)}.card .v{font-size:22px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.card .n{font-size:11px;color:var(--faint)}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th{font-size:11px;color:var(--faint);font-weight:600;text-align:right;padding:4px 6px;border-bottom:1px solid var(--ink)}
td{text-align:right;padding:6px;border-bottom:1px solid var(--line);vertical-align:top}th:first-child,td:first-child{text-align:left;padding-left:0}
table.statement td,table.statement th{white-space:nowrap;font-size:12px;padding:4px 5px}table.statement.wide td,table.statement.wide th{font-size:9.5px;padding:3px 2px}table.statement tr.total td{font-weight:700}table.statement tr.detail td{color:var(--muted);font-size:11px}table.statement tr.detail td:first-child{padding-left:16px}
table.list td:nth-child(2),table.list th:nth-child(2),table.list td:nth-child(3),table.list th:nth-child(3),table.list td:nth-child(4),table.list th:nth-child(4){text-align:left}
tfoot td{font-weight:700;border-bottom:0;border-top:1px solid var(--ink)}tr.total td{font-weight:700;border-top:1px solid var(--ink)}
.barcell{width:22%}.barcell span{display:block;height:8px;border-radius:4px;background:var(--accent)}
.up{color:var(--up)}.down{color:var(--down)}.new{color:var(--up)}.muted,.muted td{color:var(--faint)}.note{font-size:11px;color:var(--muted)}
.chart{width:100%;height:auto}.chart .bars rect{fill:var(--accent)}.chart text{font-size:10px;fill:var(--faint)}.chart .axis{stroke:var(--ink)}.chart .grid{stroke:var(--line)}
.lede{font-size:15px;line-height:1.6;margin:0 0 6px;max-width:62ch}
ul.facts{list-style:none;margin:0 0 8px;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}ul.facts li{display:grid;grid-template-columns:18px 1fr;grid-template-areas:'mk k' 'mk b' 'mk n';border-bottom:1px solid var(--line);padding:6px 0}ul.facts .mk{grid-area:mk;font-weight:700}ul.facts .k{grid-area:k;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}ul.facts b{grid-area:b;font-size:15px}ul.facts .n{grid-area:n;font-size:12px;color:var(--muted)}ul.facts li.good .mk{color:var(--up)}ul.facts li.bad .mk{color:#c07a22}ul.facts li.neutral .mk{color:#5d6fc4}
table.movers td{vertical-align:middle}table.movers td.mv{width:34%}table.movers .mvbar{display:grid;grid-template-columns:1fr 1fr;align-items:center}
table.movers .half{display:flex;height:10px}table.movers .half.l{justify-content:flex-end;border-right:1px solid var(--faint)}table.movers i{display:block;height:10px}
table.movers i.upb{background:#0a8a6c;border-radius:0 4px 4px 0}table.movers i.dn{background:#c07a22;border-radius:4px 0 0 4px}
ul.insights{list-style:none;padding:0;margin:0;display:grid;gap:8px}ul.insights li{border-left:3px solid var(--line);padding:2px 0 2px 10px}
ul.insights li.pain{border-color:#c07a22}ul.insights li.win{border-color:#0a8a6c}ul.insights li.tip{border-color:#5d6fc4}ul.insights .kind{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-right:4px}ul.insights div{color:var(--muted);font-size:13px}
footer{margin-top:32px;padding-top:10px;border-top:1px solid var(--line);font-size:11px;color:var(--faint)}
@page{size:A4;margin:16mm 14mm}@media print{main{padding:0;max-width:none}a{color:inherit}}
`
