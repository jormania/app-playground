import { useMemo, useState } from 'react'
import { Download, Plus, Trash2, Upload, FileSpreadsheet, ShieldCheck, Eye } from 'lucide-react'
import { Button, ConfirmModal, Field, SegmentedControl, SettingsToggle } from '../../ds'
import { hrefOf, navigate } from '../app/router'
import { useMatDays } from '../app/state'
import { usePlatform } from '../components/StartPractice'
import { ChipGroup, Wordmark } from '../components/ui'
import { INTENSITY_LABELS, OBJECTIVES, STYLES } from '../domain/vocabulary'
import { MODES } from '../lib/recommend'
import { downloadText, stamp } from '../lib/download'
import { fold } from '../lib/filter'
import { CSV_COLUMNS, exportCsv, exportJson } from '../lib/importExport'
import { toCsv } from '../lib/csv'
import { daysBetween } from '../lib/recommend'
import { localDate } from '../lib/practice'
import { androidIntentUrl, canonicalUrl, isPackageName, parseVideoId } from '../lib/youtube'
import { isBackup } from '../store/repo'
import { ImportPanel } from './ImportPanel'
import { ChannelSync } from './ChannelSync'
import { RELEASE } from '../app/release'
import { useSaveBackup } from '../app/backup'
import { backupNudge, shortTitle } from '../lib/today'
import s from './screens.module.css'

function PlaybackTest() {
  const [url, setUrl] = useState('')
  const platform = usePlatform()
  const id = parseVideoId(url)
  return (
    <div className={s.stack}>
      <Field label="Test it: paste any YouTube link" value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="https://youtu.be/…" error={url && !id ? 'Not a YouTube video link' : undefined} />
      {id && (
        <div className={s.testLinks}>
          <span className={s.muted}>This device: {platform === 'android' ? 'Android' : platform === 'ios' ? 'iPhone or iPad' : 'computer'}. Try each and see which one opens the YouTube app:</span>
          <a href={androidIntentUrl(canonicalUrl(id))}>Open in my YouTube app (Android)</a>
          <a href={canonicalUrl(id)} target="_blank" rel="noopener noreferrer">Open as an ordinary link</a>
          <a href={`https://youtu.be/${id}`} target="_blank" rel="noopener noreferrer">Open as a short youtu.be link</a>
        </div>
      )}
    </div>
  )
}

/** A starter spreadsheet: the columns Mat Days reads, with one illustrative row that is plainly not a real video. */
function csvTemplate(): string {
  const example: Record<string, string> = {
    title: 'Replace with the video title', youtubeUrl: 'https://www.youtube.com/watch?v=VIDEO_ID',
    durationMinutes: '22', styles: 'Hatha | Slow Flow', intensity: '2', physicalFocus: 'Hips | Lower back',
    objectives: 'Mobility', series: 'MOVE', seriesDay: '8', classificationConfidence: 'high', classificationSource: 'manual',
  }
  return toCsv([...CSV_COLUMNS], [CSV_COLUMNS.map((c) => example[c] ?? '')])
}

/** One setting per row: what it is and what it does on the left, a compact minutes box on the right. */
function MinutesRow({ label, hint, value, placeholder, onChange }: {
  label: string; hint: string; value?: number; placeholder: string; onChange: (v: number | undefined) => void
}) {
  return (
    <label className={s.settingRow}>
      <span className={s.settingText}>
        <span className={s.settingLabel}>{label}</span>
        <span className={s.settingHint}>{hint}</span>
      </span>
      <span className={s.minutesBox}>
        <input type="number" inputMode="numeric" min={1} max={600} className={s.settingInput} value={value ?? ''} placeholder={placeholder}
          aria-label={`${label} in minutes`}
          onChange={(e) => onChange(e.target.value.trim() === '' ? undefined : Math.max(1, Math.round(Number(e.target.value))))} />
        <span className={s.unit}>min</span>
      </span>
    </label>
  )
}

