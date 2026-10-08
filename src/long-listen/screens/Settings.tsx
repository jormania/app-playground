import { useEffect, useRef, useState } from 'react'
import { Field, SegmentedControl, SettingsToggle } from '../../ds'
import { useLoad, useServices } from '../app/services'
import { beginSignIn, redirectUriFor } from '../spotify/auth'
import { isValidTimeZone } from '../domain/week'
import { DEFAULT_PREFERENCES, type ListenerPreferences } from '../domain/types'
import type { ThemeChoice } from '../app/settings'
import { GUIDE_URL, STARTER_TEMPLATE_URL } from '../app/links'
import { messageOf } from '../components/common'
import s from '../styles/editorial.module.css'

type Result = { ok: boolean; message: string } | null

function ResultLine({ r }: { r: Result }) {
  if (!r) return null
  return <p className={r.ok ? s.okLine : s.note} role="status">{r.message}</p>
}

/**
 * Settings, in the order a new listener needs them: the three connections
 * (each with a test that proves it), then how you listen, then reading comfort
 * and your data. Credentials are kept on this device, as in every app in the
 * playground; each field saves when you leave it.
 */
export function SettingsScreen() {
  const svc = useServices()
  const { settings, updateSettings, status, spotify, repo, bump, say } = svc
  return (
    <div>
      <p className={s.eyebrow}>Settings</p>
      <h1 className={s.titleSmall}>Settings</h1>
      <p className={s.quiet}>
        New here? <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">The user’s guide</a> walks through setting up, a section at a time.
      </p>

      <ClaudeSection />
      <SpotifySection />
      <NotionSection />
      <PreferencesSection />

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Your week</h2>
        <TimeZoneField />
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Reading</h2>
        <SegmentedControl
          label="Theme"
          value={settings.theme}
          onChange={(v) => updateSettings({ theme: v as ThemeChoice })}
          options={[{ value: 'system', label: 'Device' }, { value: 'light', label: 'Day' }, { value: 'dark', label: 'Night' }]}
        />
        <SegmentedControl
          label="Text size"
          value={settings.textSize}
          onChange={(v) => updateSettings({ textSize: v as 'standard' | 'large' })}
          options={[{ value: 'standard', label: 'Standard' }, { value: 'large', label: 'Larger' }]}
        />
      </section>

      <BackupSection repo={repo} bump={bump} say={say} />

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>About</h2>
        <p className={s.quiet}>
          The curator is Claude (Sonnet). Spotify {spotify.connected ? 'is' : 'isn’t'} connected; Notion {svc.notion ? `is written ${svc.notion.via === 'own-token' ? 'with your token' : 'with the server’s token'}` : 'isn’t connected'}.
        </p>
        {status?.prompts && <p className={s.mono}>{Object.values(status.prompts).join(' · ')}</p>}
      </section>

      {import.meta.env.DEV && (
        <section className={s.settingsGroup}>
          <h2 className={s.h2}>Development</h2>
          <label className={s.row}>
            <input type="checkbox" checked={settings.demo} onChange={(e) => updateSettings({ demo: e.target.checked })} />
            Use the demo curator (canned programmes, no Anthropic key)
          </label>
        </section>
      )}
    </div>
  )
}

/** A text field that commits when you leave it, so a half-pasted key is never sent. */
function CommitField(props: { label: string; value: string; onCommit: (v: string) => void; type?: string; hint?: string; placeholder?: string; autoComplete?: string }) {
  const [v, setV] = useState(props.value)
  useEffect(() => setV(props.value), [props.value])
  return (
    <Field
      label={props.label}
      type={props.type ?? 'text'}
      value={v}
      hint={props.hint}
      placeholder={props.placeholder}
      autoComplete={props.autoComplete ?? 'off'}
      spellCheck={false}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v.trim() !== props.value) props.onCommit(v.trim()) }}
    />
  )
}

