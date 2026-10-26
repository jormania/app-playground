import { useEffect, useId, useRef, useState } from 'react'
import { ConfirmModal, Field, SegmentedControl } from '../../ds'
import { useLoad, useServices } from '../app/services'
import { beginSignIn, redirectUriFor, renewBy } from '../spotify/auth'
import { canonicalTimeZone, isValidTimeZone } from '../domain/week'
import { DEFAULT_PREFERENCES, type ListenerPreferences } from '../domain/types'
import type { ThemeChoice } from '../app/settings'
import { GUIDE_URL, STARTER_TEMPLATE_URL } from '../app/links'
import { dateWords, messageOf } from '../components/common'
import { LevelScale } from '../components/LevelScale'
import { BREADTH, FAMILIARITY, TIME } from '../domain/exploration'
import { archiveNotebook } from '../notion/mirror'
import { CuratorUnavailable } from '../curation/api'
import { PREFIX, checkBackup, type Repo } from '../store/repo'
import { go } from '../app/router'
import { modelLabel, usageSummary } from '../app/usage'
import { RELEASE } from '../app/release'
import s from '../styles/editorial.module.css'
import { Twisty } from '../components/Twisty'
import { forgetPlaces } from '../app/kept'
import { dataKept, downloadBackup, lastBackup } from '../app/backup'

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

