import { useEffect, useId, useRef, useState } from 'react'
import { ConfirmModal, Field, SegmentedControl } from '../../ds'
import { useLoad, useServices } from '../app/services'
import { beginSignIn, redirectUriFor, renewBy } from '../spotify/auth'
import { isValidTimeZone } from '../domain/week'
import { DEFAULT_PREFERENCES, type ListenerPreferences } from '../domain/types'
import type { DuskChoice, ThemeChoice } from '../app/settings'
import { DUSK_KEYS, DUSK_SHADES, duskTally } from '../app/theme'
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
  return <p className={r.ok ? s.okLine : s.settingWarn} role="status">{r.message}</p>
}

/* ── the page's own building blocks: one look for every setting ─────────── */

/** A part of the page — your music, connections, the app, your data — under one accent heading. */
function Part({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={s.settingsPartBlock} aria-label={title}>
      <h2 className={s.settingsPart}>{title}</h2>
      {intro && <p className={s.settingsIntro}>{intro}</p>}
      {children}
    </section>
  )
}

/** One card of related settings, with an optional status on the right of its title. */
function Card({ title, status, tone, children }: { title: string; status?: { on: boolean; text: string }; tone?: 'danger'; children: React.ReactNode }) {
  return (
    <div className={`${s.settingsCard} ${tone === 'danger' ? s.settingsCardDanger : ''}`}>
      <div className={s.settingsCardHead}>
        <h3 className={s.settingsCardTitle}>{title}</h3>
        {status && <span className={`${s.tag} ${status.on ? s.tagOn : ''}`}>{status.text}</span>}
      </div>
      {children}
    </div>
  )
}

/** A labelled control: its name above, a one-line hint below — the same for every kind of control. */
function Setting({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={s.setting}>
      <p className={s.settingLabel}>{label}</p>
      {children}
      {hint && <p className={s.settingHint}>{hint}</p>}
    </div>
  )
}

/** On or off: the name and hint on the left, the switch on the right. */
function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className={s.switchRow}>
      <div>
        <label htmlFor={id} className={s.settingLabel}>{label}</label>
        {hint && <p className={s.settingHint}>{hint}</p>}
      </div>
      <input id={id} type="checkbox" role="switch" className={s.switch} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}

/** The longer how-to, folded away until wanted. */
function Steps({ summary = 'How to set it up', children }: { summary?: string; children: React.ReactNode }) {
  return (
    <details className={s.settingsSteps}>
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  )
}

/**
 * Settings, in five parts. Your music: how a week of listening should feel,
 * what goes into it and how the curator writes. Connections: Claude, Spotify
 * and Notion, each a card with its state, its fields, its actions, and the
 * how-to folded beneath. The app: display, listening, the week's time zone.
 * Your data: a backup, and a fresh start. About: what's running and its cost.
 * Every setting is labelled the same way, every action is a button of one
 * kind, every hint is one style.
 */
