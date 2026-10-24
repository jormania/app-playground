import { useCallback, useEffect, useRef, useState } from 'react'
import { GoingCards } from '../components/Going'
import { WEEK_FORMS, WEEK_MOODS, type ListenerPreferences, type ProgrammeOption, type Theme, type WeekMood, type WeekRecord } from '../domain/types'
import { BREADTH, FAMILIARITY, TIME } from '../domain/exploration'
import { directionChanges } from '../domain/directionChanges'
import { useServices } from '../app/services'
import { go, href } from '../app/router'
import { CuratorUnavailable } from '../curation/api'
import { verifyProgramme } from '../spotify/verify'
import { CharCount, MAX_ASK, NeedsKey, Problem, Waiting, messageOf } from '../components/common'
import { MOOD_WORD, OpenPaths } from '../components/OpenPaths'
import { GUIDE_URL } from '../app/links'
import { ProgrammeScreen } from './Programme'
import { SittingCard } from '../components/SittingCard'
import { Twisty } from '../components/Twisty'
import { Traits } from '../components/Traits'
import { BackupNudge } from '../components/BackupNudge'
import s from '../styles/editorial.module.css'
import { passing } from '../curation/api'

interface WeekView {
  record: WeekRecord
  options: ProgrammeOption[]
  openPaths: ProgrammeOption[]
  themes: Map<string, Theme>
  firstVisit: boolean
  prefs: ListenerPreferences
}

/**
 * This week: what am I listening to? Before a choice, the three directions;
 * after, the programme itself. Opening this page is what makes a new week —
 * once, and never again for the same week.
 */
