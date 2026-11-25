/**
 * The printable report, kept simple: pick one of four reports, each saying
 * when to print it and what it holds; the dates follow the selected period
 * (or the year); a statement asks for its client. Everything else — title,
 * sections, rows, notes — waits behind "Adjust", for when you need it.
 * Print saves it as PDF (every browser offers that); HTML keeps a copy.
 */
import { useMemo, useRef, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '../../ds'
import { readJson, writeJson } from '../../shared/storage'
import { useInflow } from '../app/state'
import { useInsightFeedback } from '../app/insightFeedback'
import { usePeriodData } from '../app/usePeriod'
import { SelectInput, TextInput } from '../components/fields'
import {
  COST_SECTIONS, PRESET_ADVICE, PRESET_LABEL, presetOptions, renderReport, SECTION_LABEL,
  type ReportOptions, type ReportPreset, type ReportSection,
} from '../lib/report'
import { shortDate } from '../lib/dates'
import { download } from '../store/backup'
import styles from '../styles/ui.module.css'

const KEY = 'inflow:report-choice'
const ORDER: ReportSection[] = ['summary', 'review', 'insights', 'trend', 'clients', 'venues', 'activities', 'sources', 'mix', 'margins', 'pnl', 'cashflow', 'outstanding', 'tax', 'payments']
const PRESETS = Object.keys(PRESET_LABEL) as ReportPreset[]

export function ReportBuilder() {
  const { data, settings, today, on } = useInflow()
  const { range } = usePeriodData()
  const insightFb = useInsightFeedback()
  const [preset, setPreset] = useState<ReportPreset>(() => readJson<ReportPreset>(KEY, 'monthly'))
  const base = (p: ReportPreset): ReportOptions => ({
    title: '', subtitle: '', from: range.from, to: range.to, sections: [], topN: 5, compare: true,
    clientId: '', sourceId: '', venueId: '', activity: '', showOriginalCurrency: true, paymentsSort: 'date', includeNotes: false,
    ...presetOptions(p, range, today, on('tax'), on('costs')),
  })
  const [opt, setOpt] = useState<ReportOptions>(() => base(preset))
  const frame = useRef<HTMLIFrameElement>(null)
  const set = (patch: Partial<ReportOptions>) => setOpt((o) => ({ ...o, ...patch }))
  const choose = (p: ReportPreset) => {
    setPreset(p)
    writeJson(KEY, p)
    // A statement keeps the client already chosen.
    setOpt((o) => ({ ...base(p), clientId: p === 'client' ? o.clientId : '' }))
  }
  const toggle = (s: ReportSection) => set({ sections: opt.sections.includes(s) ? opt.sections.filter((x) => x !== s) : ORDER.filter((x) => x === s || opt.sections.includes(x)) })

  // Only sections whose feature is on are offered, or printed.
  const sections = ORDER.filter((s) => (s !== 'tax' || on('tax')) && (!COST_SECTIONS.includes(s) || on('costs')) && (s !== 'outstanding' || on('expected'))
    && (s !== 'mix' || on('currencies')) && (s !== 'insights' || on('insights')))
  const live = useMemo(() => ({ ...opt, sections: opt.sections.filter((x) => sections.includes(x)) }), [opt, sections])
  const needsClient = preset === 'client' && !opt.clientId
  const html = useMemo(
    () => renderReport(data, live, {
      today, trackTax: on('tax'), tax: settings.tax, insightFeedback: insightFb.feedback, trackCosts: on('costs'), trackDeals: on('deals'), trackExpected: on('expected'),
      openingCash: settings.openingCash, openingCashDate: settings.openingCashDate,
    }),
    [data, live, today, on, settings.tax, settings.openingCash, settings.openingCashDate, insightFb.feedback],
  )

  const print = () => {
    const w = frame.current?.contentWindow
    if (w) { w.focus(); w.print() }
  }
  const file = `inflow-${(opt.title || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${opt.from}-${opt.to}.html`
  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name))
  const year = Number(today.slice(0, 4))

  return (
    <div className={styles.builder}>
      <section className={styles.panel}>
        <div className={styles.form}>
          <div className={styles.fieldLabel} style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>What do you want to print?</div>
          <div className={styles.presetList} role="radiogroup" aria-label="Report">
            {PRESETS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={preset === p} className={styles.preset} onClick={() => choose(p)}>
                <b>{PRESET_LABEL[p]}</b>
                <span className={styles.presetWhen}>{PRESET_ADVICE[p].when}</span>
                <span className={styles.presetHolds}>{PRESET_ADVICE[p].holds}</span>
              </button>
            ))}
          </div>

          {preset === 'client' && (
            <SelectInput label="Client" value={opt.clientId} onChange={(v) => set({ clientId: v })}>
              <option value="">Choose a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          )}

          <div className={styles.periodLine}>
            <span>{shortDate(opt.from, year)} – {shortDate(opt.to, year)}</span>
            {(opt.from !== range.from || opt.to !== range.to) && (
              <button type="button" className={styles.linkButton} onClick={() => set({ from: range.from, to: range.to })}>Use {range.label.toLowerCase()}</button>
            )}
            {(opt.from !== `${year}-01-01` || opt.to !== `${year}-12-31`) && (
              <button type="button" className={styles.linkButton} onClick={() => set({ from: `${year}-01-01`, to: `${year}-12-31` })}>Use {year}</button>
            )}
          </div>

          <div className={styles.buttonRow}>
            <Button onClick={print} disabled={needsClient}><Printer size={16} aria-hidden /> Print / save as PDF</Button>
            <Button variant="secondary" disabled={needsClient} onClick={() => download(file, html, 'text/html')}><Download size={16} aria-hidden /> HTML</Button>
          </div>
          <p className={styles.hint} style={{ margin: 0 }}>In the print dialog choose “Save as PDF”.</p>

          <details className={`${styles.featureMore} ${styles.adjust}`}>
            <summary><span className={styles.twistyArrow} aria-hidden>▶</span>Adjust this report</summary>
            <div className={styles.form} style={{ marginTop: 'var(--space-sm)' }}>
              <TextInput label="Title" value={opt.title} onChange={(v) => set({ title: v })} />
              <TextInput label="Subtitle (optional)" value={opt.subtitle} onChange={(v) => set({ subtitle: v })} placeholder="e.g. Prepared for my accountant" />
              <div className={styles.formRow}>
                <TextInput label="From" type="date" value={opt.from} onChange={(v) => set({ from: v })} />
                <TextInput label="To" type="date" value={opt.to} onChange={(v) => set({ to: v })} />
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className={styles.fieldLabel} style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>Sections</legend>
                <div className={styles.checks}>
                  {sections.map((s) => (
                    <label key={s} className={styles.check}>
                      <input type="checkbox" checked={opt.sections.includes(s)} onChange={() => toggle(s)} />
                      {SECTION_LABEL[s]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <SelectInput label="Rows per table" value={String(opt.topN)} onChange={(v) => set({ topN: Number(v) })}>
                <option value="5">Top 5</option>
                <option value="10">Top 10</option>
                <option value="0">All</option>
              </SelectInput>
              <div className={styles.checks}>
                <label className={styles.check}><input type="checkbox" checked={opt.compare} onChange={(e) => set({ compare: e.target.checked })} />Compare with the period before</label>
                {on('currencies') && <label className={styles.check}><input type="checkbox" checked={opt.showOriginalCurrency} onChange={(e) => set({ showOriginalCurrency: e.target.checked })} />Show original currencies</label>}
                <label className={styles.check}><input type="checkbox" checked={opt.includeNotes} onChange={(e) => set({ includeNotes: e.target.checked })} />Include payment notes</label>
              </div>
            </div>
          </details>
        </div>
      </section>
      {needsClient
        ? <div className={`${styles.panel} ${styles.empty}`}>Choose the client the statement is for.</div>
        : <iframe ref={frame} className={styles.preview} title="Report preview" srcDoc={html} />}
    </div>
  )
}