export function Settings() {
  const state = useMatDays()
  const { sessions, preferences, savePreferences, deleteSessions, restore, resetAll, toast, userData, setUserData, persisted, requestPersistence, history } = state
  const hidden = sessions.filter((x) => userData[x.id]?.excluded)
  const backupAge = preferences.lastBackupAt ? daysBetween(preferences.lastBackupAt.slice(0, 10), localDate()) : null
  // The same rule as Today's reminder, so the two never disagree.
  const backupDue = backupNudge(history, { lastBackupAt: preferences.lastBackupAt }, localDate()) != null
  const saveBackup = useSaveBackup()
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState<null | 'demo' | 'reset' | { kind: 'delete'; id: string; title: string } | { kind: 'restore'; file: File }>(null)
  const demos = sessions.filter((x) => x.isDemo)
  const list = useMemo(() => {
    const t = fold(q.trim())
    return [...sessions].filter((x) => !t || fold(x.title).includes(t)).sort((a, b) => a.title.localeCompare(b.title))
  }, [sessions, q])

  const doRestore = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!isBackup(data)) { toast('That file is not a Mat Days backup.', 'danger'); return }
      await restore(data)
      toast('Backup restored', 'success')
    } catch (e) {
      console.error(e)
      toast('The backup could not be read. Nothing was changed.', 'danger')
    }
  }

  return (
    <div className={s.settings}>
      <header className={s.pageHead} style={{ marginBottom: 0 }}>
        <h1 className={s.pageTitle}>Settings</h1>
      </header>

      <section className={s.panel}>
        <h2>Your practice</h2>
        <p className={s.sectionLede}>Today’s suggestions and Surprise Me’s Perfect match lean towards these. Leave any of them empty for no preference.</p>
        <ChipGroup label="Styles you enjoy" options={STYLES} selected={preferences.preferredStyles}
          onChange={(v) => savePreferences({ ...preferences, preferredStyles: v })} />
        <ChipGroup<number> label="Intensity you usually want" options={[1, 2, 3, 4, 5]} selected={preferences.preferredIntensities}
          render={(i) => INTENSITY_LABELS[i - 1]} onChange={(v) => savePreferences({ ...preferences, preferredIntensities: v })} />
        <ChipGroup label="Goals you practise for" options={OBJECTIVES} selected={preferences.favouriteGoals}
          onChange={(v) => savePreferences({ ...preferences, favouriteGoals: v })} />
        <div className={s.rows}>
          <MinutesRow label="Usual practice length" hint="Suggestions prefer sessions this long or shorter."
            value={preferences.preferredMaxDuration} placeholder="Any" onChange={(v) => savePreferences({ ...preferences, preferredMaxDuration: v })} />
          <MinutesRow label="Weekly goal" hint="Minutes a week, shown as a ring on Today and in My Practice."
            value={preferences.weeklyTargetMinutes} placeholder="None" onChange={(v) => savePreferences({ ...preferences, weeklyTargetMinutes: v })} />
        </div>
      </section>

      <section className={s.panel}>
        <h2>Surprise Me</h2>
        <div className={s.rows}>
          <label className={`${s.settingRow} ${s.settingStack}`}>
            <span className={s.settingText}>
              <span className={s.settingLabel}>Starts with</span>
              <span className={s.settingHint}>How Surprise Me chooses when you open it. You can always switch there.</span>
            </span>
            <select className={s.select} value={preferences.surpriseMode}
              onChange={(e) => savePreferences({ ...preferences, surpriseMode: e.target.value as typeof preferences.surpriseMode })}>
              {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <SettingsToggle label="Leave out practices for women’s particular needs" checked={preferences.skipWomenSpecific !== false}
            hint="Pregnancy, the cycle, menopause and the like are never suggested on Today, in Surprise Me or Practise for. They stay in Explore and search."
            onChange={(e) => savePreferences({ ...preferences, skipWomenSpecific: e.target.checked })} />
        </div>
      </section>

      <section className={s.panel}>
        <h2>Appearance and reminders</h2>
        <div className={s.rows}>
          <div className={`${s.settingRow} ${s.settingStack}`}>
            <span className={s.settingText}>
              <span className={s.settingLabel}>Theme</span>
              <span className={s.settingHint}>“Device” follows your phone’s light or dark mode.</span>
            </span>
            <SegmentedControl label="Theme" size="sm" value={preferences.theme}
              onChange={(v) => savePreferences({ ...preferences, theme: v as typeof preferences.theme })}
              options={[{ value: 'system', label: 'Device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          </div>
          <SettingsToggle label="Ask “Did you finish?” when I come back" checked={preferences.askOnReturn}
            hint="After you’ve been away on YouTube for a minute or more. Nothing is recorded unless you say yes."
            onChange={(e) => savePreferences({ ...preferences, askOnReturn: e.target.checked })} />
        </div>
      </section>

      <section className={s.panel}>
        <h2>Opening videos</h2>
        <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>
          On Android, Start opens the video in the app your phone uses for YouTube links, so a patched player such as Morphe or
          ReVanced keeps its settings. If nothing opens, it falls back to the browser. iPhones and computers always let the device decide.
        </p>
        <SegmentedControl label="On Android" value={preferences.openMethod} wrap
          onChange={(v) => savePreferences({ ...preferences, openMethod: v as typeof preferences.openMethod })}
          options={[{ value: 'auto', label: 'My YouTube app' }, { value: 'custom', label: 'A named app' }, { value: 'youtube', label: 'Official YouTube' }, { value: 'link', label: 'Plain link' }]} />
        <p className={s.settingHint} style={{ marginTop: 'var(--space-xs)' }}>
          {{
            auto: 'The app Android opens YouTube links with. Set it under Settings › Apps › your player › Open by default.',
            custom: 'Always this app, by its package name. Use it if My YouTube app still opens the official one.',
            youtube: 'Google’s YouTube app, even if another player handles YouTube links.',
            link: 'A plain web link: the phone or the browser decides.',
          }[preferences.openMethod]}
        </p>
        {preferences.openMethod === 'custom' && (
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <Field label="Package name" value={preferences.openPackage ?? ''} placeholder="e.g. app.revanced.android.youtube"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onChange={(e) => savePreferences({ ...preferences, openPackage: e.target.value.trim() })}
              hint="Android Settings › Apps › your player › App info shows it (often at the bottom, or under App details)." />
            {preferences.openPackage && !isPackageName(preferences.openPackage) && <p className={s.settingHint}>That doesn’t look like a package name (it reads like com.example.app).</p>}
          </div>
        )}
        <div style={{ marginTop: 'var(--space-lg)' }}><PlaybackTest /></div>
      </section>

      <ChannelSync />

      <section className={s.panel}>
        <div className={s.spread}>
          <h2>Library</h2>
          <span className={s.muted}>{sessions.length} sessions{demos.length ? `, ${demos.length} demo` : ''}</span>
        </div>
        <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>
          Build the library gradually: paste links one at a time, or keep a spreadsheet and import it as CSV. Lists go in one cell,
          separated by “|”. Re-importing the same file is safe: duplicates are matched by YouTube video id.
        </p>
        <div className={s.row}>
          <Button onClick={() => navigate({ name: 'editor' })}><Plus size={16} /> Add a session</Button>
          <ImportPanel />
          <Button variant="ghost" onClick={() => downloadText(`mat-days-library-${stamp()}.json`, exportJson(sessions), 'application/json')}><Download size={16} /> JSON</Button>
          <Button variant="ghost" onClick={() => downloadText(`mat-days-library-${stamp()}.csv`, exportCsv(sessions), 'text/csv')}><Download size={16} /> CSV</Button>
          <Button variant="ghost" onClick={() => downloadText('mat-days-template.csv', csvTemplate(), 'text/csv')}><FileSpreadsheet size={16} /> CSV template</Button>
        </div>
        {demos.length > 0 && (
          <p className={s.demoNote} style={{ marginTop: 'var(--space-md)' }}>
            {demos.length} demonstration records are in your library.{' '}
            <button type="button" className={s.textLink} onClick={() => setConfirm('demo')}>Remove demo records</button>
          </p>
        )}
        <div className={s.rows} style={{ marginTop: 'var(--space-md)' }}>
          <label className={`${s.settingRow} ${s.settingStack}`}>
            <span className={s.settingText}>
              <span className={s.settingLabel}>Instructor for new sessions</span>
              <span className={s.settingHint}>Used when you add a session or import one without an instructor.</span>
            </span>
            <input className={s.settingInput} value={preferences.defaultInstructor}
              onChange={(e) => savePreferences({ ...preferences, defaultInstructor: e.target.value })} />
          </label>
        </div>
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <Field label="Find a session to edit" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Part of a title"
            hint={q.trim() ? undefined : `Type to search all ${sessions.length} sessions.`} />
          {q.trim() && <div className={s.catalogueList}>
            {list.length === 0 && <p className={s.muted}>No session with that title.</p>}
            {list.slice(0, 100).map((x) => (
              <div key={x.id} className={s.catRow}>
                <a className={s.entryTitle} href={hrefOf({ name: 'editor', id: x.id })}>{x.title}</a>
                <button type="button" className={s.iconBtn} aria-label={`Delete ${x.title}`} onClick={() => setConfirm({ kind: 'delete', id: x.id, title: x.title })}><Trash2 size={15} /></button>
              </div>
            ))}
            {list.length > 100 && <p className={s.muted}>{list.length - 100} more; type more to narrow the list.</p>}
          </div>}
        </div>
      </section>

      {hidden.length > 0 && (
        <section className={s.panel}>
          <h2>Hidden from suggestions</h2>
          <p className={s.muted} style={{ marginBottom: 'var(--space-sm)' }}>Still in your library and Explore, but never proposed by Today or Surprise Me.</p>
          <div className={s.catalogueList}>
            {hidden.map((x) => (
              <div key={x.id} className={s.catRow}>
                <a className={s.entryTitle} href={hrefOf({ name: 'session', id: x.id })}>{shortTitle(x, state.seriesDefs).title}</a>
                <button type="button" className={s.textLink} onClick={() => setUserData({ ...userData[x.id], excluded: false })}><Eye size={14} style={{ verticalAlign: '-2px' }} /> Show again</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={s.panel}>
        <h2>Backup</h2>
        <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>
          Everything lives on this device only. On Android, Save a backup opens the share sheet so you can keep it in Drive. A backup holds your library, favourites, ratings, practice history, collections, series progress and preferences.
          {' '}{preferences.lastBackupAt ? `Last saved ${backupAge === 0 ? 'today' : `${backupAge} days ago`}.` : 'No backup saved yet.'}
        </p>
        {backupDue && <p className={s.demoNote} style={{ marginBottom: 'var(--space-md)' }}>It’s been a while. A fresh backup keeps your history safe if the phone is reset or the browser clears its data.</p>}
        <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>
          <ShieldCheck size={14} style={{ verticalAlign: '-2px' }} />{' '}
          {persisted === true ? 'This browser has agreed to keep Mat Days’s data even when space runs low.'
            : persisted === false ? <>The browser may clear Mat Days’s data if the device runs short of space. <button type="button" className={s.textLink} onClick={async () => toast((await requestPersistence()) ? 'Done: your data is protected' : 'The browser said no. Installing Mat Days to the home screen usually changes that.')}>Ask the browser to keep it</button></>
            : 'Storage protection is unknown in this browser.'}
        </p>
        <div className={s.row}>
          <Button variant="outline" onClick={() => void saveBackup()}>
            <Download size={16} /> Save a backup
          </Button>
          <label className={s.fileButton}>
            <Button variant="ghost" tabIndex={-1}><Upload size={16} /> Restore from backup</Button>
            <input type="file" accept=".json,application/json" aria-label="Restore from a Mat Days backup file"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setConfirm({ kind: 'restore', file: f }) }} />
          </label>
        </div>
      </section>

      <section className={s.panel}>
        <h2>Reset</h2>
        <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>Erase every Mat Days record on this device. Save a backup first if you might want it back.</p>
        <Button variant="danger" onClick={() => setConfirm('reset')}>Erase all data on this device</Button>
      </section>

      <footer className={s.stack} style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
        <Wordmark size="sm" />
        <p className={s.muted}>Find your practice. A personal yoga companion.</p>
        <p className={s.entryMeta}>Release {RELEASE.number} · {RELEASE.date}</p>
        <p className={s.muted}>
          Mat Days is an independent personal tool for organising publicly available videos. It is not affiliated with or endorsed by
          Yoga With Adriene or YouTube; videos play on YouTube.
        </p>
      </footer>

      <ConfirmModal isOpen={confirm === 'demo'} title="Remove the demo records?" message={`${demos.length} demonstration sessions will be deleted. Your own sessions stay.`}
        confirmText="Remove" variant="danger" onCancel={() => setConfirm(null)}
        onConfirm={async () => { await deleteSessions(demos.map((x) => x.id)); setConfirm(null); toast('Demo records removed', 'success') }} />
      <ConfirmModal isOpen={confirm === 'reset'} title="Erase everything?" message="Your library, history, favourites, collections, series progress and preferences on this device will be deleted."
        confirmText="Erase" variant="danger" onCancel={() => setConfirm(null)}
        onConfirm={async () => { await resetAll(); setConfirm(null); toast('Everything on this device was erased') }} />
      <ConfirmModal isOpen={!!confirm && typeof confirm === 'object' && confirm.kind === 'delete'} title="Delete this session?"
        message={confirm && typeof confirm === 'object' && confirm.kind === 'delete' ? `“${confirm.title}” leaves your library. Your history for it is kept.` : ''}
        confirmText="Delete" variant="danger" onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm && typeof confirm === 'object' && confirm.kind === 'delete') await deleteSessions([confirm.id]); setConfirm(null) }} />
      <ConfirmModal isOpen={!!confirm && typeof confirm === 'object' && confirm.kind === 'restore'} title="Restore this backup?"
        message="Everything currently on this device is replaced by the backup's contents." confirmText="Restore" variant="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm && typeof confirm === 'object' && confirm.kind === 'restore') await doRestore(confirm.file); setConfirm(null) }} />
    </div>
  )
}