/** One card of related settings, with an optional status on the right of its title. A part's only card needs no title of its own. */
function Card({ title, status, tone, children }: { title?: string; status?: { on: boolean; text: string }; tone?: 'danger'; children: React.ReactNode }) {
  return (
    <div className={`${s.settingsCard} ${tone === 'danger' ? s.settingsCardDanger : ''}`}>
      {title && (
        <div className={s.settingsCardHead}>
          <h3 className={s.settingsCardTitle}>{title}</h3>
          {status && <span className={`${s.tag} ${status.on ? s.tagOn : ''}`}>{status.text}</span>}
        </div>
      )}
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

/**
 * A connection's fields, buttons and how-to: in the open until it works, then folded under one
 * line, so a page of connections set up months ago reads as three short cards.
 */
function Manage({ settled, value, children }: { settled: boolean; value: string; children: React.ReactNode }) {
  return settled ? <Twisty label="Manage" value={value}>{children}</Twisty> : <>{children}</>
}

/** The longer how-to, folded away until wanted — folded the way the app folds everything. */
function Steps({ summary = 'How to set it up', children }: { summary?: string; children: React.ReactNode }) {
  return (
    <Twisty label={summary}>
      <div className={s.stepsBody}>{children}</div>
    </Twisty>
  )
}

/**
 * Settings, in parts. Your music: how a week of listening should feel, what
 * goes into it and how the curator writes. Connections: Claude, Spotify and
 * Notion, each a card with its state, its fields, its actions, and the how-to
 * folded beneath. The app: one card — how
 * it looks, what you skip, the week's time zone. Your data: a backup, and a
 * fresh start. About: the release, what Claude has cost this month by model,
 * and the prompts' versions. Every setting is
 * labelled the same way, every action is a button of one kind, every hint is
 * one style.
 */
export function SettingsScreen() {
  const { settings, updateSettings, prompts } = useServices()
  return (
    <div>
      <p className={s.eyebrow}>Settings</p>
      <h1 className={s.title}>How it works for you</h1>
      <p className={s.dek}>
        New here? <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">The user’s guide</a> walks through setting up, a section at a time.
      </p>

      <Part title="Your music" intro="The curator follows these above anything it has inferred. A change applies to the next directions, and the week’s page offers to rework the current three for it.">
        <ExplorationSections />
      </Part>

      <Part title="Connections" intro="Keys and tokens stay on this device and go only to the service they belong to.">
        <ClaudeSection />
        <SpotifySection />
        <NotionSection />
      </Part>

      <Part title="The app">
        <Card>
          <Setting label="Theme">
            <SegmentedControl size="sm" className={s.compactTrack} label="Theme" value={settings.theme} onChange={(v) => updateSettings({ theme: v as ThemeChoice })}
              options={[{ value: 'system', label: 'Device' }, { value: 'light', label: 'Day' }, { value: 'dark', label: 'Night' }]} />
          </Setting>
          <Setting label="Text size">
            <SegmentedControl size="sm" className={s.compactTrack} label="Text size" value={settings.textSize} onChange={(v) => updateSettings({ textSize: v as 'standard' | 'large' })}
              options={[{ value: 'standard', label: 'Standard' }, { value: 'large', label: 'Larger' }]} />
          </Setting>
          <Switch
            label="Hide what I skip, everywhere"
            hint="Gone from the programme, the running order, the Journal, the Library and the playlist. Not deleted: the curator still knows, and a programme can show them again for a moment."
            checked={settings.hideSkipped}
            onChange={(v) => updateSettings({ hideSkipped: v })}
          />
          <TimeZoneField />
        </Card>
      </Part>

      <Part title="Your data" intro="Everything lives on this device.">
        <DataSections />
      </Part>

      <Part title="About">
        <Card>
          <p className={s.settingText}>{RELEASE.name} · {RELEASE.date}</p>
          <SpendLine />
          <Steps summary="Prompt versions">
            <p className={s.mono}>{Object.values(prompts).join(' · ')}</p>
          </Steps>
        </Card>
      </Part>

      {import.meta.env.DEV && (
        <Part title="Development">
          <Card>
            <Switch label="Use the demo curator" hint="Canned programmes, no Anthropic key." checked={settings.demo} onChange={(v) => updateSettings({ demo: v })} />
          </Card>
        </Part>
      )}
    </div>
  )
}

/**
 * What Claude has cost on this device this month, from Anthropic's own usage
 * figures: the total, then each model, dearest first, and folded beneath, what
 * it was for. In About, so the figure is found where a listener looks for
 * "what is this costing me".
 */
function SpendLine() {
  const { version } = useServices()
  const [m, setM] = useState(() => usageSummary())
  useEffect(() => setM(usageSummary()), [version])
  const dollars = (d: number | null) => (d === null ? 'not priced here' : d < 0.01 ? 'under a cent' : `about $${d.toFixed(2)}`)
  const count = (n: number) => `${n} ${n === 1 ? 'request' : 'requests'}`
  if (m.requests === 0) return <p className={s.settingText}>Nothing spent on Claude this month, on this device.</p>
  return (
    <>
      <p className={s.settingText}>
        Claude this month, on this device: {dollars(m.dollars)} — an estimate at list prices; the Anthropic Console has the bill.
      </p>
      {m.byModel.map((b) => (
        <p key={b.model} className={s.settingText}>
          {modelLabel(b.model)}: {dollars(b.dollars)}, {count(b.requests)}
        </p>
      ))}
      {m.byCategory.length > 0 && (
        <Steps summary="What it was for">
          {m.byCategory.map((c) => (
            <p key={c.label} className={s.settingText}>{c.label}: {dollars(c.dollars)}, {count(c.requests)}</p>
          ))}
        </Steps>
      )}
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
  const { settings, updateSettings, testCurator, bump } = useServices()
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
      bump() // the test is a request too: the month's spend moves with it
    }
  }

  return (
    <Card title="Claude, the curator" status={{ on: Boolean(settings.anthropicKey) || settings.demo, text: settings.anthropicKey ? 'Key added' : settings.demo ? 'Demo' : 'Not set up' }}>
      <p className={s.settingText}>Sonnet writes what needs judgement — the directions, programmes and concert readings; Haiku, at a twentieth of the price, does the short reading and writing around them.</p>
      <Manage settled={Boolean(settings.anthropicKey) && result?.ok !== false} value="the key, a test, how it was set up">
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
      </Manage>
    </Card>
  )
}

/** Spotify ends a sign-in after six months: within two weeks of that, the date it will ask again; otherwise nothing. */
function renewalDue(at: number | undefined): at is number {
  return at !== undefined && at - Date.now() < 14 * 24 * 3600_000
}

function SpotifySection() {
  const { settings, updateSettings, spotify, testSpotify, bump } = useServices()
  const [result, setResult] = useState<Result>(null)
  const [testing, setTesting] = useState(false)
  const needsReconnect = spotify.connected && !spotify.hasScope('playlist-modify-private')
  const renewAt = spotify.connected ? renewBy(spotify.currentTokens) : undefined

  async function connect() {
    if (!settings.spotifyClientId.trim()) return setResult({ ok: false, message: 'Add your Spotify app’s Client ID first.' })
    try {
      window.location.assign(await beginSignIn(settings.spotifyClientId.trim(), redirectUriFor()))
    } catch (e) {
      setResult({ ok: false, message: messageOf(e) })
    }
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

  const button = `${s.outlineButton} ${s.smallButton}`
  return (
    <Card title="Spotify" status={{ on: spotify.connected && !needsReconnect, text: spotify.connected ? (needsReconnect ? 'Reconnect' : 'Connected') : 'Not connected' }}>
      <p className={s.settingText}>Confirms each recording exactly, notices what you’ve played, keeps each week as a private playlist, and plays on your devices (Premium).</p>
      {/* Only before connecting: changed under a live sign-in, it would break the next token refresh. */}
      {!spotify.connected && <CommitField label="Spotify Client ID" value={settings.spotifyClientId} onCommit={(v) => updateSettings({ spotifyClientId: v })} />}
      {renewalDue(renewAt) && <p className={s.settingWarn}>Spotify will ask you to sign in again around {dateWords(renewAt, settings.timeZone)}.</p>}
      <Manage settled={spotify.connected && !needsReconnect && !renewalDue(renewAt) && result?.ok !== false} value="a test, disconnect, how it was set up">
      <div className={s.settingsActions}>
        {!spotify.connected
          ? <button className={button} onClick={connect}>Connect Spotify</button>
          : <>
              {needsReconnect
                ? <button className={button} onClick={connect}>Reconnect Spotify (adds playlists)</button>
                : <>
                    {renewalDue(renewAt) && <button className={button} onClick={connect}>Sign in again</button>}
                    <button className={button} onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test Spotify'}</button>
                  </>}
              <button className={button} onClick={() => { spotify.setTokens(null); setResult(null); bump() }}>Disconnect</button>
            </>}
      </div>
      <ResultLine r={result} />
      <Steps>
        <p>It needs a Spotify app of your own: at developer.spotify.com → Dashboard → Create app, add this redirect URI, tick “Web API”, and paste the app’s Client ID above.</p>
        <p className={s.codeBox}>{redirectUriFor()}</p>
        <p>You sign in on Spotify’s own page; this app never sees your password.</p>
      </Steps>
      </Manage>
    </Card>
  )
}

function NotionSection() {
  const { settings, updateSettings, notion, testNotion, syncNotion, notionState } = useServices()
  const [result, setResult] = useState<Result>(null)
  const [testing, setTesting] = useState(false)
  const failing = Boolean(notion && notionState.error)

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
    <Card title="Notion" status={{ on: Boolean(notion) && !failing, text: notion ? (failing ? 'Not updated' : 'Connected') : 'Not connected' }}>
      <p className={s.settingText}>Your journal and taste, mirrored to Notion as readable pages.</p>
      {/* One warning at a time: a failed test already says what is wrong. Outside the fold, so it is never folded away. */}
      {failing && result?.ok !== false && <p className={s.settingWarn}>{notionState.error}</p>}
      <Manage settled={Boolean(notion) && !failing && result?.ok !== false} value="the token, the page, a test, Update now">
      <CommitField label="Notion integration token" type="password" value={settings.notionToken} placeholder="ntn_…" onCommit={(v) => { updateSettings({ notionToken: v }); setResult(null) }} />
      <CommitField label="Notion page" value={settings.notionPage} placeholder="https://www.notion.so/…" hint="The page that holds (or will hold) the app’s databases." onCommit={(v) => { updateSettings({ notionPage: v }); setResult(null) }} />
      <div className={s.settingsActions}>
        <button className={`${s.outlineButton} ${s.smallButton}`} onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test Notion'}</button>
        {notion && <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => void syncNotion()} disabled={notionState.syncing}>{notionState.syncing ? 'Updating Notion…' : 'Update Notion now'}</button>}
      </div>
      <ResultLine r={result} />
      <Steps>
        <p>Duplicate the <a href={STARTER_TEMPLATE_URL} target="_blank" rel="noopener noreferrer">Starter Template</a> (or use any empty page), connect it to your integration (••• → Connections), then paste the integration token and the page’s link above.</p>
      </Steps>
      </Manage>
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
  'modern-sound': 'Recordings from about 1980 on, with modern sound; an older one only where no good modern one exists, and said so.',
  'period-practice': 'Historically informed performances, where they exist.',
}

const DEPTH_HINT: Record<ListenerPreferences['depth'], string> = {
  concise: 'Short notes.',
  standard: 'Notes of the usual length.',
  deeper: 'A little more context and history.',
}

/** What a week of listening should be like — told to the curator directly. */
function ExplorationSections() {
  const { repo, bump, say } = useServices()
  const { data } = useLoad(() => repo.preferences(), [])
  const p = data ?? DEFAULT_PREFERENCES
  async function set<K extends keyof ListenerPreferences>(k: K, v: ListenerPreferences[K]) {
    try {
      await repo.savePreferences({ ...(await repo.preferences()), [k]: v })
      bump()
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }
  const [least, most] = TIME[p.timePerWeek].works
  return (
    <>
      <Card title="Your week of listening">
        <Setting label="Music each week" hint={`${TIME[p.timePerWeek].words[0].toUpperCase()}${TIME[p.timePerWeek].words.slice(1)}: about ${least}–${most} works, usually in two to four sections.`}>
          <SegmentedControl size="sm" className={s.compactTrack} label="Music each week" value={p.timePerWeek} onChange={(v) => void set('timePerWeek', v as ListenerPreferences['timePerWeek'])} options={PREF_OPTIONS.timePerWeek} />
        </Setting>
        <LevelScale
          label="How widely a week ranges"
          value={p.breadth}
          onChange={(v) => void set('breadth', v)}
          names={BREADTH}
          describe={(v) => `${BREADTH[v].words[0].toUpperCase()}${BREADTH[v].words.slice(1)}.`}
        />
        <LevelScale
          label="How well known the music is"
          value={p.familiarity}
          onChange={(v) => void set('familiarity', v)}
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
        <Setting label="How much it writes" hint={DEPTH_HINT[p.depth]}>
          <SegmentedControl size="sm" className={s.compactTrack} label="How much it writes" value={p.depth} onChange={(v) => void set('depth', v as ListenerPreferences['depth'])} options={PREF_OPTIONS.depth} />
        </Setting>
        <Setting label="Language" hint="The curator’s writing. The app itself stays in English.">
          <SegmentedControl size="sm" className={s.compactTrack} label="Language" value={p.language} onChange={(v) => void set('language', v as ListenerPreferences['language'])} options={PREF_OPTIONS.language} />
        </Setting>
      </Card>
    </>
  )
}

/** Every place's zone this browser knows, and UTC — or null where it can't list them. */
function placeZones(): string[] | null {
  if (typeof Intl.supportedValuesOf !== 'function') return null
  const zones = Intl.supportedValuesOf('timeZone').filter(isValidTimeZone)
  return zones.includes('UTC') ? zones : ['UTC', ...zones]
}

const WEEK_BEGINS = 'A new week begins at midnight on Monday in this time zone.'

/**
 * The week's time zone, chosen from a list, so only a place's zone can be
 * chosen and it is stored by its own name. Where the browser can't list its
 * zones, a field to type in, saved by the canonical name.
 */
function TimeZoneField() {
  const { settings, updateSettings } = useServices()
  const id = useId()
  const [zones] = useState(placeZones)
  const [typed, setTyped] = useState(settings.timeZone)
  if (zones) {
    const options = zones.includes(settings.timeZone) ? zones : [settings.timeZone, ...zones]
    return (
      <div className={s.setting}>
        <label htmlFor={id} className={s.settingLabel}>Time zone</label>
        <select id={id} className={s.zoneSelect} value={settings.timeZone} onChange={(e) => updateSettings({ timeZone: canonicalTimeZone(e.target.value) ?? settings.timeZone })}>
          {options.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
        </select>
        <p className={s.settingHint}>{WEEK_BEGINS}</p>
      </div>
    )
  }
  const zone = canonicalTimeZone(typed)
  return (
    <div className={s.setting}>
      <Field label="Time zone" value={typed} onChange={(e) => setTyped(e.target.value)} spellCheck={false}
        error={typed.trim() && !zone ? 'Use a place, like Europe/Bucharest — a fixed offset ignores summer time.' : undefined} hint={WEEK_BEGINS} />
      {zone && zone !== settings.timeZone && (
        <div className={s.settingsActions}>
          <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => { updateSettings({ timeZone: zone }); setTyped(zone) }}>Use this time zone</button>
        </div>
      )}
    </div>
  )
}

/** Is there a journey here to lose? Any week at all; a new device has only its settings. */
async function holdsJourney(repo: Repo): Promise<boolean> {
  return (await repo.store.keys()).some((k) => k.startsWith(`${PREFIX}week:`))
}

type Busy = { busy: 'restore' | 'fresh' | null; setBusy: (b: 'restore' | 'fresh' | null) => void }

/** The backup and the fresh start, never both at once: each replaces the journey the other is working on. */
function DataSections() {
  const [busy, setBusy] = useState<Busy['busy']>(null)
  return (
    <>
      <BackupSection busy={busy} setBusy={setBusy} />
      <FreshStartSection busy={busy} setBusy={setBusy} />
    </>
  )
}

function BackupSection({ busy, setBusy }: Busy) {
  const { repo, bump, say, settings, notion, notionState, syncNotion } = useServices()
  const fileRef = useRef<HTMLInputElement>(null)
  const [last, setLast] = useState(lastBackup)
  const [kept, setKept] = useState<boolean | undefined>(undefined)
  useEffect(() => { void dataKept().then(setKept) }, [])
  // A backup read, checked, and waiting for the listener's word: a restore replaces the journey here.
  const [waiting, setWaiting] = useState<{ data: unknown; replaces: boolean } | null>(null)

  async function exportBackup() {
    try {
      await downloadBackup(repo, 'the-long-listen', settings.timeZone)
      setLast(lastBackup())
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }

  async function readBackup(file: File) {
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      // A parser's message ("Unexpected token…") says nothing a listener can use.
      return say('That file isn’t a backup from this app — it couldn’t be read. Nothing here was changed.', 'danger')
    }
    // Checked before the question, so a file that would be refused never gets as far as "Replace this journey?".
    const refused = checkBackup(data)
    if (refused) return say(refused, 'danger')
    setWaiting({ data, replaces: await holdsJourney(repo).catch(() => true) })
  }

  async function restore() {
    const data = waiting?.data
    setWaiting(null)
    setBusy('restore')
    try {
      // The journey it replaces goes to the downloads first, as before a fresh start — when there is one.
      const replaced = await holdsJourney(repo)
      if (replaced) await downloadBackup(repo, 'the-long-listen-before-restore', settings.timeZone)
      // The notebook rows of the journey being replaced go to Notion's trash first, as a fresh start's do:
      // their states leave with it, and nothing would update or remove those pages again.
      if (notion) {
        const leaving = await repo.notionLeaving(data)
        if (leaving.length) {
          await archiveNotebook(notion.call, repo, leaving).catch((e: unknown) => {
            throw new CuratorUnavailable('failed', e instanceof Error && e.message.startsWith('Notion') ? e.message : 'Notion couldn’t be reached, so nothing was restored. Try again in a minute.')
          })
        }
      }
      await repo.importAll(data)
      forgetPlaces()
      bump()
      say(replaced ? 'The backup is restored. The journey it replaced is in your downloads.' : 'The backup is restored.', 'success')
      // Every page is to be checked again: now, rather than at the next reload.
      if (notion) void syncNotion()
    } catch (e) {
      // The restore is one change: whatever failed, the journey here is as it was.
      say(checkBackup(data) ?? (e instanceof CuratorUnavailable ? e.message : 'The backup couldn’t be restored just now. Nothing here was changed.'), 'danger')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card title="Backup">
      <p className={s.settingText}>Save a copy now and then. Restoring one replaces the journey on this device. Your keys are not in it.</p>
      {/* When it was last done, in words: the journey lives only on this device. */}
      <p className={s.settingHint}>
        {last ? `Last saved on ${dateWords(last, settings.timeZone)}.` : 'No backup saved from this device yet.'}
        {kept === false && ' The browser hasn’t agreed to keep this app’s data, so it could clear it if space runs short — installing the app usually settles that.'}
      </p>
      <div className={s.settingsActions}>
        <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => void exportBackup()}>Save a backup</button>
        {/* Not while Notion is being written: the sync would carry on writing the journey being replaced. */}
        <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => fileRef.current?.click()} disabled={busy !== null || notionState.syncing}>{busy === 'restore' ? 'Restoring…' : 'Restore from a backup'}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readBackup(f); e.target.value = '' }} />
      </div>
      <ConfirmModal
        isOpen={waiting !== null}
        title={waiting?.replaces ? 'Replace this journey with the backup?' : 'Restore this backup?'}
        message={waiting?.replaces
          ? 'The backup takes the place of everything here. The journey on this device is saved to your downloads first, so it can be restored in turn.'
          : 'Its journey and music settings come to this device.'}
        confirmText="Restore the backup"
        variant="danger"
        onConfirm={() => void restore()}
        onCancel={() => setWaiting(null)}
      />
    </Card>
  )
}