export function SettingsScreen() {
  const svc = useServices()
  const { settings, updateSettings, prompts, spotify, repo, bump, say } = svc
  return (
    <div>
      <h1 className={s.titleSmall}>Settings</h1>
      <p className={s.quiet}>
        New here? <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">The user’s guide</a> walks through setting up, a section at a time.
      </p>

      <Part title="Your music" intro="The curator weighs these above anything it has inferred. A change shapes the next directions and programmes, never one already made — so set them before you choose a week, or ask for three others after.">
        <ExplorationSections />
      </Part>

      <Part title="Connections" intro="Keys and tokens stay on this device and go only to the service they belong to.">
        <ClaudeSection />
        <SpotifySection />
        <NotionSection />
      </Part>

      <Part title="The app">
        <Card title="Display">
          <Setting label="Theme">
            <SegmentedControl size="sm" className={s.compactTrack} label="Theme" value={settings.theme} onChange={(v) => updateSettings({ theme: v as ThemeChoice })}
              options={[{ value: 'system', label: 'Device' }, { value: 'light', label: 'Day' }, { value: 'dark', label: 'Night' }]} />
          </Setting>
          <Setting label="Listening view" hint={<DuskTallyLine />}>
            <SegmentedControl size="sm" className={s.compactTrack} label="Listening view" value={settings.dusk} onChange={(v) => updateSettings({ dusk: v as DuskChoice })}
              options={[{ value: 'rotate', label: 'Rotate' }, ...DUSK_KEYS.map((k) => ({ value: k, label: DUSK_SHADES[k].name.split(' ')[0] }))]} />
          </Setting>
          <Setting label="Text size">
            <SegmentedControl size="sm" className={s.compactTrack} label="Text size" value={settings.textSize} onChange={(v) => updateSettings({ textSize: v as 'standard' | 'large' })}
              options={[{ value: 'standard', label: 'Standard' }, { value: 'large', label: 'Larger' }]} />
          </Setting>
        </Card>
        <Card title="Listening">
          <Switch
            label="Hide what I skip, everywhere"
            hint="Gone from the programme, the running order, the Journal, the Library and the playlist. Not deleted: the curator still knows, and a programme can show them again for a moment."
            checked={settings.hideSkipped}
            onChange={(v) => updateSettings({ hideSkipped: v })}
          />
        </Card>
        <Card title="Your week">
          <TimeZoneField />
        </Card>
      </Part>

      <Part title="Your data" intro="Everything lives on this device.">
        <BackupSection repo={repo} bump={bump} say={say} />
        <FreshStartSection />
      </Part>

      <Part title="About">
        <Card title="The curator is Claude">
          <p className={s.settingText}><strong>Sonnet</strong> chooses the week’s three directions, writes the programmes and second perspectives, and reads concert programmes.</p>
          <p className={s.settingText}><strong>Haiku</strong>, at a twentieth of the price, does the reading around them: your feedback into taste, each thread’s week summed up, <em>A little more context</em>, and further reading.</p>
          <Setting label="This month, on this device"><SpendLine /></Setting>
          <p className={s.settingHint}>{RELEASE.name} · {RELEASE.date} · Spotify {spotify.connected ? 'connected' : 'not connected'} · Notion {svc.notion ? 'connected' : 'not connected'}</p>
          <Steps summary="Prompt versions">
            <p className={s.mono}>{Object.values(prompts).join(' · ')}</p>
          </Steps>
        </Card>
        {import.meta.env.DEV && (
          <Card title="Development">
            <Switch label="Use the demo curator" hint="Canned programmes, no Anthropic key." checked={settings.demo} onChange={(v) => updateSettings({ demo: v })} />
          </Card>
        )}
      </Part>
    </div>
  )
}

/** How the four listening shades have fared so far: shown, and liked. */
function DuskTallyLine() {
  const t = duskTally()
  const any = DUSK_KEYS.some((k) => t[k].shown)
  if (!any) return <>Rotate shows one of four dark shades at random each time you open a work’s listening view.</>
  return <>So far — {DUSK_KEYS.map((k) => `${DUSK_SHADES[k].name}: shown ${t[k].shown}, liked ${t[k].liked}`).join(' · ')}.</>
}

