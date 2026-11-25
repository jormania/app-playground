/**
 * The printable report, built on the fly. Pick a preset or adjust the parts —
 * dates, sections, how many rows, one client only, original currencies, notes —
 * and the preview redraws. Print saves it as PDF (every browser offers that);
 * Download keeps it as a single HTML file.
 */
import { useMemo, useRef, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '../../ds'
import { readJson, writeJson } from '../../shared/storage'
import { useInflow } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { SelectInput, TextInput } from '../components/fields'
import {
  COST_SECTIONS, defaultReportOptions, PRESET_LABEL, presetOptions, renderReport, SECTION_LABEL,
  type ReportOptions, type ReportPreset, type ReportSection,
} from '../lib/report'
import { ACTIVITY, options } from '../domain/vocabulary'
import { download } from '../store/backup'
import styles from '../styles/ui.module.css'

const KEY = 'inflow:report-options'
const ORDER: ReportSection[] = ['summary', 'trend', 'clients', 'venues', 'activities', 'sources', 'mix', 'margins', 'pnl', 'cashflow', 'outstanding', 'tax', 'payments']

export function ReportBuilder() {
  const { data, settings, today, scope } = useInflow()
  const { range } = usePeriodData()
  const [opt, setOpt] = useState<ReportOptions>(() => ({
    ...defaultReportOptions(range, settings.trackTax, settings.trackCosts),
    ...readJson<Partial<ReportOptions>>(KEY, {}),
    from: range.from,
    to: range.to,
    // Starts from the filters set on the other reports.
    clientId: scope.clientId, sourceId: scope.sourceId, venueId: scope.venueId, activity: scope.activity,
  }))
  const frame = useRef<HTMLIFrameElement>(null)
  const set = (patch: Partial<ReportOptions>) => setOpt((o) => {
    const next = { ...o, ...patch }
    const { from: _f, to: _t, clientId: _c, sourceId: _s, venueId: _v, activity: _a, ...keep } = next
    writeJson(KEY, keep)
    return next
  })
  const toggle = (s: ReportSection) => set({ sections: opt.sections.includes(s) ? opt.sections.filter((x) => x !== s) : ORDER.filter((x) => x === s || opt.sections.includes(x)) })

  const html = useMemo(
    () => renderReport(data, opt, {
      today, trackTax: settings.trackTax, tax: settings.tax, trackCosts: settings.trackCosts,
      openingCash: settings.openingCash, openingCashDate: settings.openingCashDate,
    }),
    [data, opt, today, settings.trackTax, settings.tax, settings.trackCosts, settings.openingCash, settings.openingCashDate],
  )

  const print = () => {
    const w = frame.current?.contentWindow
    if (w) { w.focus(); w.print() }
  }
  const file = `inflow-${(opt.title || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${opt.from}-${opt.to}.html`
  const sections = ORDER.filter((s) => (s !== 'tax' || settings.trackTax) && (!COST_SECTIONS.includes(s) || settings.trackCosts))
  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={styles.builder}>
      <section className={styles.panel}>
        <div className={styles.form}>
          <div className={styles.chips}>
            {(Object.keys(PRESET_LABEL) as ReportPreset[]).map((p) => (
              <button key={p} type="button" className={styles.chip} onClick={() => set(presetOptions(p, range, today, settings.trackTax, settings.trackCosts))}>{PRESET_LABEL[p]}</button>
            ))}
          </div>
          <TextInput label="Title" value={opt.title} onChange={(v) => set({ title: v })} />
          <TextInput label="Subtitle (optional)" value={opt.subtitle} onChange={(v) => set({ subtitle: v })} placeholder="e.g. Prepared for my accountant" />
          <div className={styles.formRow}>
            <TextInput label="From" type="date" value={opt.from} onChange={(v) => set({ from: v })} />
            <TextInput label="To" type="date" value={opt.to} onChange={(v) => set({ to: v })} />
          </div>
          <button type="button" className={styles.linkButton} style={{ alignSelf: 'flex-start' }} onClick={() => set({ from: range.from, to: range.to })}>
            Use the selected period ({range.label.toLowerCase()})
          </button>
          <SelectInput label="Client" value={opt.clientId} onChange={(v) => set({ clientId: v })} hint="One client only turns it into a statement for them.">
            <option value="">Everyone</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
          <div className={styles.formRow}>
            <SelectInput label="Venue" value={opt.venueId} onChange={(v) => set({ venueId: v })}>
              <option value="">All</option>
              {[...data.venues].sort((a, b) => a.name.localeCompare(b.name)).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </SelectInput>
            <SelectInput label="Activity" value={opt.activity} onChange={(v) => set({ activity: v })}>
              <option value="">All</option>
              {options(ACTIVITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
          </div>
          <SelectInput label="Source" value={opt.sourceId} onChange={(v) => set({ sourceId: v })}>
            <option value="">All</option>
            {[...data.sources].sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </SelectInput>
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
          <div className={styles.formRow}>
            <SelectInput label="Rows per table" value={String(opt.topN)} onChange={(v) => set({ topN: Number(v) })}>
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="0">All</option>
            </SelectInput>
            <SelectInput label="Payments sorted by" value={opt.paymentsSort} onChange={(v) => set({ paymentsSort: v as ReportOptions['paymentsSort'] })}>
              <option value="date">Date</option>
              <option value="amount">Amount</option>
            </SelectInput>
          </div>
          <div className={styles.checks}>
            <label className={styles.check}><input type="checkbox" checked={opt.compare} onChange={(e) => set({ compare: e.target.checked })} />Compare with the period before</label>
            <label className={styles.check}><input type="checkbox" checked={opt.showOriginalCurrency} onChange={(e) => set({ showOriginalCurrency: e.target.checked })} />Show original currencies</label>
            <label className={styles.check}><input type="checkbox" checked={opt.includeNotes} onChange={(e) => set({ includeNotes: e.target.checked })} />Include payment notes</label>
          </div>
          <div className={styles.buttonRow}>
            <Button onClick={print}><Printer size={16} aria-hidden /> Print / save as PDF</Button>
            <Button variant="secondary" onClick={() => download(file, html, 'text/html')}><Download size={16} aria-hidden /> HTML</Button>
          </div>
          <p className={styles.hint}>In the print dialog choose “Save as PDF”. Your choices are remembered on this device.</p>
        </div>
      </section>
      <iframe ref={frame} className={styles.preview} title="Report preview" srcDoc={html} />
    </div>
  )
}
