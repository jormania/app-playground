import { useEffect, useRef, useState } from 'react'
import { ConfirmModal, Field, SegmentedControl, SettingsToggle } from '../../ds'
import { useLoad, useServices } from '../app/services'
import { beginSignIn, redirectUriFor, renewBy } from '../spotify/auth'
import { isValidTimeZone } from '../domain/week'
import { DEFAULT_PREFERENCES, type ListenerPreferences } from '../domain/types'
import type { ThemeChoice } from '../app/settings'
import { GUIDE_URL, STARTER_TEMPLATE_URL } from '../app/links'
import { messageOf } from '../components/common'
import { LevelScale } from '../components/LevelScale'
import { BREADTH, FAMILIARITY, TIME } from '../domain/exploration'
import { archiveNotebook } from '../notion/mirror'
import { go } from '../app/router'
import { usageSummary } from '../app/usage'
import { RELEASE } from '../app/release'
import s from '../styles/editorial.module.css'

type Result = { ok: boolean; message: string } | null

function ResultLine({ r }: { r: Result }) {
  if (!r) return null
  return <p className={r.ok ? s.okLine : s.note} role="status">{r.message}</p>
}

/**
 * Settings in three parts. First the music: how a week of listening should
 * feel — its length, how widely it ranges, how well known the music is,
 * whether one work is ever heard twice side by side — then what goes into it
 * and how the curator writes. Then the connections, each with a test. Then
 * the app itself: the week's time zone, reading comfort, your data (backup,
 * restore, a fresh start) and what's running.
 */