export function WeekScreen() {
  const { journey, repo, version, bump, settings, spotify, say, curatorReady } = useServices()
  const [view, setView] = useState<WeekView | null>(null)
  const [error, setError] = useState<unknown>(null)
  // The direction (or open path) the curator is building a programme from.
  const [choosing, setChoosing] = useState<string | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const [mood, setMood] = useState('')
  const [asking, setAsking] = useState(false)
  const [tuning, setTuning] = useState(false)

  const failedOnMerits = useRef(false)
  const firstSeen = useRef(false)
  const load = useCallback(async () => {
    setError(null)
    try {
      // Once a first visit, a first visit for as long as the page is open: a reload a second later (a Spotify
      // sync, a stand-in repaired) used to find the week just written and drop the one-time explanation.
      const firstVisit = firstSeen.current || (firstSeen.current = (await repo.weeks.all()).length === 0)
      const record = await journey.ensureWeek()
      const options = await repo.options.many(record.optionIds)
      const openPaths = (await repo.options.all())
        .filter((o) => o.status === 'open' && o.weekKey < record.weekKey)
        .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
      const themes = new Map((await repo.themes.all()).map((t) => [t.id, t]))
      setView({ record, options, openPaths, themes, firstVisit, prefs: await repo.preferences() })
      failedOnMerits.current = false
    } catch (e) {
      failedOnMerits.current = !passing(e)
      setError(e)
    }
  }, [journey, repo])

  // Reload on data changes — but not into a week the curator just failed to write on its merits (no three
  // directions that would validate): each reload would ask, and pay, again with no tap. "Try again" does.
  // A new key (or demo) is worth asking with, whatever failed before.
  const lastSetup = useRef<string | null>(null)
  useEffect(() => {
    const setup = `${settings.anthropicKey}|${settings.demo}`
    const changed = setup !== lastSetup.current
    lastSetup.current = setup
    if (changed || !failedOnMerits.current) void load()
  }, [load, version, settings.anthropicKey, settings.demo])
  // A page left open (an installed app resumed) across Monday midnight: the new week, not last week's three.
  const shownWeek = view?.record.weekKey
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible' && shownWeek && journey.currentWeek().key !== shownWeek) void load() }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    const t = window.setInterval(check, 60_000)
    return () => { document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); window.clearInterval(t) }
  }, [shownWeek, journey, load])

  // One choice at a time: a second direction tapped before the first resolves would write a second programme.
  const choosingNow = useRef(false)
  async function choose(o: ProgrammeOption) {
    if (choosingNow.current) return
    choosingNow.current = true
    setChoosing(o.id)
    try {
      const p = await journey.choose(o.id)
      // Start confirming its recordings now, before the page has even drawn.
      void verifyProgramme(repo, spotify, p.id, bump).catch(() => {})
      bump()
      go({ name: 'programme', id: p.id })
    } catch (e) {
      // Said where it was asked, not above the list: the option may be a screen further down.
      say(messageOf(e), 'danger')
    } finally {
      choosingNow.current = false
      setChoosing(null)
    }
  }

  async function askAgain() {
    setAsking(true)
    try {
      await journey.offerOtherDirections(mood.trim() || undefined)
      setMood('')
      setAskOpen(false)
      bump()
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setAsking(false)
    }
  }

  /** The mood changed after the directions were made: three new ones that know it. True once they're here. */
  async function askWithMood(): Promise<boolean> {
    setAsking(true)
    try {
      // The mood is already on the week record; the curator reads it from there.
      await journey.offerOtherDirections()
      bump()
      return true
    } catch (e) {
      say(messageOf(e), 'danger')
      return false
    } finally {
      setAsking(false)
    }
  }

  if (error) {
    const noKey = error instanceof CuratorUnavailable && error.code === 'locked'
    const badKey = error instanceof CuratorUnavailable && error.code === 'bad-key'
    // No key yet: the first screen anyone sees. It says what the app is and the three things to set up, in order.
    if (noKey) {
      return (
        <div>
          <p className={s.eyebrow}>Welcome</p>
          <h1 className={s.title}>A curator for orchestral music</h1>
          <p className={s.dek}>Each week the curator offers three directions. Choose one and it writes you a programme — a sequence of works with a reason for each, a named recording, and what to listen for. It remembers what you heard and what you said, so a theme that comes back months later carries on from where it was left.</p>
          <ol className={s.setupSteps}>
            <li><strong>Your Anthropic key</strong> — the curator writes with it, from this device. <span className={s.faint}>Needed.</span></li>
            <li><strong>Spotify</strong> — to play each recording and notice what you’ve heard. <span className={s.faint}>Recommended.</span></li>
            <li><strong>Notion</strong> — a readable notebook of the journey. <span className={s.faint}>Optional.</span></li>
          </ol>
          <div className={s.actions}>
            <a className={s.primaryButton} href={href({ name: 'settings' })}>Open Settings</a>
            <a className={s.textButton} href={GUIDE_URL} target="_blank" rel="noopener noreferrer">How to get each one (the guide)</a>
          </div>
        </div>
      )
    }
    return (
      <div>
        <p className={s.eyebrow}>{journey.currentWeek().label}</p>
        {/* A key that stopped working is not a first visit: said as what it is, once. */}
        <h1 className={s.titleSmall}>{badKey ? 'The curator can’t use this key' : 'This week is still being prepared'}</h1>
        <Problem error={error} onRetry={badKey ? undefined : () => void load()} />
        {badKey && <p><a href="#/settings">Open Settings</a> to check the key or add a new one; everything you’ve listened to is still here.</p>}
      </div>
    )
  }
  // One thing at a time: choosing a direction and asking for others both rewrite the week.
  const busy = asking || choosing !== null
  if (!view) return <Waiting>The curator is choosing this week’s directions…</Waiting>
  if (view.record.programmeId) return <ProgrammeScreen id={view.record.programmeId} asThisWeek />
  // What moved since these three were offered. Anything at all, and asking again
  // brings the same three back reworked for it, not three somewhere else.
  const changes = directionChanges(view.record.madeWith, view.prefs, view.record.mood)
  const rework = changes.length > 0
  // The settings these three were made with — not today's, which may have moved since.
  const made = view.record.madeWith?.preferences ?? view.prefs

  return (
    <div>
      {/* The masthead dates the week; the eyebrow names the section, as on every other screen. */}
      <p className={s.eyebrow}>This week</p>
      <h1 className={s.title}>Three directions for the week</h1>
      <p className={s.dek}>
        {view.firstVisit
          ? 'Each week the curator offers three directions. Choose the one you want to follow; the others stay open for another time.'
          : 'Choose the one you want to follow. The others aren’t set aside — they stay open, and may come back.'}
      </p>
      <GoingCards />
      <BackupNudge />

      {/* What these three were made with, and this week's tuning, in one fold: its line reads on its own
          ("four or five hours, several composers, known and new"), never a bare "Several · A mix" to decode.
          It opens by itself while a tuning waits to be asked for. */}
      <Twisty label="Made with your settings" className={s.twistyWrap} open={tuning} value={rework
        ? 'changed since'
        : [TIME[made.timePerWeek].words.replace(/ (of music )?a week$/, ''), BREADTH[made.breadth].glance, FAMILIARITY[made.familiarity].glance, ...(made.pairs ? ['pairs'] : []), ...moodWords(view.record.mood), ...(view.record.shaped ? [`shaped by you: ${SHAPED_WORDS[view.record.shaped.sketches] ?? view.record.shaped.sketches} of three`] : [])].join(', ')}>
        <dl className={s.settingsGlance}>
          <dt>Music each week</dt><dd>{TIME[made.timePerWeek].label} — {TIME[made.timePerWeek].words}</dd>
          <dt>How widely it ranges</dt><dd>{BREADTH[made.breadth].label} — {BREADTH[made.breadth].words}</dd>
          <dt>How well known</dt><dd>{FAMILIARITY[made.familiarity].label} — {FAMILIARITY[made.familiarity].words}</dd>
          <dt>Two perspectives</dt><dd>{made.pairs ? 'On — now and then one work in two recordings' : 'Off — each work once'}</dd>
        </dl>
        {rework ? (
          <>
            <p className={`${s.label} ${s.mtSm} ${s.mb0}`}>Changed since these three were offered</p>
            <ul className={s.changedSettings}>
              {changes.map((c) => <li key={c.setting}>{c.setting}: {c.was} → <strong>{c.now}</strong></li>)}
            </ul>
            <p className={s.settingHint}>Ask again below and the curator reworks these same three for it, keeping their ground.</p>
          </>
        ) : (
          <p className={s.settingHint}>Change them in <a href={href({ name: 'settings' })}>Settings → Your week of listening</a>, then ask again below: the curator reworks these same three for the change, keeping their ground.</p>
        )}
        <WeekMoodLine record={view.record} prefs={view.prefs} onAsk={askWithMood} busy={busy} asking={asking} onTuning={setTuning}
          onMood={(m) => setView((v) => v && { ...v, record: { ...v.record, mood: m.length ? m : undefined } })} />
      </Twisty>

      {/* The direction being built stays where it was tapped, saying so; the others wait. */}
      <ol className={s.options}>
        {view.options.map((o) => (
          <OptionEntry key={o.id} o={o} theme={o.returning ? view.themes.get(o.returning.themeId) : undefined} busy={busy || !curatorReady} choosing={choosing === o.id} onChoose={() => void choose(o)} shapedWeek={Boolean(view.record.shaped)} />
        ))}
      </ol>
      {!curatorReady && <NeedsKey to="choose a direction, or ask for anything below" />}

      {/* Below the three: every other way into the week, as one section of matching cards —
          each says what it does in a line, and opens its fields only when there are any. */}
      <section aria-label="Something else this week" className={s.whereNext}>
        <h2 className={s.sectionHead}>Or something else</h2>
        <p className={s.sectionGuide}>{rework
          ? 'Make a single evening of it, have these three reworked for your new settings, or take up one left open from an earlier week.'
          : 'None of the three? Make a single evening of it, ask for three new directions, or take up one left open from an earlier week.'}</p>

        {/* Disabled while a direction is being chosen: two programmes made at once for one week, and one would be set aside unasked. */}
        <SittingCard joinsThread={false} busy={busy} keyHint={false} />

        <div className={s.nextCard}>
          <h3 className={s.nextTitle}>{rework ? 'These three, for your new settings' : 'Three other directions'}</h3>
          <p className={s.quiet}>{rework
            ? `Your ${changes.length === 1 ? 'setting' : 'settings'} changed since these three were offered (${changes.map((c) => c.setting.toLowerCase()).join(', ')}). The curator keeps each direction’s ground — its subject, its thread — and reworks it to fit. Say below if you’d rather go somewhere new.`
            : 'The curator offers three more. These three stay open for another week.'}</p>
          {askOpen ? (
            <>
              <label className={s.visuallyHidden} htmlFor="mood">What are you in the mood for?</label>
              <textarea id="mood" className={s.textarea} maxLength={MAX_ASK} value={mood} onChange={(e) => setMood(e.target.value)} disabled={busy} placeholder="What are you in the mood for? (optional) · something quieter · Sibelius · a concerto I don’t know" />
              <CharCount value={mood} />
              <div className={`${s.actions} ${s.flush}`}>
                <button className={s.outlineButton} onClick={() => void askAgain()} disabled={busy || !curatorReady}>{asking ? (rework ? 'The curator is reworking them…' : 'The curator is finding three…') : (rework ? 'Rework these three' : 'Ask for three others')}</button>
                <button className={s.textButton} onClick={() => setAskOpen(false)} disabled={asking}>Not now</button>
              </div>
            </>
          ) : (
            <button className={s.outlineButton} onClick={() => setAskOpen(true)} disabled={busy || !curatorReady}>{rework ? 'Rework these three' : 'Ask for three others'}</button>
          )}
        </div>

        {view.openPaths.length > 0 && (
          <div className={s.nextCard}>
            <h3 className={s.nextTitle}>Left open from earlier weeks</h3>
            <p className={s.quiet}>{view.openPaths.length === 1 ? 'One direction' : `${view.openPaths.length} directions`} from earlier weeks, offered and not taken. Any of them can be this week’s instead.</p>
            <Twisty label={view.openPaths.length === 1 ? 'The direction' : 'The directions'} value={view.openPaths.length === 1 ? 'one, offered and not taken' : `${NUMBER_WORDS[view.openPaths.length] ?? view.openPaths.length}, offered and not taken`}>
              <OpenPaths paths={view.openPaths} nowKey={view.record.weekKey} busy={busy} onTaking={setChoosing} keyHint={false} />
            </Twisty>
          </div>
        )}
      </section>
    </div>
  )
}

