/**
 * Settings: the feature switches, where the data lives (this device or
 * Notion), the demo, the tax profile, targets, the clients/sources/venues
 * lists, backup, appearance. Every section folds away behind a twisty.
 */
import { useMemo, useRef, useState } from 'react'
import { Check, Lock, Minus } from 'lucide-react'
import { Button, ConfirmModal, SegmentedControl, SettingsToggle } from '../../ds'
import { memoryStore } from '../../shared/kvStore'
import { parseNotionId } from '../../shared/notionId'
import { useInflow } from '../app/state'
import { useInsightFeedback } from '../app/insightFeedback'
import { EntityEditor } from '../components/EntityEditor'
import { NumberInput, SelectInput, TextInput } from '../components/fields'
import type { Client, FeatureKey, Features, Settings as SettingsT, TaxProfileId, Venue } from '../domain/types'
import { CLIENT_COUNTRY, DEAL, PROFILE, SOURCE_TYPE, VENUE_TYPE, options } from '../domain/vocabulary'
import { clientStats } from '../lib/analytics'
import { shortDate } from '../lib/dates'
import { lei, percent } from '../lib/money'
import { BackupError, costsCsv, download, makeBackup, readBackup, recordsCsv } from '../store/backup'
import { NotionRepo } from '../store/notion'
import type { Entity, EntityKind } from '../store/repo'
import { RULESETS } from '../tax/rules'
import { ALL_FEATURES } from '../store/settings'
import { readJson, writeJson } from '../../shared/storage'
import type { ReactNode } from 'react'
import styles from '../styles/ui.module.css'

/**
 * The switchable parts of InFlow, simplest first. Under each toggle, a twisty
 * lists what it adds (short points) and what goes when it's off (one line).
 */
export const FEATURES: { key: FeatureKey; label: string; hint: string; on: string[]; off: string }[] = [
  { key: 'insights', label: 'Insights', hint: 'Pain points and wins, in plain words.',
    on: ['Read from your records, only where they apply', 'Rooms that lost money; the same work at two rooms', 'Regular clients going quiet or growing', 'Intro clients who never came back; overdue money', '👍 keeps one on top, 👎 hides it'],
    off: 'The Overview panel and the Review’s pain points go.' },
  { key: 'deals', label: 'Venue deals', hint: 'Fixed fee or revenue share, and what each venue leaves you.',
    on: ['Each venue’s deal: a fee per session, or a share', 'What every room leaves you, side by side', 'Break-even: people needed to cover a fee', 'What if: the same sessions on other terms', 'A “people who came” field on payments'],
    off: 'Deal fields, head counts and the Venue deals report go.' },
  { key: 'costs', label: 'Costs, P&L and cash flow', hint: 'Record what you spend; see what you keep.',
    on: ['A Costs tab with “where it went”', 'P&L and monthly cash flow', 'What you kept, by client and kind of work', 'A monthly break-even on the Overview'],
    off: 'Income only. Recorded costs are kept and come back.' },
  { key: 'tax', label: 'Tax suggestions', hint: 'Taxable or not, withheld, VAT, and what to set aside.',
    on: ['A suggested treatment on each payment', 'A reserve to set aside, Romanian rules', 'PFA real, PFA normă, SRL micro or your rate', 'The Tax report'],
    off: 'Nothing asks about tax; no reserves are computed.' },
  { key: 'expected', label: 'Expected payments', hint: 'Money promised but not in yet, with overdue flags.',
    on: ['Mark a payment Expected when invoiced', 'What’s coming and what’s overdue, on the Overview', 'Received in one tap; a reminder to copy'],
    off: 'The status, the list and the alerts go.' },
  { key: 'currencies', label: 'Foreign currencies', hint: 'Euro, dollars and more, converted to lei.',
    on: ['A currency on each payment or cost', 'The day’s rate, fetched for you', 'Every total in lei'],
    off: 'Lei only.' },
  { key: 'targets', label: 'Monthly target', hint: 'A goal for the month and how far you are.',
    on: ['A progress bar under “This month”'],
    off: 'No target is shown.' },
  { key: 'unusual', label: 'Unusual payments', hint: 'Flags payments far above your typical one.',
    on: ['Payments several times your typical one, tagged', 'Listed on the Overview, so a windfall isn’t read as a trend'],
    off: 'No flags.' },
  { key: 'reportTools', label: 'Report filters & split-by', hint: 'Narrow every report; cross two dimensions.',
    on: ['One filter bar for every report', 'Split by: which activities pay at which venue'],
    off: 'Reports show everything, unfiltered.' },
  { key: 'printable', label: 'Printable reports', hint: 'Build a report and save it as PDF or HTML.',
    on: ['Month at a glance, Year in review', 'A client statement; a pack for your accountant', 'Saved as PDF or HTML'],
    off: 'The Print tab goes. CSV exports stay.' },
]