/** What Claude has cost on this device this month, from Anthropic's own usage figures. */
function SpendLine() {
  const { version } = useServices()
  const [m, setM] = useState(() => usageSummary())
  useEffect(() => setM(usageSummary()), [version])
  if (m.requests === 0) return <p className={s.settingText}>Nothing spent on Claude yet.</p>
  const usd = (n: number) => (n < 0.01 ? 'under a cent' : `about $${n.toFixed(2)}`)
  const name = (model: string) => model.replace('claude-', '').replace(/-(\d+)-(\d+)$/, ' $1.$2').replace(/^./, (c) => c.toUpperCase())
  return (
    <>
      <p className={s.settingText}>
        {usd(m.dollars)}, over {m.requests} request{m.requests === 1 ? '' : 's'}
        {m.byModel.length > 1 && <> ({m.byModel.map((b) => `${name(b.model)} ${b.dollars === null ? 'no price on record' : usd(b.dollars)}`).join(' · ')})</>}
      </p>
      <p className={s.settingHint}>An estimate at list prices. The Anthropic Console has the bill.</p>
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
    <Card title="Claude, the curator" status={{ on: Boolean(settings.anthropicKey) || settings.demo, text: settings.anthropicKey ? 'Key added' : settings.demo ? 'Demo' : 'Not set up' }}>
      <p className={s.settingText}>Writes every direction and programme. Each week costs a few cents.</p>
      <CommitField label="Anthropic API key" type="password" value={settings.anthropicKey} placeholder="sk-ant-…" onCommit={(v) => { updateSettings({ anthropicKey: v }); setResult(null) }} />
      <div className={s.settingsActions}>
        <button className={`${s.outlineButton} ${s.smallButton}`} onClick={test} disabled={testing || (!settings.anthropicKey && !settings.demo)}>{testing ? 'Testing…' : 'Test the key'}</button>
        {settings.anthropicKey && <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => { updateSettings({ anthropicKey: '' }); setResult(null) }}>Remove</button>}
      </div>
      <ResultLine r={result} />
      <Steps>
        <p>At console.anthropic.com → API keys, make a key and paste it above. It stays on this device, like in the other apps here, and goes only to Anthropic, with each request to Claude.</p>
        <p>Best practice: a key made just for this app, in a workspace with a small monthly spend limit — then a lost phone or a leak costs little, and the key can be deleted in the console without touching anything else.</p>
      </Steps>
    </Card>
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
    <Card title="Spotify" status={{ on: spotify.connected && !needsReconnect, text: spotify.connected ? (needsReconnect ? 'Reconnect' : 'Connected') : 'Not connected' }}>
      <p className={s.settingText}>Confirms each recording exactly, notices what you’ve played, keeps each week as a private playlist, and plays on your devices (Premium).</p>
      <CommitField label="Spotify Client ID" value={settings.spotifyClientId} onCommit={(v) => updateSettings({ spotifyClientId: v })} />
      <div className={s.settingsActions}>
        {!spotify.connected || needsReconnect
          ? <button className={`${s.outlineButton} ${s.smallButton}`} onClick={connect}>{needsReconnect ? 'Reconnect Spotify (adds playlists)' : 'Connect Spotify'}</button>
          : <>
              <button className={`${s.outlineButton} ${s.smallButton}`} onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test Spotify'}</button>
              <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => syncSpotify().then((n) => say(n ? 'Picked up recent listening.' : 'Nothing new from Spotify.')).catch((e) => say(messageOf(e), 'danger'))}>Check recent listening</button>
              <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => { spotify.setTokens(null); setResult(null); bump() }}>Disconnect</button>
            </>}
      </div>
      {spotify.connected && renewalNote(renewBy(spotify.currentTokens))}
      <ResultLine r={result} />
      <Steps>
        <p>It needs a Spotify app of your own: at developer.spotify.com → Dashboard → Create app, add this redirect URI, tick “Web API”, and paste the app’s Client ID above.</p>
        <p className={s.codeBox}>{redirectUriFor()}</p>
        <p>You sign in on Spotify’s own page; this app never sees your password.</p>
      </Steps>
    </Card>
  )
}