export function SettingsScreen() {
  const svc = useServices()
  const { settings, updateSettings, prompts, spotify, repo, bump, say } = svc
  return (
    <div>
      <p className={s.eyebrow}>Settings</p>
      <h1 className={s.titleSmall}>Settings</h1>
      <p className={s.quiet}>
        New here? <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">The user’s guide</a> walks through setting up, a section at a time.
      </p>

      <h2 className={s.settingsPart}>Music and exploration</h2>
      <ExplorationSections />

      <h2 className={s.settingsPart}>Connections</h2>
      <ClaudeSection />
      <SpotifySection />
      <NotionSection />

      <h2 className={s.settingsPart}>The app</h2>
      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Your week</h2>
        <TimeZoneField />
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Reading</h2>
        <SegmentedControl
          size="sm" className={s.compactTrack}
          label="Theme"
          value={settings.theme}
          onChange={(v) => updateSettings({ theme: v as ThemeChoice })}
          options={[{ value: 'system', label: 'Device' }, { value: 'light', label: 'Day' }, { value: 'dark', label: 'Night' }]}
        />
        <SegmentedControl
          size="sm" className={s.compactTrack}
          label="Text size"
          value={settings.textSize}
          onChange={(v) => updateSettings({ textSize: v as 'standard' | 'large' })}
          options={[{ value: 'standard', label: 'Standard' }, { value: 'large', label: 'Larger' }]}
        />
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Listening</h2>
        <label className={s.row}>
          <input type="checkbox" checked={settings.hideSkipped} onChange={(e) => updateSettings({ hideSkipped: e.target.checked })} />
          Hide what I skip, everywhere
        </label>
        <p className={s.note}>A skipped work disappears from the programme, the running order, the Journal, the Library and the week’s playlist. It isn’t deleted: the curator still knows you passed on it, and a programme can show its skipped works again for a moment.</p>
      </section>

      <BackupSection repo={repo} bump={bump} say={say} />
      <FreshStartSection />

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>About</h2>

        <p className={s.label}>The curator is Claude</p>
        <ul className={`${s.bullets} ${s.quiet}`}>
          <li><strong>Sonnet</strong> chooses the week’s three directions and writes the programmes and second perspectives.</li>
          <li><strong>Haiku</strong>, at a twentieth of the price, does the reading around them: your feedback into taste, each thread’s week summed up, <em>A little more context</em>, and further reading.</li>
        </ul>

        <p className={s.label}>Connections</p>
        <ul className={`${s.bullets} ${s.quiet}`}>
          <li>Spotify: {spotify.connected ? 'connected' : 'not connected'}</li>
          <li>Notion: {svc.notion ? 'connected' : 'not connected'}</li>
        </ul>

        <p className={s.label}>This month, on this device</p>
        <SpendLine />

        <p className={s.faint} style={{ marginTop: 'var(--space-md)' }}>{RELEASE.name} · {RELEASE.date}</p>
        <p className={s.mono}>{Object.values(prompts).join(' · ')}</p>
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

/** What Claude has cost on this device this month, from Anthropic's own usage figures. */
function SpendLine() {
  const { version } = useServices()
  const [m, setM] = useState(() => usageSummary())
  useEffect(() => setM(usageSummary()), [version])
  if (m.requests === 0) return <p className={s.quiet}>Nothing spent on Claude yet.</p>
  const usd = (n: number) => (n < 0.01 ? 'under a cent' : `about $${n.toFixed(2)}`)
  const name = (model: string) => model.replace('claude-', '').replace(/-(\d+)-(\d+)$/, ' $1.$2').replace(/^./, (c) => c.toUpperCase())
  return (
    <>
      <ul className={`${s.bullets} ${s.quiet}`}>
        <li>Claude: {usd(m.dollars)}, over {m.requests} request{m.requests === 1 ? '' : 's'}</li>
        {m.byModel.length > 1 && m.byModel.map((b) => (
          <li key={b.model}>{name(b.model)}: {b.dollars === null ? 'no price on record' : usd(b.dollars)}</li>
        ))}
      </ul>
      <p className={s.quiet}>An estimate at list prices. The Anthropic Console has the bill.</p>
    </>
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
  const { settings, updateSettings, testCurator } = useServices()
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
        Paste an Anthropic API key (console.anthropic.com → API keys). It stays on this device, like in the other apps here,
        and goes only to Anthropic, with each request to Claude. Each week costs a few cents. Best practice: a key made just for
        this app, in a workspace with a small monthly spend limit — then a lost phone or a leak costs little, and the key can be
        deleted in the console without touching anything else.
      </p>
      <CommitField label="Anthropic API key" type="password" value={settings.anthropicKey} placeholder="sk-ant-…" onCommit={(v) => { updateSettings({ anthropicKey: v }); setResult(null) }} />
      <div className={s.row}>
        <button className={s.textButton} onClick={test} disabled={testing || (!settings.anthropicKey && !settings.demo)}>{testing ? 'Testing…' : 'Test the key'}</button>
        {settings.anthropicKey && <button className={s.textButton} onClick={() => { updateSettings({ anthropicKey: '' }); setResult(null) }}>Remove</button>}
      </div>
      <ResultLine r={result} />
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
        : ' No device is open right now — open Spotify somewhere before pressing Play.'
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
      {spotify.connected && renewalNote(renewBy(spotify.currentTokens))}
      <ResultLine r={result} />
    </section>
  )
}

/** Spotify sign-ins last six months; say when this one needs renewing, quietly, and louder near the end. */
function renewalNote(at: number | undefined) {
  if (!at) return null
  const date = new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  const soon = at - Date.now() < 14 * 24 * 3600_000
  return (
    <p className={soon ? s.note : s.faint}>
      {soon ? `Spotify will ask you to sign in again around ${date} — its sign-ins last six months. Disconnect and connect again any time before then.` : `Spotify sign-ins last six months; this one runs until about ${date}.`}
    </p>
  )
}

function NotionSection() {
  const { settings, updateSettings, notion, testNotion, syncNotion, notionState } = useServices()
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
    </section>
  )
}

const PREF_OPTIONS = {
  timePerWeek: (Object.keys(TIME) as ListenerPreferences['timePerWeek'][]).map((value) => ({ value, label: TIME[value].label })),
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

/** What a week of listening should be like — told to the curator directly. */
function ExplorationSections() {
  const { repo, bump } = useServices()
  const { data } = useLoad(() => repo.preferences(), [])
  const p = data ?? DEFAULT_PREFERENCES
  async function set<K extends keyof ListenerPreferences>(k: K, v: ListenerPreferences[K]) {
    await repo.savePreferences({ ...(await repo.preferences()), [k]: v })
    bump()
  }
  const [least, most] = TIME[p.timePerWeek].works
  return (
    <>
      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Your week of listening</h2>
        <p className={s.quiet}>The curator weighs these above anything it has inferred. A change shapes the next directions and programmes, never one already made — so set them before you choose a week, or ask for three others after.</p>
        <SegmentedControl size="sm" className={s.compactTrack} label="Music each week" value={p.timePerWeek} onChange={(v) => void set('timePerWeek', v as ListenerPreferences['timePerWeek'])} options={PREF_OPTIONS.timePerWeek} />
        <p className={s.faint} style={{ marginTop: 'var(--space-2xs)' }}>{TIME[p.timePerWeek].words[0].toUpperCase()}{TIME[p.timePerWeek].words.slice(1)}: about {least}–{most} works, in two to four sections.</p>
        <LevelScale
          label="How widely a week ranges"
          value={p.breadth}
          onChange={(v) => void set('breadth', v)}
          low="One focus"
          high="Across centuries"
          names={BREADTH}
          describe={(v) => `${BREADTH[v].words[0].toUpperCase()}${BREADTH[v].words.slice(1)}.`}
        />
        <LevelScale
          label="How well known the music is"
          value={p.familiarity}
          onChange={(v) => void set('familiarity', v)}
          low="Cornerstones"
          high="Rare & avant-garde"
          names={FAMILIARITY}
          describe={(v) => `${FAMILIARITY[v].words[0].toUpperCase()}${FAMILIARITY[v].words.slice(1)}.`}
        />
        <SettingsToggle
          label="Same work, two perspectives"
          hint="Now and then, one work heard in two recordings side by side. Off: each work once a week."
          checked={p.pairs}
          onChange={(e) => void set('pairs', e.target.checked)}
        />
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>What goes in</h2>
        <SegmentedControl size="sm" className={s.compactTrack} label="Recordings" value={p.recordingEra} onChange={(v) => void set('recordingEra', v as ListenerPreferences['recordingEra'])} options={PREF_OPTIONS.recordingEra} />
        <p className={s.faint} style={{ marginTop: 'var(--space-2xs)' }}>{ERA_HINT[p.recordingEra]}</p>
        <SettingsToggle label="Works with voices" hint="Choral symphonies, orchestral songs" checked={p.includeVoices} onChange={(e) => void set('includeVoices', e.target.checked)} />
        <SettingsToggle label="Concertos" hint="Orchestra with a soloist" checked={p.includeConcertos} onChange={(e) => void set('includeConcertos', e.target.checked)} />
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>The curator’s writing</h2>
        <SegmentedControl size="sm" className={s.compactTrack} label="How much it writes" value={p.depth} onChange={(v) => void set('depth', v as ListenerPreferences['depth'])} options={PREF_OPTIONS.depth} />
        <SegmentedControl size="sm" className={s.compactTrack} label="Language" value={p.language} onChange={(v) => void set('language', v as ListenerPreferences['language'])} options={PREF_OPTIONS.language} />
      </section>
    </>
  )
}

/**
 * Start the journey again: a backup is saved first (the archive), the pages
 * the app wrote in Notion go to Notion's trash, and the app forgets
 * everything it holds about the journey and about you. Your settings,
 * connections and music preferences stay.
 */
function FreshStartSection() {
  const { repo, notion, bump, say } = useServices()
  const [asking, setAsking] = useState(false)
  const [working, setWorking] = useState<string | null>(null)

  async function freshStart() {
    setAsking(false)
    try {
      setWorking('Saving the archive…')
      await downloadBackup(repo, 'the-long-listen-archive')
      if (notion) {
        setWorking('Moving your notebook pages to Notion’s trash…')
        await archiveNotebook(notion.call, repo).catch(() => 0)
      }
      setWorking('Clearing…')
      await repo.freshStart()
      bump()
      say('A fresh start. The archive was saved to your downloads.', 'success')
      go({ name: 'week' })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setWorking(null)
    }
  }

  return (
    <section className={s.settingsGroup}>
      <h2 className={s.h2}>A fresh start</h2>
      <p className={s.quiet}>
        Clears the whole journey: every week and programme, your listening marks and reactions, the threads, and everything the curator has
        learned about your taste, including your notes to it. First the app saves an archive file to your downloads (it restores like any backup),
        and moves the pages it wrote in Notion to Notion’s trash, where they stay recoverable for 30 days.
        Kept: your keys and connections, your music and exploration settings, the look of the app.
      </p>
      <button className={`${s.textButton} ${s.dangerButton}`} onClick={() => setAsking(true)} disabled={Boolean(working)}>{working ?? 'Start again from nothing…'}</button>
      <ConfirmModal
        isOpen={asking}
        title="Start again from nothing?"
        message="An archive of everything is saved to your downloads first, and it restores like any backup. After that, the app keeps nothing of the journey so far."
        confirmText="Clear everything"
        variant="danger"
        onConfirm={() => void freshStart()}
        onCancel={() => setAsking(false)}
      />
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

/** Everything in the store, as one JSON file in the downloads. */
async function downloadBackup(repo: ReturnType<typeof useServices>['repo'], name: string) {
  const data = await repo.exportAll()
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function BackupSection({ repo, bump, say }: Pick<ReturnType<typeof useServices>, 'repo' | 'bump' | 'say'>) {
  const fileRef = useRef<HTMLInputElement>(null)

  async function exportBackup() {
    await downloadBackup(repo, 'the-long-listen')
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
