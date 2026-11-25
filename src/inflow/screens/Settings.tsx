/**
 * Settings: where the data lives (this device or Notion), the demo, the tax
 * profile, targets, the clients/sources/venues lists, and backup.
 */
import { useMemo, useRef, useState } from 'react'
import { Button, ConfirmModal, SegmentedControl, SettingsToggle } from '../../ds'
import { memoryStore } from '../../shared/kvStore'
import { parseNotionId } from '../../shared/notionId'
import { useInflow, hasDemo } from '../app/state'
import { EntityEditor } from '../components/EntityEditor'
import { Optional } from '../components/Optional'
import { NumberInput, SelectInput, TextInput } from '../components/fields'
import type { Client, Settings as SettingsT, TaxProfileId } from '../domain/types'
import { CLIENT_COUNTRY, PROFILE, SOURCE_TYPE, VENUE_TYPE, options } from '../domain/vocabulary'
import { clientStats } from '../lib/analytics'
import { shortDate } from '../lib/dates'
import { lei } from '../lib/money'
import { BackupError, download, makeBackup, readBackup, recordsCsv } from '../store/backup'
import { NotionRepo } from '../store/notion'
import type { Entity, EntityKind } from '../store/repo'
import { RULESETS } from '../tax/rules'
import styles from '../styles/ui.module.css'

export const STARTER_TEMPLATE_HINT = 'Duplicate the “InFlow — Starter Template” page in Notion, share it with your integration, and paste the link of its Income database.'