function ClaudeSection() {
  const { settings, updateSettings, status, testCurator, refreshStatus } = useServices()
  const [result, setResult] = useState<Result>(null)
  const [testing, setTesting] = useState(false)

  async function test() {
    setTesting(true)
    setResult(null)
    try {
      const r = await testCurator()
      setResult({ ok: true, message: `Working — Claude answered${r.model && r.model !== 'demo' ? ` (${r.model})` : ''}. The curator is ready.` })
    } catch (e) {
      setResult({ ok: false, message: messageOf(e) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className={s.settingsGroup}>
      <h2 className={s.h2}>Claude, the curator</h2>
      <p className={s.quiet}>
        Paste an Anthropic API key (console.anthropic.com → API keys). It stays on this device and is sent only to this app’s own server,
        which asks Claude on your behalf — the browser never calls Anthropic directly. Each week costs a few cents.
      </p>
      <CommitField label="Anthropic API key" type="password" value={settings.anthropicKey} placeholder="sk-ant-…" onCommit={(v) => { updateSettings({ anthropicKey: v }); setResult(null) }} />
      <div className={s.row}>
        <button className={s.textButton} onClick={test} disabled={testing || (!settings.anthropicKey && !status?.curator && !settings.demo)}>{testing ? 'Testing…' : 'Test the key'}</button>
        {settings.anthropicKey && <button className={s.textButton} onClick={() => { updateSettings({ anthropicKey: '' }); setResult(null) }}>Remove</button>}
      </div>
      <ResultLine r={result} />
      {(status?.serverKey || settings.passphrase) && (
        <details>
          <summary className={s.textButton}>Or use the server’s key</summary>
          <p className={s.quiet}>This app’s server holds a key of its own. A passphrase unlocks it from this device; your own key, if set, is used first.</p>
          <CommitField label="Passphrase" type="password" value={settings.passphrase} autoComplete="current-password" onCommit={(v) => { updateSettings({ passphrase: v }); setTimeout(() => void refreshStatus(), 0) }} />
          <p className={s.faint}>{status?.curator ? 'Unlocked.' : settings.passphrase ? 'Not recognised.' : 'Locked.'}</p>
        </details>
      )}
    </section>
  )
}

function SpotifySection() {
  const { settings, updateSettings, spotify, syncSpotify, testSpotify, bump, say } = useServices()
  const [result, setResult] = useState<Result>(null)
  const [testing, setTesting] = useState(false)
  const needsReconnect = spotify.connected && !spotify.hasScope('playlist-modify-private')

  async function connect() {
    if (!settings.spotifyClientId.trim()) return setResult({ ok: false, message: 'Add your Spotify app’s Client ID first.' })
    window.location.assign(await beginSignIn(settings.spotifyClientId.trim(), redirectUriFor()))
  }

  async function test() {
    setTesting(true)
    setResult(null)
    try {
      const r = await testSpotify()
      const active = r.devices.find((d) => d.active)
      const devices = r.devices.length
        ? ` Devices: ${r.devices.map((d) => d.name).join(', ')}${active ? ` (playing on ${active.name})` : ''}.`
        : ' No device is open right now — open Spotify somewhere to use “Play on your device”.'
      setResult({ ok: true, message: `Signed in as ${r.name}.${devices}` })
    } catch (e) {
      setResult({ ok: false, message: messageOf(e) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className={s.settingsGroup}>
      <h2 className={s.h2}>Spotify</h2>
      <p className={s.quiet}>
        Spotify confirms each recording exactly — performers and all — notices what you’ve played, and can save each week as a private playlist.
        You sign in on Spotify’s own page; this app never sees your password. Playing on a device needs Premium.
      </p>
      <p className={s.quiet}>
        It needs a Spotify app of your own: at developer.spotify.com → Dashboard → Create app, add this redirect URI, tick “Web API”, and paste the Client ID below.
      </p>
      <p className={s.mono}>{redirectUriFor()}</p>
      <CommitField label="Spotify Client ID" value={settings.spotifyClientId} onCommit={(v) => updateSettings({ spotifyClientId: v })} />
      <div className={s.row}>
        {!spotify.connected || needsReconnect
          ? <button className={s.textButton} onClick={connect}>{needsReconnect ? 'Reconnect Spotify (adds playlists)' : 'Connect Spotify'}</button>
          : <>
              <button className={s.textButton} onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test Spotify'}</button>
              <button className={s.textButton} onClick={() => syncSpotify().then((n) => say(n ? 'Picked up recent listening.' : 'Nothing new from Spotify.')).catch((e) => say(messageOf(e), 'danger'))}>Check recent listening</button>
              <button className={s.textButton} onClick={() => { spotify.setTokens(null); setResult(null); bump() }}>Disconnect</button>
            </>}
      </div>
      <ResultLine r={result} />
    </section>
  )
}

function NotionSection() {
  const { settings, updateSettings, status, notion, testNotion, syncNotion, notionState } = useServices()
  const [result, setResult] = useState<Result>(null)
  const [testing, setTesting] = useState(false)

  async function test() {
    setTesting(true)
    setResult(null)
    try {
      setResult(await testNotion())
    } catch (e) {
      setResult({ ok: false, message: messageOf(e) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className={s.settingsGroup}>
      <h2 className={s.h2}>Notion</h2>
      <p className={s.quiet}>
        Your notebook in Notion: a journal of programmes, your listening threads, the works and recordings you’ve met, composers, and your taste in words.
        Duplicate the <a href={STARTER_TEMPLATE_URL} target="_blank" rel="noopener noreferrer">Starter Template</a> (or use any empty page),
        connect it to your integration (••• → Connections), then paste the integration token and the page’s link.
      </p>
      <CommitField label="Notion integration token" type="password" value={settings.notionToken} placeholder="ntn_…" onCommit={(v) => { updateSettings({ notionToken: v }); setResult(null) }} />
      <CommitField label="Notebook page" value={settings.notionPage} placeholder="https://www.notion.so/…" hint="The page that holds (or will hold) the notebook’s databases." onCommit={(v) => { updateSettings({ notionPage: v }); setResult(null) }} />
      <div className={s.row}>
        <button className={s.textButton} onClick={test} disabled={testing}>{testing ? 'Checking…' : 'Test Notion'}</button>
        {notion && <button className={s.textButton} onClick={() => void syncNotion()} disabled={notionState.syncing}>{notionState.syncing ? 'Updating…' : 'Update Notion now'}</button>}
      </div>
      <ResultLine r={result} />
      {notionState.error && <p className={s.note}>{notionState.error}</p>}
      {!settings.notionToken && status?.notion && <p className={s.faint}>Using the server’s Notion connection.</p>}
    </section>
  )
}

const PREF_OPTIONS = {
  timePerWeek: [{ value: 'short', label: 'About an hour' }, { value: 'standard', label: '2–3 hours' }, { value: 'generous', label: '4 hours +' }],
  adventure: [{ value: 'gentle', label: 'Gentle' }, { value: 'balanced', label: 'Balanced' }, { value: 'bold', label: 'Bold' }],
  depth: [{ value: 'concise', label: 'Concise' }, { value: 'standard', label: 'Standard' }, { value: 'deeper', label: 'Deeper' }],
  recordingEra: [{ value: 'any', label: 'Any' }, { value: 'historic-welcome', label: 'Historic' }, { value: 'modern-sound', label: 'Modern' }, { value: 'period-practice', label: 'Period' }],
  language: [{ value: 'en', label: 'English' }, { value: 'ro', label: 'Română' }],
}

const ERA_HINT: Record<ListenerPreferences['recordingEra'], string> = {
  any: 'The curator chooses freely, from any decade.',
  'historic-welcome': 'Great older recordings welcome, mono included.',
  'modern-sound': 'Mostly recordings from about 1980 on, with modern sound.',
  'period-practice': 'Historically informed performances, where they exist.',
}

function PreferencesSection() {
  const { repo, bump } = useServices()
  const { data } = useLoad(() => repo.preferences(), [])
  const p = data ?? DEFAULT_PREFERENCES
  async function set<K extends keyof ListenerPreferences>(k: K, v: ListenerPreferences[K]) {
    await repo.savePreferences({ ...(await repo.preferences()), [k]: v })
    bump()
  }
  return (
    <section className={s.settingsGroup}>
      <h2 className={s.h2}>How you listen</h2>
      <p className={s.quiet}>Told to the curator directly — it weighs these above anything it has inferred. Changes shape the next programme, never one already made.</p>
      <SegmentedControl label="Time most weeks" value={p.timePerWeek} onChange={(v) => void set('timePerWeek', v as ListenerPreferences['timePerWeek'])} options={PREF_OPTIONS.timePerWeek} />
      <SegmentedControl label="How far from familiar ground" value={p.adventure} onChange={(v) => void set('adventure', v as ListenerPreferences['adventure'])} options={PREF_OPTIONS.adventure} />
      <SegmentedControl label="How much the curator writes" value={p.depth} onChange={(v) => void set('depth', v as ListenerPreferences['depth'])} options={PREF_OPTIONS.depth} />
      <SegmentedControl label="Recordings" value={p.recordingEra} onChange={(v) => void set('recordingEra', v as ListenerPreferences['recordingEra'])} options={PREF_OPTIONS.recordingEra} />
      <p className={s.faint} style={{ marginTop: 'var(--space-2xs)' }}>{ERA_HINT[p.recordingEra]}</p>
      <SettingsToggle label="Works with voices" hint="Choral symphonies, orchestral songs" checked={p.includeVoices} onChange={(e) => void set('includeVoices', e.target.checked)} />
      <SettingsToggle label="Concertos" hint="Orchestra with a soloist" checked={p.includeConcertos} onChange={(e) => void set('includeConcertos', e.target.checked)} />
      <SegmentedControl label="The curator writes in" value={p.language} onChange={(v) => void set('language', v as ListenerPreferences['language'])} options={PREF_OPTIONS.language} />
    </section>
  )
}

function TimeZoneField() {
  const { settings, updateSettings } = useServices()
  const [zone, setZone] = useState(settings.timeZone)
  return (
    <>
      <p className={s.quiet}>A new week begins on Monday at midnight in this time zone, wherever you or the server happen to be.</p>
      <Field label="Time zone" value={zone} onChange={(e) => setZone(e.target.value)} error={zone && !isValidTimeZone(zone) ? 'Not a time zone this browser knows.' : undefined} hint="For example Europe/Bucharest" />
      <button className={s.textButton} disabled={!isValidTimeZone(zone) || zone === settings.timeZone} onClick={() => updateSettings({ timeZone: zone })}>Use this time zone</button>
    </>
  )
}

function BackupSection({ repo, bump, say }: Pick<ReturnType<typeof useServices>, 'repo' | 'bump' | 'say'>) {
  const fileRef = useRef<HTMLInputElement>(null)

  async function exportBackup() {
    const data = await repo.exportAll()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `the-long-listen-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importBackup(file: File) {
    try {
      const n = await repo.importAll(JSON.parse(await file.text()))
      bump()
      say(`Restored ${n} records.`, 'success')
    } catch (e) {
      say(e instanceof Error ? e.message : 'That file couldn’t be read.', 'danger')
    }
  }

  return (
    <section className={s.settingsGroup}>
      <h2 className={s.h2}>Your journey, in a file</h2>
      <p className={s.quiet}>Everything lives on this device. Keep a copy now and then — it restores in any browser. Your keys are not in it.</p>
      <div className={s.row}>
        <button className={s.textButton} onClick={exportBackup}>Save a backup</button>
        <button className={s.textButton} onClick={() => fileRef.current?.click()}>Restore from a backup</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBackup(f); e.target.value = '' }} />
      </div>
    </section>
  )
}
