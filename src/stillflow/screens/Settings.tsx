import { useMemo, useState } from 'react'
import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { Button, ConfirmModal, Field, SegmentedControl } from '../../ds'
import { hrefOf, navigate } from '../app/router'
import { useStillflow } from '../app/state'
import { usePlatform } from '../components/StartPractice'
import { ChipGroup, Wordmark } from '../components/ui'
import { STYLES } from '../domain/vocabulary'
import { downloadText, stamp } from '../lib/download'
import { fold } from '../lib/filter'
import { exportCsv, exportJson } from '../lib/importExport'
import { androidIntentUrl, canonicalUrl, parseVideoId } from '../lib/youtube'
import { isBackup } from '../store/repo'
import { ImportPanel } from './ImportPanel'
import s from './screens.module.css'

function PlaybackTest() {
  const [url, setUrl] = useState('')
  const platform = usePlatform()
  const id = parseVideoId(url)
  return (
    <div className={s.stack}>
      <Field label="Paste any YouTube link to test hand-off on this device" value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="https://youtu.be/…" error={url && !id ? 'Not a YouTube video link' : undefined} />
      {id && (
        <div className={s.testLinks}>
          <span className={s.muted}>Detected platform: {platform}. Try each and note which opens the YouTube app:</span>
          <a href={canonicalUrl(id)} target="_blank" rel="noopener noreferrer">1 · Plain https link</a>
          <a href={androidIntentUrl(canonicalUrl(id))}>2 · Android intent (YouTube app, browser fallback)</a>
          <a href={`https://youtu.be/${id}`} target="_blank" rel="noopener noreferrer">3 · Short youtu.be link</a>
        </div>
      )}
    </div>
  )
}