/** Where a shaped direction came from: the sketch by name when the curator retitled it, and the nudge. */
function shapedWords(o: ProgrammeOption): string {
  const named = o.shaped && o.shaped.title.toLowerCase() !== o.title.toLowerCase() ? ` “${o.shaped.title}”` : ''
  return `From your sketch${named}${o.shaped?.nudge ? `, nudged: “${o.shaped.nudge}”` : ''}`
}

/** "shaped by you: two of three" */
const SHAPED_WORDS = ['none', 'one', 'two', 'three']

function OptionEntry({ o, theme, busy, choosing, onChoose, shapedWeek = false }: { o: ProgrammeOption; theme?: Theme; busy: boolean; choosing: boolean; onChoose: () => void; shapedWeek?: boolean }) {
  return (
    <li className={s.option} aria-busy={choosing || undefined}>
      <div className={s.optionHead}>
        <span className={s.optionNumber}>{o.position}</span>
        <h2 className={s.optionTitle}>{o.title}</h2>
      </div>
      <div className={s.optionBody}>
        <p className={`${s.mood} ${s.mt2xs}`}>{MOOD_WORD[o.mood]}{o.form ? ` · ${WEEK_FORMS[o.form]}` : ''}</p>
        {/* A week shaped beforehand says where each came from: the listener's sketch, or the curator's own. */}
        {shapedWeek && (
          <p className={s.faint}>{o.shaped ? shapedWords(o) : 'The curator’s own'}</p>
        )}
        <p>{o.pitch}</p>
        {/* The words describe the direction, so they say so; the curator's reason says it's for you. */}
        <Traits label="Character" words={o.character} />
        {o.why && <p className={s.quiet}><span className={s.label}>For you</span><br />{o.why}</p>}
        {o.returning && (
          <div className={`${s.continuity} ${s.flush} ${s.mtSm}`}>
            <p className={`${s.eyebrow} ${s.mb0}`}>
              {/* The thread by name only: the curator's note below says when and how, and saying it twice read as an echo. */}
              Returning{theme ? ` · “${theme.title}”` : ''}
            </p>
            <p className={s.flush}>{o.returning.note}</p>
          </div>
        )}
        <div className={s.actions}>
          <button className={s.outlineButton} onClick={onChoose} disabled={busy}>{choosing ? 'The curator is building it…' : 'Take this direction →'}</button>
        </div>
      </div>
    </li>
  )
}


