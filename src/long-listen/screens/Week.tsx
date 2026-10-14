import { useCallback, useEffect, useState } from 'react'
import { GoingCards } from '../components/Going'
import { WEEK_FORMS, WEEK_MOODS, type ListenerPreferences, type ProgrammeOption, type Theme, type WeekMood, type WeekRecord } from '../domain/types'
import { BREADTH, FAMILIARITY, TIME } from '../domain/exploration'
import { directionChanges } from '../domain/directionChanges'
import { sinceWords } from '../domain/week'
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
      <h1 className={s.title}>Three ways into the week</h1>
      <p className={s.dek}>
        {view.firstVisit
          ? 'Each week the curator offers three directions. Choose the one you want to follow; the others stay open for another time.'
          : 'Choose the one you want to follow. The others aren’t set aside — they stay open, and may come back.'}
      </p>
      <GoingCards />

      <WeekMoodLine record={view.record} prefs={view.prefs} onAsk={askWithMood} busy={busy} asking={asking}
        onMood={(m) => setView((v) => v && { ...v, record: { ...v.record, mood: m.length ? m : undefined } })} />

      {/* What these three were made with, each setting under the name Settings gives it —
          never a bare "several · a mix" the listener has to decode. */}
      {/* Folded by default: the line says what's set; open it only to read what each means. */}
      <Twisty label="Made with your settings" value={rework
        ? 'changed since'
        : `${TIME[made.timePerWeek].label} · ${BREADTH[made.breadth].label} · ${FAMILIARITY[made.familiarity].label}${made.pairs ? ' · pairs' : ''}`}>
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
      </Twisty>

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
        <p className={s.sectionGuide}>{rework
          ? 'Make a single evening of it, have these three reworked for your new settings, or take up one left open from an earlier week.'
          : 'None of the three? Make a single evening of it, ask for three new directions, or take up one left open from an earlier week.'}</p>

        {/* Disabled while a direction is being chosen: two programmes made at once for one week, and one would be set aside unasked. */}
        <SittingCard joinsThread={false} busy={busy} keyHint={false} />

        <div className={s.nextCard}>
          <h3 className={s.nextTitle}>{rework ? 'These three, for your new settings' : 'Three other directions'}</h3>
          <p className={s.quiet}>{rework
            ? `Your ${changes.length === 1 ? 'setting' : 'settings'} changed since these three were offered (${changes.map((c) => c.setting.toLowerCase()).join(', ')}). The curator keeps each direction’s ground — its subject, its thread — and reworks it to fit. Say below if you’d rather go somewhere new.`
            : 'The curator offers three more. These three stay open as paths for another week.'}</p>
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
        {/* The words describe the direction, so they say so; the curator's reason says it's for you. */}
        <Traits label="Character" words={o.character} />
        {o.why && <p className={s.quiet}><span className={s.label}>Why for you</span><br />{o.why}</p>}
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
 * "Tune this week" (once "This week, differently"): four words to tap, for this week only — a mood,
 * not a standing preference (Settings holds those). Saved as it's tapped; the
 * directions already offered were made without it, so it offers three that
 * know it. The programme, and "more of this theme", read it from the week.
 */
function WeekMoodLine({ record, prefs, onAsk, onMood, busy, asking }: { record: WeekRecord; prefs: ListenerPreferences; onAsk: () => Promise<boolean>; onMood: (mood: WeekMood[]) => void; busy: boolean; asking: boolean }) {
  const { journey, say, curatorReady } = useServices()
  const [mood, setMood] = useState<WeekMood[]>(record.mood ?? [])
  const [changed, setChanged] = useState(false)
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
    // Folded until wanted; it opens by itself while a change is waiting to be asked for.
    <Twisty label="Tune this week" value={mood.length ? WEEK_MOODS.filter((m) => mood.includes(m.value)).map((m) => m.label).join(', ') : 'no changes'} open={changed}>
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
    </Twisty>
  )
}