/** A first-day InFlow: income, where it comes from, insights. The rest can come later. */
export const SIMPLE_START: Features = {
  ...ALL_FEATURES, tax: false, costs: false, deals: false, currencies: false, reportTools: false, printable: false, unusual: false,
}

function dealText(v: Venue): string {
  switch (v.deal) {
    case 'fixed': return `${DEAL.fixed} ${lei(v.feePerSession)}`
    case 'share': return `${DEAL.share} ${percent(v.sharePct)}`
    case 'hybrid': return `${lei(v.feePerSession)} + ${percent(v.sharePct)}`
    case 'monthly': return `${lei(v.monthlyFee)} a month`
    case 'none': return ''
  }
}

/** A settings panel that folds away behind a twisty; the choice is remembered on this device. */
function Section({ id, title, sub, action, children }: { id: string; title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  const key = `inflow:settings-open:${id}`
  const [open, setOpen] = useState(() => readJson(key, true))
  return (
    <details className={`${styles.panel} ${styles.twisty}`} open={open}
      onToggle={(e) => { const next = e.currentTarget.open; setOpen(next); writeJson(key, next) }}>
      <summary>
        <span className={styles.panelTitle}><span className={styles.twistyArrow} aria-hidden>▶</span>{title}</span>
        <span style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          {sub && <span className={styles.panelSub}>{sub}</span>}
          {action && <span onClick={(e) => e.preventDefault()}>{action}</span>}
        </span>
      </summary>
      <div className={styles.twistyBody}>{children}</div>
    </details>
  )
}

const LAST_BACKUP_KEY = 'inflow:last-backup'

export const STARTER_STEPS = ['Duplicate “InFlow — Starter Template” in Notion', 'Share it with your integration', 'Paste its Income database link below']

export function Settings() {
  const { settings, updateSettings, data, toast, today, workspace, setWorkspace, clearDemo, loadDemo, resetDemo, restore, copyDeviceToNotion, deviceHasOwnData, reload, on } = useInflow()
  const [token, setToken] = useState(settings.notionToken)
  const [dbLink, setDbLink] = useState(settings.incomeDbId)
  const [testing, setTesting] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'clear' | 'reset' | 'restore' | 'copy'>(null)
  const insightFb = useInsightFeedback()
  const [lastBackup, setLastBackup] = useState(() => readJson<string>(LAST_BACKUP_KEY, ''))
  const [pendingBackup, setPendingBackup] = useState<ReturnType<typeof readBackup> | null>(null)
  const [copying, setCopying] = useState<string | null>(null)
  const [manage, setManage] = useState<EntityKind>('client')
  const [editing, setEditing] = useState<{ kind: EntityKind; entity: Entity | null } | null>(null)
  const [deleting, setDeleting] = useState<{ kind: EntityKind; entity: Entity } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { deleteEntity } = useInflow()
  const tax = settings.tax
  const setTax = (patch: Partial<SettingsT['tax']>) => updateSettings({ tax: { ...tax, ...patch } })

  const connect = async () => {
    const id = parseNotionId(dbLink)
    if (!token.trim() || !id) { setTesting('Paste both the integration token and the Income database link.'); return }
    setTesting('Checking…')
    try {
      const probe = new NotionRepo(token.trim(), id, memoryStore())
      const d = await probe.load()
      setTesting(`Connected: ${d.records.length} payments, ${d.clients.length} clients, ${d.sources.length} sources, ${d.venues.length} venues.`)
      updateSettings({ notionToken: token.trim(), incomeDbId: id, mode: 'notion' })
      toast({ message: 'Notion connected', tone: 'success' })
    } catch (e) {
      const msg = (e as Error).message
      // A bare status means the relay itself wasn't reached (offline, blocked), not a Notion answer.
      setTesting(/request failed \((404|5\d\d)\)/.test(msg)
        ? 'Could not reach the Notion connection. Check you are online and try again.'
        : /unauthorized|invalid|token/i.test(msg)
          ? `Notion refused the token: ${msg} Check it was copied whole, from the right integration.`
          : /could not find|object_not_found|shared/i.test(msg)
            ? `${msg} Share the InFlow page with your integration (••• → Connections) and try again.`
            : `Could not connect: ${msg}`)
    }
  }

  const switchToDevice = () => { updateSettings({ mode: 'device' }); setTesting(null) }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      setPendingBackup(readBackup(await f.text()))
      setConfirm('restore')
    } catch (e) {
      toast({ message: e instanceof BackupError ? e.message : 'Could not read that file.', tone: 'danger' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const stats = useMemo(() => clientStats(data.records), [data.records])
  const list: Entity[] = manage === 'client' ? data.clients : manage === 'source' ? data.sources : data.venues
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={styles.settingsList}>
      <Section id="data" title="Your data" sub={workspace === 'demo' ? 'Demo' : settings.mode === 'notion' && settings.notionToken ? 'Notion' : 'This device'}>
        <div className={styles.settingsGroup}>
          <SegmentedControl label="Showing" value={workspace} onChange={(v) => (v === 'demo' ? void loadDemo() : setWorkspace('mine'))}
            options={[{ value: 'mine', label: 'My data' }, { value: 'demo', label: 'Demo practice' }]} />
          {workspace === 'demo' ? (
            <>
              <div className={styles.factChips} aria-label="In the demo">
                {['2 years', '35 clients', '7 rooms · fixed & share', '4 currencies', 'Costs & tax', 'Retreats & courses'].map((c) => <span key={c}>{c}</span>)}
              </div>
              <p className={styles.hint} style={{ margin: 0 }}><Lock size={12} aria-hidden /> Kept apart from your data, on this device only. Nothing of it comes with you.</p>
              <div className={styles.buttonPair}>
                <Button variant="secondary" onClick={() => setConfirm('reset')}>Reset demo</Button>
                <Button variant="danger" onClick={() => setConfirm('clear')}>Clear demo data</Button>
              </div>
            </>
          ) : (
            <>
              <SegmentedControl label="Data mode" value={settings.mode} onChange={(v) => (v === 'device' ? switchToDevice() : updateSettings({ mode: 'notion' }))}
                options={[{ value: 'device', label: 'This device' }, { value: 'notion', label: 'Notion' }]} />
              {settings.mode === 'device' ? (
                <div className={styles.factChips} aria-label="On this device">
                  <span>Works offline</span><span>This browser only</span><span>Back up below</span>
                </div>
              ) : (
                <>
                  <ol className={styles.steps}>
                    {STARTER_STEPS.map((x) => <li key={x}>{x}</li>)}
                  </ol>
                  <p className={styles.hint} style={{ margin: 0 }}><Lock size={12} aria-hidden /> The token stays on this device and goes only to this site's Notion relay.</p>
                  <TextInput label="Notion integration token" type="password" value={token} onChange={setToken} placeholder="ntn_…" />
                  <TextInput label="Income database (link or ID)" value={dbLink} onChange={setDbLink} placeholder="https://www.notion.so/…"
                    hint="Clients, Sources and Venues are found through its relations, Costs beside it on the same page." />
                  <div className={styles.buttonRow}>
                    <Button onClick={() => void connect()}>Connect & test</Button>
                    {settings.notionToken && <Button variant="secondary" onClick={() => void reload()}>Reload from Notion</Button>}
                  </div>
                  {testing && <p className={styles.hint} role="status">{testing}</p>}
                  {settings.notionToken && settings.incomeDbId && deviceHasOwnData && (
                    <div className={`${styles.banner} ${styles.bannerInfo}`}>
                      <span>This device has payments you entered before connecting.</span>
                      <Button size="sm" variant="secondary" disabled={!!copying} onClick={() => setConfirm('copy')}>{copying ?? 'Copy them to Notion'}</Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </Section>

      <Section id="appearance" title="Appearance & guide">
        <div className={styles.settingsGroup}>
          <div>
            <div className={styles.fieldLabel} style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>Theme</div>
            <SegmentedControl label="Theme" value={settings.theme} onChange={(v) => updateSettings({ theme: v as SettingsT['theme'] })}
              options={[{ value: 'system', label: 'Device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
            <p className={styles.hint} style={{ marginTop: 6 }}>“Device” follows your phone's light or dark mode.</p>
          </div>
          <SettingsToggle label="Welcome guide on opening" hint="The short tour of InFlow." checked={settings.showTour} onChange={(e) => updateSettings({ showTour: e.target.checked })} />
          <div><Button variant="secondary" onClick={() => window.dispatchEvent(new Event('inflow:tour'))}>Show the guide now</Button></div>
        </div>
      </Section>

      <Section id="features" title="Features" sub={`${Object.values(settings.features).filter(Boolean).length} of ${FEATURES.length} on`}>
        <p className={styles.hint}>Everything is on to start. Switch off what you don't need: it disappears from every screen, report and sum, and comes back exactly as it was when you switch it on.</p>
        <div className={styles.buttonRow} style={{ margin: 'var(--space-sm) 0' }}>
          <Button size="sm" variant="secondary" onClick={() => updateSettings({ features: SIMPLE_START })}>Simple start</Button>
          <Button size="sm" variant="secondary" onClick={() => updateSettings({ features: ALL_FEATURES })}>Turn everything on</Button>
        </div>
        {insightFb.hiddenCount > 0 && on('insights') && (
          <p className={styles.hint} style={{ margin: '0 0 var(--space-sm)' }}>
            {insightFb.hiddenCount} {insightFb.hiddenCount === 1 ? 'insight' : 'insights'} hidden with 👎.{' '}
            <button type="button" className={styles.linkButton} onClick={() => insightFb.reset()}>Show them again</button>
          </p>
        )}
        <div className={styles.settingsGroup}>
          {FEATURES.map((f) => (
            <div key={f.key} className={styles.featureRow}>
              <SettingsToggle label={f.label} hint={f.hint} checked={settings.features[f.key]}
                onChange={(e) => updateSettings({ features: { [f.key]: e.target.checked } })} />
              <details className={styles.featureMore}>
                <summary><span className={styles.twistyArrow} aria-hidden>▶</span>What this does</summary>
                <ul className={styles.featurePoints}>
                  {f.on.map((x) => <li key={x}><Check size={13} aria-hidden />{x}</li>)}
                </ul>
                <p className={styles.featureOff}><Minus size={13} aria-hidden /> Off: {f.off}</p>
              </details>
            </div>
          ))}
        </div>
      </Section>

      {on('costs') && workspace === 'mine' && (
        <Section id="costs" title="Costs and cash flow">
          <div className={styles.formRow}>
            <NumberInput label="Cash on hand (lei)" value={settings.openingCash} onCommit={(n) => updateSettings({ openingCash: n ?? 0 })}
              hint="Bank and cash together, on the date beside it. Cash flow counts from here." />
            <TextInput label="On" type="date" value={settings.openingCashDate} onChange={(v) => updateSettings({ openingCashDate: v })} />
          </div>
        </Section>
      )}

      {on('tax') && (
        <Section id="tax" title="Tax profile" sub={PROFILE[tax.id]}>
          <div className={styles.settingsGroup}>
          <SelectInput label="How you invoice" value={tax.id} onChange={(v) => setTax({ id: v as TaxProfileId })}>
            {options(PROFILE).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectInput>
          {(tax.id === 'pfa_real' || tax.id === 'srl_micro') && on('costs') && (
            <SettingsToggle label="Read expenses from my costs" checked={tax.expensesFromCosts} onChange={(e) => setTax({ expensesFromCosts: e.target.checked })}
              hint="Uses the costs you've recorded as deductible, annualised like your income, instead of a figure typed here." />
          )}
          {tax.id === 'pfa_real' && !(on('costs') && tax.expensesFromCosts) && (
            <NumberInput label="Deductible expenses this year (lei)" value={tax.annualExpenses}
              onCommit={(n) => setTax({ annualExpenses: n ?? 0 })} hint="Rent, equipment, training, accounting. Subtracted before CAS, CASS and income tax." />
          )}
          {tax.id === 'pfa_norma' && (
            <NumberInput label="Annual income norm (lei)" value={tax.annualNorm}
              onCommit={(n) => setTax({ annualNorm: n ?? 0 })} hint="From your county's norm for your CAEN code, after any reductions. Tax follows this, not what you earn." />
          )}
          {tax.id === 'srl_micro' && (
            <>
              {!(on('costs') && tax.expensesFromCosts) && (
                <NumberInput label="Company expenses this year (lei)" value={tax.annualExpenses} onCommit={(n) => setTax({ annualExpenses: n ?? 0 })} />
              )}
              <NumberInput label="Micro tax rate (%)" value={tax.microRate} scale={100} emptyIsZero={false}
                placeholder="ruleset default (1%)" onCommit={(n) => setTax({ microRate: n === null ? null : Math.min(1, n) })} />
              <NumberInput label="Profit paid out as dividends (%)" value={tax.dividendPayout} scale={100}
                onCommit={(n) => setTax({ dividendPayout: Math.min(1, n ?? 0) })} />
            </>
          )}
          {tax.id === 'custom' && (
            <NumberInput label="Reserve rate (%)" value={tax.customRate} scale={100}
              onCommit={(n) => setTax({ customRate: Math.min(1, n ?? 0) })} hint="A flat share of taxable income. Use it when the profiles above don't fit." />
          )}
          {tax.id !== 'custom' && tax.id !== 'srl_micro' && (
            <>
              <SettingsToggle label="Insured elsewhere for health" hint="Salary of at least 6 minimum wages, pension, or another exception: the CASS minimum base doesn't apply." checked={tax.cassCoveredElsewhere} onChange={(e) => setTax({ cassCoveredElsewhere: e.target.checked })} />
              <SettingsToggle label="Exempt from CAS" hint="E.g. pensioners." checked={tax.casExempt} onChange={(e) => setTax({ casExempt: e.target.checked })} />
              <SettingsToggle label="Pay CAS below the threshold" hint="Opt in to pension contributions on 12 minimum wages." checked={tax.casOptIn} onChange={(e) => setTax({ casOptIn: e.target.checked })} />
            </>
          )}
          <SettingsToggle label="VAT-registered" hint="Off: the small-business exemption (under 395,000 lei a year)." checked={tax.vatRegistered} onChange={(e) => setTax({ vatRegistered: e.target.checked })} />
          <NumberInput label="Expected taxable income this year (lei, optional)" value={tax.expectedAnnualIncome}
            placeholder="projected from the year so far" onCommit={(n) => setTax({ expectedAnnualIncome: n ?? 0 })}
            hint="Thresholds make the rate depend on the whole year. Leave empty to project it from what you've earned so far." />
          <p className={styles.hint}>
            Rules on file: {RULESETS.map((r) => r.id).join(', ')}. Each payment keeps the ruleset it was suggested under, and a changed setting never rewrites a reserve you've stored; open a payment and use its suggestion to update it.
          </p>
          </div>
        </Section>
      )}

      {(on('targets') || on('unusual')) && (
        <Section id="targets" title="Targets and flags">
          <div className={styles.formRow}>
            {on('targets') && <NumberInput label="Monthly income target (lei)" value={settings.monthlyTarget}
              placeholder="none" onCommit={(n) => updateSettings({ monthlyTarget: n ?? 0 })} />}
            {on('unusual') && <NumberInput label="Flag payments above (× typical)" value={settings.largeMultiple}
              onCommit={(n) => { if (n && n >= 1.5) updateSettings({ largeMultiple: n }) }} hint="1.5 or more." />}
          </div>
        </Section>
      )}

      <Section id="entities" title="Clients, sources & venues"
        action={<button type="button" className={styles.linkButton} onClick={() => setEditing({ kind: manage, entity: null })}>+ Add</button>}>
        <SegmentedControl size="sm" label="List" value={manage} onChange={(v) => setManage(v as EntityKind)}
          options={[{ value: 'client', label: `Clients (${data.clients.length})` }, { value: 'source', label: `Sources (${data.sources.length})` }, { value: 'venue', label: `Venues (${data.venues.length})` }]} />
        <div className={styles.rows} style={{ marginTop: 'var(--space-sm)' }}>
          {sorted.length === 0 && <p className={styles.hint}>None yet.</p>}
          {sorted.map((e) => {
            const st = manage === 'client' ? stats.get(e.id) : undefined
            const venue = e as Venue
            const sub = manage === 'client'
              ? `${CLIENT_COUNTRY[(e as Client).country]} · ${st ? `${lei(st.total)} · last paid ${shortDate(st.last!, Number(today.slice(0, 4)))}` : 'no payments yet'}`
              : manage === 'source' ? `${SOURCE_TYPE[(e as { type: keyof typeof SOURCE_TYPE }).type]}${(e as { active: boolean }).active ? '' : ' · inactive'}`
                : [VENUE_TYPE[venue.type], on('deals') ? dealText(venue) : '', venue.location].filter(Boolean).join(' · ')
            return (
              <button key={e.id} type="button" className={styles.row} onClick={() => setEditing({ kind: manage, entity: e })}>
                <span className={styles.rowName}>{e.name}</span>
                <span className={styles.rowValue}>{manage === 'client' && st ? `${st.count}×` : ''}</span>
                <span className={styles.rowMeta}>{sub}</span>
              </button>
            )
          })}
        </div>
      </Section>

      {workspace === 'mine' && (
        <Section id="backup" title="Backup & export" sub={lastBackup ? `last backup ${shortDate(lastBackup, Number(today.slice(0, 4)))}` : settings.mode === 'device' || !settings.notionToken ? 'no backup yet' : undefined}>
          <ul className={styles.featurePoints} style={{ marginTop: 0 }}>
            <li><Check size={13} aria-hidden />Every payment, cost, client, source and venue</li>
            <li><Check size={13} aria-hidden />Your settings</li>
            <li><Minus size={13} aria-hidden />Never your Notion token</li>
          </ul>
          <div className={styles.buttonPair}>
            <Button variant="secondary" onClick={() => { download(`inflow-backup-${today}.json`, JSON.stringify(makeBackup(data, settings), null, 2), 'application/json'); writeJson(LAST_BACKUP_KEY, today); setLastBackup(today) }}>Download backup</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>Restore…</Button>
          </div>
          <div className={styles.buttonRow} style={{ marginTop: 'var(--space-sm)' }}>
            <Button variant="secondary" onClick={() => download(`inflow-income-${today}.csv`, recordsCsv(data.records, data), 'text/csv')}>Export all payments as CSV</Button>
            {on('costs') && data.costs.length > 0 && (
              <Button variant="secondary" onClick={() => download(`inflow-costs-${today}.csv`, costsCsv(data.costs, data), 'text/csv')}>Export all costs as CSV</Button>
            )}
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
        </Section>
      )}

      {on('tax') && (
        <p className={styles.hint} style={{ textAlign: 'center' }}>
          InFlow suggests tax treatments and reserves from published Romanian rules ({RULESETS.at(-1)!.id}). They are estimates to plan with, not tax advice.
        </p>
      )}

      <ConfirmModal isOpen={confirm === 'clear'} title="Clear demo data?" variant="danger" confirmText="Clear"
        message="Removes the demo practice from this device and shows your own data. You can bring it back any time from here."
        onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); void clearDemo() }} />
      <ConfirmModal isOpen={confirm === 'reset'} title="Reset the demo?" confirmText="Reset"
        message="Puts the demo back as it started. Anything you added or changed while exploring it goes."
        onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); void resetDemo() }} />
      <ConfirmModal isOpen={confirm === 'restore'} title="Restore this backup?" confirmText="Restore"
        message={pendingBackup ? `Replaces what's on this device with ${pendingBackup.data.records.length} payments from ${pendingBackup.exportedAt.slice(0, 10)}, and switches to device mode.` : ''}
        onCancel={() => { setConfirm(null); setPendingBackup(null) }} onConfirm={() => { setConfirm(null); if (pendingBackup) void restore(pendingBackup); setPendingBackup(null) }} />
      <ConfirmModal isOpen={confirm === 'copy'} title="Copy device payments to Notion?" confirmText="Copy"
        message="Creates your own payments, and the clients, sources and venues they use, in Notion. Run it once; a second run makes duplicates."
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          setCopying('Copying…')
          void copyDeviceToNotion((d, t) => setCopying(`Copying ${d}/${t}…`))
            .then((n) => toast({ message: `Copied ${n} payments to Notion`, tone: 'success' }))
            .catch((e) => toast({ message: `Copy stopped: ${(e as Error).message}`, tone: 'danger' }))
            .finally(() => setCopying(null))
        }} />
      {editing && (
        <EntityEditor open kind={editing.kind} entity={editing.entity} onClose={() => setEditing(null)}
          onDelete={(e) => { setEditing(null); setDeleting({ kind: editing.kind, entity: e }) }} />
      )}
      <ConfirmModal isOpen={!!deleting} title={`Delete ${deleting?.entity.name ?? ''}?`} variant="danger" confirmText="Delete"
        message="Payments linked to it keep their amounts and history; the link is cleared. To hide it from pickers instead, archive it."
        onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) void deleteEntity(deleting.kind, deleting.entity.id); setDeleting(null) }} />
    </div>
  )
}