/** A small count in words, as the rest of the page writes them. */
const NUMBER_WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/** This week's tuning as the end of the settings line: "quieter and wider this week". */
function moodWords(mood?: WeekMood[]): string[] {
  const words = WEEK_MOODS.filter((m) => mood?.includes(m.value)).map((m) => m.label.toLowerCase())
  return words.length ? [`${words.join(' and ')} this week`] : []
}

/**
 * "Tune this week" (once "This week, differently"): four words to tap, for this week only — a mood,
 * not a standing preference (Settings holds those). Saved as it's tapped; the
 * directions already offered were made without it, so it offers three that
 * know it. The programme, and "more of this theme", read it from the week.
 */
function WeekMoodLine({ record, prefs, onAsk, onMood, onTuning, busy, asking }: { record: WeekRecord; prefs: ListenerPreferences; onAsk: () => Promise<boolean>; onMood: (mood: WeekMood[]) => void; onTuning: (waiting: boolean) => void; busy: boolean; asking: boolean }) {
  const { journey, say, curatorReady } = useServices()
  const [mood, setMood] = useState<WeekMood[]>(record.mood ?? [])
  const [changed, setChangedState] = useState(false)
  // The fold around it stays open while a tuning waits to be asked for.
  const setChanged = (v: boolean) => { setChangedState(v); onTuning(v) }
  // Tuned away from what the three were made with (or a setting moved): asking reworks the same three.
  const reworks = directionChanges(record.madeWith, prefs, mood).length > 0
  async function toggle(m: WeekMood) {
    const was = mood
    const next = mood.includes(m) ? mood.filter((x) => x !== m) : [...mood, m]
    setMood(next)
    setChanged(true)
    try {
      await journey.setWeekMood(next)
      onMood(next)
    } catch (e) {
      setMood(was)
      say(messageOf(e), 'danger')
    }
  }
  return (
    <>
      <p className={`${s.label} ${s.mtSm}`}>Tune this week</p>
      {/* The same chips as every other choice in the app: tap to add, tap again to take away. */}
      <div className={s.chipRow} role="group" aria-label="Tune this week">
        {WEEK_MOODS.map((m) => (
          <button key={m.value} type="button" className={`${s.chip} ${mood.includes(m.value) ? s.chipOn : ''}`} aria-pressed={mood.includes(m.value)} onClick={() => void toggle(m.value)} disabled={busy}>{m.label}</button>
        ))}
      </div>
      {/* The button stays while the curator is asked, saying so; it goes once the three have come (and stays to try again if they didn't). */}
      {changed && (!record.madeWith || reworks) && (
        <button type="button" className={`${s.outlineButton} ${s.smallButton}`} disabled={busy || !curatorReady} onClick={() => { void onAsk().then((done) => { if (done) setChanged(false) }) }}>
          {reworks
            ? (asking ? 'The curator is reworking them…' : 'Rework these three with this in mind')
            : (asking ? 'The curator is finding three…' : 'Three directions with this in mind')}
        </button>
      )}
    </>
  )
}
