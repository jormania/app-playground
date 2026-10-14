import { useCallback, useEffect, useState } from 'react'
import { WEEK_FORMS, WEEK_MOODS, type ListenerPreferences, type ProgrammeOption, type Theme, type WeekMood, type WeekRecord } from '../domain/types'
import { BREADTH, FAMILIARITY, TIME } from '../domain/exploration'
import { sinceWords, weekFromKey } from '../domain/week'
import { useServices } from '../app/services'
import { go, href } from '../app/router'
import { CuratorUnavailable } from '../curation/api'
import { verifyProgramme } from '../spotify/verify'
import { CharCount, MAX_ASK, NeedsKey, Problem, Waiting, messageOf } from '../components/common'
import { MOOD_WORD, OpenPaths } from '../components/OpenPaths'
import { GUIDE_URL } from '../app/links'
import { ProgrammeScreen } from './Programme'
import { SittingCard } from '../components/SittingCard'
import s from '../styles/editorial.module.css'

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

  const load = useCallback(async () => {
    setError(null)
    try {
      const firstVisit = (await repo.weeks.all()).length === 0
      const record = await journey.ensureWeek()
      const options = await repo.options.many(record.optionIds)
      const openPaths = (await repo.options.all())
        .filter((o) => o.status === 'open' && o.weekKey < record.weekKey)
        .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
        .slice(0, 9)
      const themes = new Map((await repo.themes.all()).map((t) => [t.id, t]))
      setView({ record, options, openPaths, themes, firstVisit, prefs: await repo.preferences() })
    } catch (e) {
      setError(e)
    }
  }, [journey, repo])

  // Reload on data changes and when the curator setup changes (the key, demo).
  useEffect(() => { void load() }, [load, version, settings.anthropicKey])

  async function choose(o: ProgrammeOption) {
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
    const locked = error instanceof CuratorUnavailable && (error.code === 'locked' || error.code === 'bad-key')
    return (
      <div>
        <p className={s.eyebrow}>{journey.currentWeek().label}</p>
        <h1 className={s.titleSmall}>{locked ? 'Before the first programme' : 'This week is still being prepared'}</h1>
        <Problem error={error} onRetry={locked ? undefined : () => void load()} />
        {locked && <p><a href="#/settings">Open Settings</a> to add your Anthropic key and test it — it takes a minute. The <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">guide</a> shows where to get one.</p>}
      </div>
    )
  }
  // One thing at a time: choosing a direction and asking for others both rewrite the week.
  const busy = asking || choosing !== null
  if (!view) return <Waiting>The curator is choosing this week’s directions…</Waiting>
  if (view.record.programmeId) return <ProgrammeScreen id={view.record.programmeId} asThisWeek />

  const week = weekFromKey(view.record.weekKey)
  return (
    <div>
      <p className={s.eyebrow}>Week {week.number} · {week.label}</p>
      <h1 className={s.title}>Three ways into the week</h1>
      <p className={s.dek}>
        {view.firstVisit
          ? 'Each week the curator offers three directions. Choose the one you want to follow; the others stay open for another time.'
          : 'Choose the one you want to follow. The others aren’t set aside — they stay open, and may come back.'}
      </p>

      <WeekMoodLine record={view.record} onAsk={askWithMood} busy={busy} asking={asking} />

      {/* What these three were made with, each setting under the name Settings gives it —
          never a bare "several · a mix" the listener has to decode. */}
      {/* Folded by default: the line says what's set; open it only to read what each means. */}
      <details className={s.twisty}>
        <summary>
          <span className={s.twistyLabel}>Made with your settings</span>
          <span className={s.twistyValue}>{TIME[view.prefs.timePerWeek].label} · {BREADTH[view.prefs.breadth].label} · {FAMILIARITY[view.prefs.familiarity].label}{view.prefs.pairs ? ' · pairs' : ''}</span>
        </summary>
        <dl className={s.settingsGlance}>
          <dt>Music each week</dt><dd>{TIME[view.prefs.timePerWeek].label} — {TIME[view.prefs.timePerWeek].words}</dd>
          <dt>How widely it ranges</dt><dd>{BREADTH[view.prefs.breadth].label} — {BREADTH[view.prefs.breadth].words}</dd>
          <dt>How well known</dt><dd>{FAMILIARITY[view.prefs.familiarity].label} — {FAMILIARITY[view.prefs.familiarity].words}</dd>
          <dt>Two perspectives</dt><dd>{view.prefs.pairs ? 'On — now and then one work in two recordings' : 'Off — each work once'}</dd>
        </dl>
        <p className={s.settingHint}>Change them in <a href={href({ name: 'settings' })}>Settings → Your week of listening</a>, then ask for three others below.</p>
      </details>

      {/* The direction being built stays where it was tapped, saying so; the others wait. */}
      <ol className={s.options}>
        {view.options.map((o) => (
          <OptionEntry key={o.id} o={o} theme={o.returning ? view.themes.get(o.returning.themeId) : undefined} weekKey={view.record.weekKey} busy={busy || !curatorReady} choosing={choosing === o.id} onChoose={() => void choose(o)} />
        ))}
      </ol>
      {!curatorReady && <NeedsKey to="choose a direction, or ask for anything below" />}

      {/* Below the three: every other way into the week, as one section of matching cards —
          each says what it does in a line, and opens its fields only when there are any. */}
      <section aria-label="Other ways into the week" className={s.whereNext}>
        <h2 className={s.sectionHead}>Or another way in</h2>
        <p className={s.sectionGuide}>None of the three? Make a single evening of it, ask for three new directions, or take up one left open from an earlier week.</p>

        {/* Disabled while a direction is being chosen: two programmes made at once for one week, and one would be set aside unasked. */}
        <SittingCard joinsThread={false} busy={busy} keyHint={false} />

        <div className={s.nextCard}>
          <h3 className={s.nextTitle}>Three other directions</h3>
          <p className={s.quiet}>The curator offers three more. These three stay open as paths for another week.</p>
          {askOpen ? (
            <>
              <label className={s.visuallyHidden} htmlFor="mood">What are you in the mood for?</label>
              <textarea id="mood" className={s.textarea} maxLength={MAX_ASK} value={mood} onChange={(e) => setMood(e.target.value)} disabled={busy} placeholder="What are you in the mood for? (optional) · something quieter · Sibelius · a concerto I don’t know" />
              <CharCount value={mood} />
              <div className={`${s.actions} ${s.flush}`}>
                <button className={s.outlineButton} onClick={() => void askAgain()} disabled={busy || !curatorReady}>{asking ? 'The curator is finding three…' : 'Ask for three others'}</button>
                <button className={s.textButton} onClick={() => setAskOpen(false)} disabled={asking}>Not now</button>
              </div>
            </>
          ) : (
            <button className={s.outlineButton} onClick={() => setAskOpen(true)} disabled={busy || !curatorReady}>Ask for three others</button>
          )}
        </div>

        {view.openPaths.length > 0 && (
          <div className={s.nextCard}>
            <h3 className={s.nextTitle}>A path left open</h3>
            <p className={s.quiet}>{view.openPaths.length === 1 ? 'One direction' : `${view.openPaths.length} directions`} from earlier weeks, offered and not taken. Any of them can be this week’s instead.</p>
            <details>
              <summary className={s.textButton}>{view.openPaths.length === 1 ? 'Show it' : `Show all ${view.openPaths.length}`}</summary>
              <OpenPaths paths={view.openPaths} nowKey={view.record.weekKey} busy={busy} onTaking={setChoosing} keyHint={false} />
            </details>
          </div>
        )}
      </section>
    </div>
  )
}