/** Spotify sign-ins last six months; say when this one needs renewing, quietly, and louder near the end. */
function renewalNote(at: number | undefined) {
  if (!at) return null
  const date = new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  const soon = at - Date.now() < 14 * 24 * 3600_000
  return (
    <p className={soon ? s.settingWarn : s.settingHint}>
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
    <Card title="Notion" status={{ on: Boolean(notion), text: notion ? 'Connected' : 'Not connected' }}>
      <p className={s.settingText}>A notebook mirrored from the app: programmes, threads, works and recordings, composers, concerts, and your taste in words.</p>
      <CommitField label="Notion integration token" type="password" value={settings.notionToken} placeholder="ntn_…" onCommit={(v) => { updateSettings({ notionToken: v }); setResult(null) }} />
      <CommitField label="Notebook page" value={settings.notionPage} placeholder="https://www.notion.so/…" hint="The page that holds (or will hold) the notebook’s databases." onCommit={(v) => { updateSettings({ notionPage: v }); setResult(null) }} />
      <div className={s.settingsActions}>
        <button className={`${s.outlineButton} ${s.smallButton}`} onClick={test} disabled={testing}>{testing ? 'Checking…' : 'Test Notion'}</button>
        {notion && <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => void syncNotion()} disabled={notionState.syncing}>{notionState.syncing ? 'Updating…' : 'Update Notion now'}</button>}
      </div>
      <ResultLine r={result} />
      {notionState.error && <p className={s.settingWarn}>{notionState.error}</p>}
      <Steps>
        <p>Duplicate the <a href={STARTER_TEMPLATE_URL} target="_blank" rel="noopener noreferrer">Starter Template</a> (or use any empty page), connect it to your integration (••• → Connections), then paste the integration token and the page’s link above.</p>
      </Steps>
    </Card>
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
      <Card title="Your week of listening">
        <Setting label="Music each week" hint={`${TIME[p.timePerWeek].words[0].toUpperCase()}${TIME[p.timePerWeek].words.slice(1)}: about ${least}–${most} works, in two to four sections.`}>
          <SegmentedControl size="sm" className={s.compactTrack} label="Music each week" value={p.timePerWeek} onChange={(v) => void set('timePerWeek', v as ListenerPreferences['timePerWeek'])} options={PREF_OPTIONS.timePerWeek} />
        </Setting>
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
        <Switch
          label="Same work, two perspectives"
          hint="Now and then, one work heard in two recordings side by side. Off: each work once a week."
          checked={p.pairs}
          onChange={(v) => void set('pairs', v)}
        />
      </Card>

      <Card title="What goes in">
        <Setting label="Recordings" hint={ERA_HINT[p.recordingEra]}>
          <SegmentedControl size="sm" className={s.compactTrack} label="Recordings" value={p.recordingEra} onChange={(v) => void set('recordingEra', v as ListenerPreferences['recordingEra'])} options={PREF_OPTIONS.recordingEra} />
        </Setting>
        <Switch label="Works with voices" hint="Choral symphonies, orchestral songs." checked={p.includeVoices} onChange={(v) => void set('includeVoices', v)} />
        <Switch label="Concertos" hint="Orchestra with a soloist." checked={p.includeConcertos} onChange={(v) => void set('includeConcertos', v)} />
      </Card>

      <Card title="The curator’s writing">
        <Setting label="How much it writes">
          <SegmentedControl size="sm" className={s.compactTrack} label="How much it writes" value={p.depth} onChange={(v) => void set('depth', v as ListenerPreferences['depth'])} options={PREF_OPTIONS.depth} />
        </Setting>
        <Setting label="Language">
          <SegmentedControl size="sm" className={s.compactTrack} label="Language" value={p.language} onChange={(v) => void set('language', v as ListenerPreferences['language'])} options={PREF_OPTIONS.language} />
        </Setting>
      </Card>
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
        await archiveNotebook(notion.call, repo)
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
    <Card title="A fresh start" tone="danger">
      <p className={s.settingText}>Clears the whole journey and begins again. An archive is saved to your downloads first, and it restores like any backup.</p>
      <div className={s.settingsActions}>
        <button className={`${s.outlineButton} ${s.smallButton} ${s.dangerOutline}`} onClick={() => setAsking(true)} disabled={Boolean(working)}>{working ?? 'Start again from nothing…'}</button>
      </div>
      <Steps summary="What it clears, and what it keeps">
        <p>Cleared: every week and programme, your listening marks and reactions, the threads, and everything the curator has learned about your taste, including your notes to it. The pages the app wrote in Notion move to Notion’s trash, where they stay recoverable for 30 days.</p>
        <p>Kept: your keys and connections, your music settings, the look of the app.</p>
      </Steps>
      <ConfirmModal
        isOpen={asking}
        title="Start again from nothing?"
        message="An archive of everything is saved to your downloads first, and it restores like any backup. After that, the app keeps nothing of the journey so far."
        confirmText="Clear everything"
        variant="danger"
        onConfirm={() => void freshStart()}
        onCancel={() => setAsking(false)}
      />
    </Card>
  )
}

function TimeZoneField() {
  const { settings, updateSettings } = useServices()
  const [zone, setZone] = useState(settings.timeZone)
  return (
    <>
      <p className={s.settingText}>A new week begins on Monday at midnight in this time zone, wherever you or the server happen to be.</p>
      <Field label="Time zone" value={zone} onChange={(e) => setZone(e.target.value)} error={zone && !isValidTimeZone(zone) ? 'Not a time zone this browser knows.' : undefined} hint="For example Europe/Bucharest" />
      {zone !== settings.timeZone && (
        <div className={s.settingsActions}>
          <button className={`${s.outlineButton} ${s.smallButton}`} disabled={!isValidTimeZone(zone)} onClick={() => updateSettings({ timeZone: zone })}>Use this time zone</button>
        </div>
      )}
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
    <Card title="Your journey, in a file">
      <p className={s.settingText}>Keep a copy now and then — it restores in any browser. Your keys are not in it.</p>
      <div className={s.settingsActions}>
        <button className={`${s.outlineButton} ${s.smallButton}`} onClick={exportBackup}>Save a backup</button>
        <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => fileRef.current?.click()}>Restore from a backup</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBackup(f); e.target.value = '' }} />
      </div>
    </Card>
  )
}