export function Settings() {
  const state = useStillflow()
  const { sessions, preferences, savePreferences, deleteSessions, exportBackup, restore, resetAll, toast } = state
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState<null | 'demo' | 'reset' | { kind: 'delete'; id: string; title: string } | { kind: 'restore'; file: File }>(null)
  const demos = sessions.filter((x) => x.isDemo)
  const list = useMemo(() => {
    const t = fold(q.trim())
    return [...sessions].filter((x) => !t || fold(x.title).includes(t)).sort((a, b) => a.title.localeCompare(b.title))
  }, [sessions, q])
  const num = (v: string) => (v.trim() === '' ? undefined : Math.max(1, Math.round(Number(v))))

  const doRestore = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!isBackup(data)) { toast('That file is not a Stillflow backup.', 'danger'); return }
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
        <p className={s.kicker}>Settings</p>
        <h1 className={s.pageTitle}>Make it yours</h1>
      </header>

      <section className={s.panel}>
        <h2>Preferences</h2>
        <ChipGroup label="Styles you enjoy" options={STYLES} selected={preferences.preferredStyles}
          onChange={(v) => savePreferences({ ...preferences, preferredStyles: v })} />
        <div className={s.twoCol}>
          <Field label="Usual maximum length (min)" type="number" inputMode="numeric" min={1} value={preferences.preferredMaxDuration ?? ''}
            onChange={(e) => savePreferences({ ...preferences, preferredMaxDuration: num(e.target.value) })} hint="Guides Perfect Match and Surprise Me" />
          <Field label="Weekly target (min)" type="number" inputMode="numeric" min={1} value={preferences.weeklyTargetMinutes ?? ''}
            onChange={(e) => savePreferences({ ...preferences, weeklyTargetMinutes: num(e.target.value) })} hint="Shown on Discover" />
        </div>
        <div style={{ marginTop: 'var(--space-md)' }}>
          <Field label="Default instructor for new sessions" value={preferences.defaultInstructor}
            onChange={(e) => savePreferences({ ...preferences, defaultInstructor: e.target.value })} />
        </div>
      </section>

      <section className={s.panel}>
        <h2>Opening videos</h2>
        <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>
          On Android, “Hand to the YouTube app” asks Chrome to open the video in the YouTube app and falls back to the browser if it can’t.
          “Plain link” lets the phone decide. Other devices always use the plain link.
        </p>
        <SegmentedControl label="On Android" value={preferences.openMethod} wrap
          onChange={(v) => savePreferences({ ...preferences, openMethod: v as typeof preferences.openMethod })}
          options={[{ value: 'auto', label: 'Hand to the YouTube app' }, { value: 'link', label: 'Plain link' }]} />
        <div style={{ marginTop: 'var(--space-lg)' }}><PlaybackTest /></div>
      </section>

      <section className={s.panel}>
        <div className={s.spread}>
          <h2>Catalogue</h2>
          <span className={s.muted}>{sessions.length} sessions{demos.length ? `, ${demos.length} demo` : ''}</span>
        </div>
        <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>
          Build the library gradually: paste links one at a time, or keep a spreadsheet and import it as CSV. Lists go in one cell,
          separated by “|”. Re-importing the same file is safe: duplicates are matched by YouTube video id.
        </p>
        <div className={s.row}>
          <Button onClick={() => navigate({ name: 'editor' })}><Plus size={16} /> Add a session</Button>
          <ImportPanel />
          <Button variant="ghost" onClick={() => downloadText(`stillflow-catalogue-${stamp()}.json`, exportJson(sessions), 'application/json')}><Download size={16} /> JSON</Button>
          <Button variant="ghost" onClick={() => downloadText(`stillflow-catalogue-${stamp()}.csv`, exportCsv(sessions), 'text/csv')}><Download size={16} /> CSV</Button>
        </div>
        {demos.length > 0 && (
          <p className={s.demoNote} style={{ marginTop: 'var(--space-md)' }}>
            {demos.length} demonstration records are in your library.{' '}
            <button type="button" className={s.textLink} onClick={() => setConfirm('demo')}>Remove them</button>
          </p>
        )}
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <Field label="Find a session to edit" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title" />
          <div className={s.catalogueList}>
            {list.map((x) => (
              <div key={x.id} className={s.catRow}>
                <a className={s.entryTitle} href={hrefOf({ name: 'editor', id: x.id })}>{x.title}</a>
                <button type="button" className={s.iconBtn} aria-label={`Delete ${x.title}`} onClick={() => setConfirm({ kind: 'delete', id: x.id, title: x.title })}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.panel}>
        <h2>Backup</h2>
        <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>
          Everything lives on this device only. A backup holds the catalogue, favourites, ratings, practice history, collections and preferences.
        </p>
        <div className={s.row}>
          <Button variant="outline" onClick={async () => downloadText(`stillflow-backup-${stamp()}.json`, JSON.stringify(await exportBackup(), null, 2), 'application/json')}>
            <Download size={16} /> Save a backup
          </Button>
          <label className={s.fileButton}>
            <Button variant="ghost" tabIndex={-1}><Upload size={16} /> Restore from backup</Button>
            <input type="file" accept=".json,application/json" aria-label="Restore from a Stillflow backup file"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setConfirm({ kind: 'restore', file: f }) }} />
          </label>
        </div>
      </section>

      <section className={s.panel}>
        <h2>Reset</h2>
        <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>Erase every Stillflow record on this device. Save a backup first if you might want it back.</p>
        <Button variant="danger" onClick={() => setConfirm('reset')}>Erase local data</Button>
      </section>

      <footer className={s.stack} style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
        <Wordmark size="sm" />
        <p className={s.muted}>Find your practice. A personal yoga companion.</p>
        <p className={s.muted}>
          Stillflow is an independent personal tool for organising publicly available videos. It is not affiliated with or endorsed by
          Yoga With Adriene or YouTube; videos play on YouTube.
        </p>
      </footer>

      <ConfirmModal isOpen={confirm === 'demo'} title="Remove the demo records?" message={`${demos.length} demonstration sessions will be deleted. Your own sessions stay.`}
        confirmText="Remove" variant="danger" onCancel={() => setConfirm(null)}
        onConfirm={async () => { await deleteSessions(demos.map((x) => x.id)); setConfirm(null); toast('Demo records removed', 'success') }} />
      <ConfirmModal isOpen={confirm === 'reset'} title="Erase everything?" message="The catalogue, history, favourites, collections and preferences on this device will be deleted."
        confirmText="Erase" variant="danger" onCancel={() => setConfirm(null)}
        onConfirm={async () => { await resetAll(); setConfirm(null); toast('Local data erased') }} />
      <ConfirmModal isOpen={!!confirm && typeof confirm === 'object' && confirm.kind === 'delete'} title="Delete this session?"
        message={confirm && typeof confirm === 'object' && confirm.kind === 'delete' ? `“${confirm.title}” leaves the catalogue. Your history for it is kept.` : ''}
        confirmText="Delete" variant="danger" onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm && typeof confirm === 'object' && confirm.kind === 'delete') await deleteSessions([confirm.id]); setConfirm(null) }} />
      <ConfirmModal isOpen={!!confirm && typeof confirm === 'object' && confirm.kind === 'restore'} title="Restore this backup?"
        message="Everything currently on this device is replaced by the backup's contents." confirmText="Restore" variant="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm && typeof confirm === 'object' && confirm.kind === 'restore') await doRestore(confirm.file); setConfirm(null) }} />
    </div>
  )
}