function OptionEntry({ o, theme, weekKey, busy, choosing, onChoose }: { o: ProgrammeOption; theme?: Theme; weekKey: string; busy: boolean; choosing: boolean; onChoose: () => void }) {
  return (
    <li className={s.option} aria-busy={choosing || undefined}>
      <div className={s.optionHead}>
        <span className={s.optionNumber}>{o.position}</span>
        <h2 className={s.optionTitle}>{o.title}</h2>
      </div>
      <div className={s.optionBody}>
        <p className={`${s.mood} ${s.mt2xs}`}>{MOOD_WORD[o.mood]}{o.form ? ` · ${WEEK_FORMS[o.form]}` : ''}</p>
        <p>{o.pitch}</p>
        <p className={s.character}>{o.character.join(' · ')}</p>
        {o.why && <p className={s.quiet}>{o.why}</p>}
        {o.returning && (
          <div className={`${s.continuity} ${s.flush} ${s.mtSm}`}>
            <p className={`${s.eyebrow} ${s.mb0}`}>
              Returning{theme ? ` · “${theme.title}”, first explored ${sinceWords(theme.firstIntroduced, weekKey)}` : ''}
            </p>
            <p className={s.flush}>{o.returning.note}</p>
          </div>
        )}
        <div className={s.actions}>
          <button className={s.outlineButton} onClick={onChoose} disabled={busy}>{choosing ? 'The curator is building it…' : 'Listen this way →'}</button>
        </div>
      </div>
    </li>
  )
}


/**
 * "This week, differently": four words to tap, for this week only — a mood,
 * not a standing preference (Settings holds those). Saved as it's tapped; the
 * directions already offered were made without it, so it offers three that
 * know it. The programme, and "more of this theme", read it from the week.
 */
function WeekMoodLine({ record, onAsk, busy, asking }: { record: WeekRecord; onAsk: () => Promise<boolean>; busy: boolean; asking: boolean }) {
  const { journey, say, curatorReady } = useServices()
  const [mood, setMood] = useState<WeekMood[]>(record.mood ?? [])
  const [changed, setChanged] = useState(false)
  async function toggle(m: WeekMood) {
    const was = mood
    const next = mood.includes(m) ? mood.filter((x) => x !== m) : [...mood, m]
    setMood(next)
    setChanged(true)
    try {
      await journey.setWeekMood(next)
    } catch (e) {
      setMood(was)
      say(messageOf(e), 'danger')
    }
  }
  return (
    // Folded until wanted; it opens by itself while a change is waiting to be asked for.
    <details className={s.twisty} open={changed || undefined}>
      <summary>
        <span className={s.twistyLabel}>This week, differently</span>
        <span className={s.twistyValue}>{mood.length ? WEEK_MOODS.filter((m) => mood.includes(m.value)).map((m) => m.label).join(', ') : 'as usual'}</span>
      </summary>
      <div className={s.twistyBody}>
      {/* The same chips as every other choice in the app: tap to add, tap again to take away. */}
      <div className={s.chipRow} role="group" aria-label="This week, differently">
        {WEEK_MOODS.map((m) => (
          <button key={m.value} type="button" className={`${s.chip} ${mood.includes(m.value) ? s.chipOn : ''}`} aria-pressed={mood.includes(m.value)} onClick={() => void toggle(m.value)} disabled={busy}>{m.label}</button>
        ))}
      </div>
      {/* The button stays while the curator is asked, saying so; it goes once the three have come (and stays to try again if they didn't). */}
      {changed && (
        <button type="button" className={`${s.outlineButton} ${s.smallButton}`} disabled={busy || !curatorReady} onClick={() => { void onAsk().then((done) => { if (done) setChanged(false) }) }}>
          {asking ? 'The curator is finding three…' : 'Three directions with this in mind'}
        </button>
      )}
      </div>
    </details>
  )
}