export function Settings() {
  const { settings, updateSettings, data, toast, today, clearDemo, loadDemo, restore, copyDeviceToNotion, deviceHasOwnData, reload } = useInflow()
  const [token, setToken] = useState(settings.notionToken)
  const [dbLink, setDbLink] = useState(settings.incomeDbId)
  const [testing, setTesting] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'clear' | 'restore' | 'copy'>(null)
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
  const demoPresent = hasDemo(data)

  return (
    <div className={styles.settingsList}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><h2 className={styles.panelTitle}>Where your data lives</h2>
          <span className={styles.panelSub}>{settings.mode === 'notion' && settings.notionToken ? 'Notion' : 'This device'}</span></div>
        <div className={styles.settingsGroup}>
          <SegmentedControl label="Data mode" value={settings.mode} onChange={(v) => (v === 'device' ? switchToDevice() : updateSettings({ mode: 'notion' }))}
            options={[{ value: 'device', label: 'This device' }, { value: 'notion', label: 'Notion' }]} />
          {settings.mode === 'device' ? (
            <p className={styles.hint}>Everything is stored in this browser (IndexedDB) and works offline. Back it up below, or connect Notion to keep it there and use it on any device.</p>
          ) : (
            <>
              <p className={styles.hint}>{STARTER_TEMPLATE_HINT} The token stays on this device and goes only to this site's Notion relay.</p>
              <TextInput label="Notion integration token" type="password" value={token} onChange={setToken} placeholder="ntn_…" />
              <TextInput label="Income database (link or ID)" value={dbLink} onChange={setDbLink} placeholder="https://www.notion.so/…"
                hint="The other three databases are found through its Client, Source and Venue relations." />
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
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><h2 className={styles.panelTitle}>Demo data</h2>
          <span className={styles.panelSub}>{demoPresent ? 'showing' : 'none'}</span></div>
        <p className={styles.hint}>Fourteen months of a coaching practice: private clients, group workshops, corporate work in lei and euro, platform payouts in dollars, retreats, royalties with tax withheld, and the costs behind them (room hire, co-facilitators, software, the accountant). Demo rows stay on this device and are never sent to Notion.</p>
        <div className={styles.buttonRow} style={{ marginTop: 'var(--space-sm)' }}>
          <Button variant="danger" disabled={!demoPresent} onClick={() => setConfirm('clear')}>Clear demo data</Button>
          <Button variant="secondary" onClick={() => void loadDemo()}>Load demo data</Button>
        </div>
        {settings.mode === 'notion' && settings.notionToken && <p className={styles.hint} style={{ marginTop: 'var(--space-xs)' }}>You're viewing Notion; switch to “This device” to see the demo.</p>}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><h2 className={styles.panelTitle}>Costs, P&L and cash flow <Optional /></h2></div>
        <div className={styles.settingsGroup}>
          <SettingsToggle label="Track costs" checked={settings.trackCosts} onChange={(e) => updateSettings({ trackCosts: e.target.checked })}
            hint="Adds Costs, the P&L, cash flow, margins per venue, client and activity, and a break-even. Off: InFlow is income only." />
          {settings.trackCosts && (
            <div className={styles.formRow}>
              <NumberInput label="Cash on hand (lei)" value={settings.openingCash} onCommit={(n) => updateSettings({ openingCash: n ?? 0 })}
                hint="Bank and cash together, on the date beside it. Cash flow counts from here." />
              <TextInput label="On" type="date" value={settings.openingCashDate} onChange={(v) => updateSettings({ openingCashDate: v })} />
            </div>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><h2 className={styles.panelTitle}>Tax <Optional /></h2></div>
        <div className={styles.settingsGroup}>
          <SettingsToggle label="Track tax" checked={settings.trackTax} onChange={(e) => updateSettings({ trackTax: e.target.checked })}
            hint="Taxability, withheld tax and what to set aside. Off: InFlow shows only the money flow, and nothing asks about tax." />
          {settings.trackTax && <>
          <SelectInput label="How you invoice" value={tax.id} onChange={(v) => setTax({ id: v as TaxProfileId })}>
            {options(PROFILE).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectInput>
          {(tax.id === 'pfa_real' || tax.id === 'srl_micro') && settings.trackCosts && (
            <SettingsToggle label="Read expenses from my costs" checked={tax.expensesFromCosts} onChange={(e) => setTax({ expensesFromCosts: e.target.checked })}
              hint="Uses the costs you've recorded as deductible, annualised like your income, instead of a figure typed here." />
          )}
          {tax.id === 'pfa_real' && !(settings.trackCosts && tax.expensesFromCosts) && (
            <NumberInput label="Deductible expenses this year (lei)" value={tax.annualExpenses}
              onCommit={(n) => setTax({ annualExpenses: n ?? 0 })} hint="Rent, equipment, training, accounting. Subtracted before CAS, CASS and income tax." />
          )}
          {tax.id === 'pfa_norma' && (
            <NumberInput label="Annual income norm (lei)" value={tax.annualNorm}
              onCommit={(n) => setTax({ annualNorm: n ?? 0 })} hint="From your county's norm for your CAEN code, after any reductions. Tax follows this, not what you earn." />
          )}
          {tax.id === 'srl_micro' && (
            <>
              {!(settings.trackCosts && tax.expensesFromCosts) && (
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
          </>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><h2 className={styles.panelTitle}>Targets</h2></div>
        <div className={styles.formRow}>
          <NumberInput label="Monthly income target (lei)" value={settings.monthlyTarget}
            placeholder="none" onCommit={(n) => updateSettings({ monthlyTarget: n ?? 0 })} />
          <NumberInput label="Flag payments above (× typical)" value={settings.largeMultiple}
            onCommit={(n) => { if (n && n >= 1.5) updateSettings({ largeMultiple: n }) }} hint="1.5 or more." />
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Clients, sources & venues</h2>
          <button type="button" className={styles.linkButton} onClick={() => setEditing({ kind: manage, entity: null })}>+ Add</button>
        </div>
        <SegmentedControl size="sm" label="List" value={manage} onChange={(v) => setManage(v as EntityKind)}
          options={[{ value: 'client', label: `Clients (${data.clients.length})` }, { value: 'source', label: `Sources (${data.sources.length})` }, { value: 'venue', label: `Venues (${data.venues.length})` }]} />
        <div className={styles.rows} style={{ marginTop: 'var(--space-sm)' }}>
          {sorted.length === 0 && <p className={styles.hint}>None yet.</p>}
          {sorted.map((e) => {
            const st = manage === 'client' ? stats.get(e.id) : undefined
            const sub = manage === 'client'
              ? `${CLIENT_COUNTRY[(e as Client).country]} · ${st ? `${lei(st.total)} · last paid ${shortDate(st.last!, Number(today.slice(0, 4)))}` : 'no payments yet'}`
              : manage === 'source' ? `${SOURCE_TYPE[(e as { type: keyof typeof SOURCE_TYPE }).type]}${(e as { active: boolean }).active ? '' : ' · inactive'}`
                : `${VENUE_TYPE[(e as { type: keyof typeof VENUE_TYPE }).type]}${(e as { location: string }).location ? ` · ${(e as { location: string }).location}` : ''}`
            return (
              <button key={e.id} type="button" className={styles.row} onClick={() => setEditing({ kind: manage, entity: e })}>
                <span className={styles.rowName}>{e.name}{e.demo ? <span className={styles.panelSub}> · demo</span> : null}</span>
                <span className={styles.rowValue}>{manage === 'client' && st ? `${st.count}×` : ''}</span>
                <span className={styles.rowMeta}>{sub}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><h2 className={styles.panelTitle}>Backup & export</h2></div>
        <p className={styles.hint}>A backup holds every payment, client, source and venue and your settings — never your Notion token. Restoring puts it on this device.</p>
        <div className={styles.buttonRow} style={{ marginTop: 'var(--space-sm)' }}>
          <Button variant="secondary" onClick={() => download(`inflow-backup-${today}.json`, JSON.stringify(makeBackup(data, settings), null, 2), 'application/json')}>Download backup</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>Restore…</Button>
          <Button variant="secondary" onClick={() => download(`inflow-income-${today}.csv`, recordsCsv(data.records, data), 'text/csv')}>All payments as CSV</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><h2 className={styles.panelTitle}>Appearance & guide</h2></div>
        <div className={styles.settingsGroup}>
        <SegmentedControl label="Theme" value={settings.theme} onChange={(v) => updateSettings({ theme: v as SettingsT['theme'] })}
          options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <SettingsToggle label="Welcome guide on opening" hint="The short tour of InFlow." checked={settings.showTour} onChange={(e) => updateSettings({ showTour: e.target.checked })} />
        <div><Button variant="secondary" onClick={() => window.dispatchEvent(new Event('inflow:tour'))}>Show the guide now</Button></div>
        </div>
      </section>

      <p className={styles.hint} style={{ textAlign: 'center' }}>
        InFlow suggests tax treatments and reserves from published Romanian rules ({RULESETS.at(-1)!.id}). They are estimates to plan with, not tax advice.
      </p>

      <ConfirmModal isOpen={confirm === 'clear'} title="Clear demo data?" variant="danger" confirmText="Clear"
        message="Removes every demo payment, client, source and venue from this device. Anything you entered yourself stays."
        onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); void clearDemo() }} />
      <ConfirmModal isOpen={confirm === 'restore'} title="Restore this backup?" confirmText="Restore"
        message={pendingBackup ? `Replaces what's on this device with ${pendingBackup.data.records.length} payments from ${pendingBackup.exportedAt.slice(0, 10)}, and switches to device mode.` : ''}
        onCancel={() => { setConfirm(null); setPendingBackup(null) }} onConfirm={() => { setConfirm(null); if (pendingBackup) void restore(pendingBackup); setPendingBackup(null) }} />
      <ConfirmModal isOpen={confirm === 'copy'} title="Copy device payments to Notion?" confirmText="Copy"
        message="Creates your own payments, and the clients, sources and venues they use, in Notion. Demo rows are left behind. Run it once; a second run makes duplicates."
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