/**
 * Start the journey again: a backup is saved first (the archive), the pages
 * the app wrote in Notion go to Notion's trash, and the app forgets
 * everything it holds about the journey and about you. Your settings,
 * connections and music preferences stay.
 */
function FreshStartSection({ busy, setBusy }: Busy) {
  const { repo, notion, bump, say, settings, notionState } = useServices()
  const [asking, setAsking] = useState(false)
  const [working, setWorking] = useState<string | null>(null)

  async function freshStart() {
    setAsking(false)
    setBusy('fresh')
    try {
      setWorking('Saving the archive…')
      await downloadBackup(repo, 'the-long-listen-archive', settings.timeZone)
      if (notion) {
        setWorking('Moving your notebook pages to Notion’s trash…')
        await archiveNotebook(notion.call, repo).catch((e: unknown) => {
          // Its own failure says what Notion did and that nothing was cleared: more use than "something didn't work".
          throw new CuratorUnavailable('failed', e instanceof Error && e.message.startsWith('Notion') ? e.message : 'Notion couldn’t be reached, so nothing was cleared. Try again in a minute.')
        })
      }
      setWorking('Clearing…')
      await repo.freshStart()
      forgetPlaces()
      bump()
      say('A fresh start. The archive was saved to your downloads.', 'success')
      go({ name: 'week' })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setWorking(null)
      setBusy(null)
    }
  }

  return (
    <Card title="A fresh start" tone="danger">
      <p className={s.settingText}>Clears the whole journey and begins again. An archive is saved to your downloads first, and it restores like any backup.</p>
      <div className={s.settingsActions}>
        <button className={`${s.outlineButton} ${s.smallButton} ${s.dangerOutline}`} onClick={() => setAsking(true)} disabled={busy !== null || notionState.syncing}>{working ?? 'Start again from nothing…'}</button>
      </div>
      <Steps summary="What it clears, and what it keeps">
        <p>Cleared: every week and programme, your listening marks and reactions, the threads, the concerts you kept and your “I’m going” marks, the wish for next week, the composer portraits and word definitions, and everything the curator has learned about your taste, including your notes to it. The pages the app wrote in Notion move to Notion’s trash, where they stay recoverable for 30 days.</p>
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
