import { useCallback, useEffect, useState } from 'react'
import { WEEK_FORMS, WEEK_MOODS, type ListenerPreferences, type ProgrammeOption, type Theme, type WeekMood, type WeekRecord } from '../domain/types'
import { BREADTH, FAMILIARITY, TIME } from '../domain/exploration'
import { sinceWords, weekFromKey } from '../domain/week'
import { useServices } from '../app/services'
import { go } from '../app/router'
import { CuratorUnavailable } from '../curation/api'
import { verifyProgramme } from '../spotify/verify'
import { Problem, Waiting } from '../components/common'
import { GUIDE_URL } from '../app/links'
import { ProgrammeScreen } from './Programme'
import s from '../styles/editorial.module.css'

const MOOD_WORD = { immersive: 'Immersive', curious: 'Curious', adventurous: 'Adventurous' } as const

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
  const { journey, repo, version, bump, settings, spotify } = useServices()
  const [view, setView] = useState<WeekView | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [chooseError, setChooseError] = useState<unknown>(null)
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

  async function choose(o: ProgrammeOption, fromEarlier = false) {
    setChoosing(o.id)
    setChooseError(null)
    try {
      const p = fromEarlier ? await journey.takeOpenPath(o.id) : await journey.choose(o.id)
      // Start confirming its recordings now, before the page has even drawn.
      void verifyProgramme(repo, spotify, p.id, bump).catch(() => {})
      bump()
      go({ name: 'programme', id: p.id })
    } catch (e) {
      setChooseError(e)
    } finally {
      setChoosing(null)
    }
  }

  async function askAgain() {
    setAsking(true)
    setChooseError(null)
    try {
      await journey.offerOtherDirections(mood.trim() || undefined)
      setMood('')
      setAskOpen(false)
      bump()
    } catch (e) {
      setChooseError(e)
    } finally {
      setAsking(false)
    }
  }

  /** The mood changed after the directions were made: three new ones that know it. */
  async function askWithMood() {
    setAsking(true)
    setChooseError(null)
    try {
      // The mood is already on the week record; the curator reads it from there.
      await journey.offerOtherDirections()
      bump()
    } catch (e) {
      setChooseError(e)
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
  if (view.record.programmeId) return <ProgrammeScreen id={view.record.programmeId} />

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

      <WeekMoodLine record={view.record} onAsk={() => { void askWithMood() }} busy={busy} />

      <p className={s.faint}>
        Your week: {TIME[view.prefs.timePerWeek].words} · {BREADTH[view.prefs.breadth].label.toLowerCase()} · {FAMILIARITY[view.prefs.familiarity].label.toLowerCase()}
        {view.prefs.pairs ? ' · with side-by-side pairs' : ''}. <a href="#/settings">Change in Settings</a>, then ask for three others.
      </p>

      {chooseError != null && <Problem error={chooseError} />}
      {choosing && <Waiting>The curator is building your programme — choosing works, recordings, and what to listen for…</Waiting>}

      <ol className={s.options}>
        {view.options.map((o) => (
          <OptionEntry key={o.id} o={o} theme={o.returning ? view.themes.get(o.returning.themeId) : undefined} weekKey={view.record.weekKey} busy={busy} onChoose={() => choose(o)} />
        ))}
      </ol>

      <div className={s.block}>
        {!askOpen ? (
          <button className={s.textButton} onClick={() => setAskOpen(true)} disabled={busy}>None of these? Ask for three others</button>
        ) : (
          <div className={s.feedback}>
            <label className={s.feedbackQ} htmlFor="mood">What are you in the mood for? <span className={s.faint}>(optional)</span></label>
            <textarea id="mood" className={s.textarea} value={mood} onChange={(e) => setMood(e.target.value)} placeholder="Something quieter after a long week · Sibelius · a concerto I don’t know" />
            <div className={s.actions}>
              <button className={`${s.outlineButton} ${s.smallButton}`} onClick={askAgain} disabled={busy}>{asking ? 'The curator is thinking again…' : 'Ask'}</button>
              <button className={s.textButton} onClick={() => setAskOpen(false)} disabled={asking}>Not now</button>
            </div>
            <p className={s.note}>These three stay open as paths for another week.</p>
          </div>
        )}
      </div>

      {view.openPaths.length > 0 && (
        <details className={s.block}>
          <summary className={s.textButton}>Or take a path from an earlier week</summary>
          <ul className={s.entries}>
            {view.openPaths.map((o) => (
              <li key={o.id} className={s.entry}>
                <p className={s.mood}>{MOOD_WORD[o.mood]} · offered {sinceWords(o.weekKey, view.record.weekKey)}</p>
                <h3 className={s.entryTitle}>{o.title}</h3>
                <p className={s.quiet}>{o.pitch}</p>
                <button className={`${s.outlineButton} ${s.smallButton}`} disabled={busy} onClick={() => choose(o, true)}>Take this path now</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function OptionEntry({ o, theme, weekKey, busy, onChoose }: { o: ProgrammeOption; theme?: Theme; weekKey: string; busy: boolean; onChoose: () => void }) {
  return (
    <li className={s.option}>
      <div className={s.optionHead}>
        <span className={s.optionNumber}>{o.position}</span>
        <h2 className={s.optionTitle}>{o.title}</h2>
      </div>
      <div className={s.optionBody}>
        <p className={s.mood} style={{ marginTop: 'var(--space-2xs)' }}>{MOOD_WORD[o.mood]}{o.form ? ` · ${WEEK_FORMS[o.form]}` : ''}</p>
        <p>{o.pitch}</p>
        <p className={s.character}>{o.character.join(' · ')}</p>
        {o.why && <p className={s.quiet}>{o.why}</p>}
        {o.returning && (
          <div className={s.continuity} style={{ margin: 'var(--space-sm) 0 0' }}>
            <p className={s.eyebrow} style={{ marginBottom: 0 }}>
              Returning{theme ? ` · “${theme.title}”, first explored ${sinceWords(theme.firstIntroduced, weekKey)}` : ''}
            </p>
            <p style={{ margin: 0 }}>{o.returning.note}</p>
          </div>
        )}
        <div className={s.actions}>
          <button className={s.outlineButton} onClick={onChoose} disabled={busy}>Listen this way →</button>
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
function WeekMoodLine({ record, onAsk, busy }: { record: WeekRecord; onAsk: () => void; busy: boolean }) {
  const { journey, bump } = useServices()
  const [mood, setMood] = useState<WeekMood[]>(record.mood ?? [])
  const [changed, setChanged] = useState(false)
  async function toggle(m: WeekMood) {
    const next = mood.includes(m) ? mood.filter((x) => x !== m) : [...mood, m]
    setMood(next)
    setChanged(true)
    await journey.setWeekMood(next)
  }
  return (
    <div className={s.weekMood}>
      <p className={s.settingLabel}>This week, differently</p>
      {/* The same chips as every other choice in the app: tap to add, tap again to take away. */}
      <div className={s.chipRow} role="group" aria-label="This week, differently">
        {WEEK_MOODS.map((m) => (
          <button key={m.value} type="button" className={`${s.chip} ${mood.includes(m.value) ? s.chipOn : ''}`} aria-pressed={mood.includes(m.value)} onClick={() => void toggle(m.value)}>{m.label}</button>
        ))}
      </div>
      {changed && (
        <button type="button" className={`${s.outlineButton} ${s.smallButton}`} disabled={busy} onClick={() => { setChanged(false); onAsk(); bump() }}>
          {busy ? 'Asking…' : 'Three directions with this in mind'}
        </button>
      )}
    </div>
  )
}
