import { useMemo, useState } from 'react'
import { ArrowRight, Shuffle, Download } from 'lucide-react'
import { navigate } from '../app/router'
import { useMatDays } from '../app/state'
import { SessionCard } from '../components/SessionCard'
import { Chip, Empty, SectionHead } from '../components/ui'
import { EMPTY_FILTERS, INTENTIONS, matchesIntention, type Filters } from '../lib/filter'
import { localDate, summarise, thisWeek } from '../lib/practice'
import { DEFAULT_CONSTRAINTS, buildProfile, surprise } from '../lib/recommend'
import { seedFromText, seededRandom } from '../lib/seeded'
import { PHYSICAL_FOCUS } from '../domain/vocabulary'
import { StartPractice } from '../components/StartPractice'
import type { SeriesDef } from '../domain/types'
import { doneDays, linkedSessions, nextDay } from '../lib/series'
import { useSeries } from './Series'
import { hrefOf } from '../app/router'
import { backupNudge, daysAway, dueForRepeat, gentleReturn, isUnavailable, momentOf, RETURN_AFTER_DAYS, shortTitle } from '../lib/today'
import { useSaveBackup } from '../app/backup'
import { WeekRing } from '../components/WeekRing'
import { formatDay } from '../lib/practice'
import { NextDay, PracticeBlock } from '../components/NextDay'
import { SeriesBand } from '../components/SeriesBand'
import s from './screens.module.css'

function ContinueSeries({ def, primary = false, soft = false }: { def: SeriesDef; primary?: boolean; soft?: boolean }) {
  const { done, next, linked, pace, started } = useSeries(def)
  if (!next) return null
  const day = linked.get(next)
  const open = <a className={s.textLink} href={hrefOf({ name: 'seriesDetail', id: def.id })}>Open series</a>
  // The lead series is drawn exactly as on its own page: the progress band, then
  // the next day. Only the kicker and the companion link differ.
  if (primary) {
    return (
      <section className={s.journey} aria-label="Your next practice">
        <SeriesBand def={def} done={done.size} started={started} pace={pace} name />
        <div className={s.upNext}>
          <span className={s.todayKicker}>Your next practice</span>
          <NextDay def={def} day={next} session={day} withSeries={false} secondary={open} actionsBeside />
        </div>
      </section>
    )
  }
  return (
    <div className={s.continue}>
      <NextDay def={def} day={next} session={day} withSeries
        meta={`${done.size} of ${def.length} done`}
        note={soft ? `${def.unit} ${next} is waiting whenever you are` : pace?.today}
        secondary={open} />
    </div>
  )
}

/** "Up to N minutes": the three lengths that cover most days. */
const TIME_CHOICES = [10, 20, 30]

function greeting(hour: number) {
  if (hour < 5) return 'Late evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** One practice for today, re-picked when you say how long you have. */
type PickKind = 'moment' | 'return'

/** One practice for today: shaped by the hour, or by a gentle return after time away. */
function useTodayPick(kind: PickKind) {
  const { sessions, userData, history, preferences } = useMatDays()
  const today = localDate()
  const hour = new Date().getHours()
  const moment = useMemo(() => momentOf(hour), [hour])
  const [minutes, setMinutes] = useState<number | null>(null)
  const [turn, setTurn] = useState(0)
  const suits = kind === 'return' ? gentleReturn : moment.suits
  const pick = useMemo(() => {
    const rand = seededRandom(seedFromText(`${today}:${kind}:${moment.id}:${minutes ?? 'any'}:${turn}`))
    const c = minutes ? { ...DEFAULT_CONSTRAINTS, maxDuration: minutes } : DEFAULT_CONSTRAINTS
    return surprise('match', c, { sessions, userData, history, preferences, shown: [], today, only: suits }, rand)
  }, [sessions, userData, history, preferences, today, minutes, turn, kind, moment.id, suits])
  const reason = pick && suits?.(pick.session)
    ? (kind === 'return' ? 'Short and gentle, to land back on the mat' : moment.reason)
    : pick?.reason
  return { pick, reason, minutes, setMinutes, setTurn, moment }
}

function TodayPick({ state, quiet = false, kicker }: { state: ReturnType<typeof useTodayPick>; quiet?: boolean; kicker?: string }) {
  const { seriesDefs } = useMatDays()
  const { pick, reason, minutes, setMinutes, setTurn, moment } = state
  const name = pick ? shortTitle(pick.session, seriesDefs) : null
  // Same shape as the series' next day: label, title, meta, the why as a note, then Start.
  const times = (
    <div className={s.todayTimes} role="group" aria-label="How long have you got?">
      {TIME_CHOICES.map((m) => (
        <button key={m} type="button" aria-pressed={minutes === m} onClick={() => { setMinutes(minutes === m ? null : m); setTurn(0) }}>
          {m} min
        </button>
      ))}
      <button type="button" aria-label="Another idea" onClick={() => setTurn((t) => t + 1)}><Shuffle size={16} /></button>
    </div>
  )
  const more = <a href="#/surprise" className={s.textLink}>More ways to choose</a>
  return (
    <div className={quiet ? s.continue : s.todayCard}>
      {!quiet && <span className={s.todayKicker}>{kicker ?? moment.kicker}</span>}
      {pick && name ? (
        <PracticeBlock session={pick.session}
          label={name.label ?? pick.session.styles[0]}
          title={name.title}
          meta={pick.session.physicalFocus.slice(0, 2).join(' · ') || undefined}
          note={reason}
          extra={times}
          start={<StartPractice session={pick.session} compact label="Start" />}
          secondary={more} />
      ) : (
        <>
          <p className={s.muted}>Nothing fits {minutes ? `${minutes} minutes` : 'right now'}. Try another length.</p>
          {times}
          <div className={s.todayActions}>{more}</div>
        </>
      )}
    </div>
  )
}

/** Your history lives only in this browser: a gentle reminder to keep a copy. */
function BackupNudge({ count }: { count: number }) {
  const { preferences, savePreferences } = useMatDays()
  const save = useSaveBackup()
  return (
    <div className={s.nudge} role="note">
      <p>
        <strong>{count} {count === 1 ? 'practice' : 'practices'} since your last backup.</strong>{' '}
        Your history is kept only on this phone. Save a copy to Drive or your files, and it’s safe if the browser clears its data.
      </p>
      <div className={s.row}>
        <button type="button" className={s.nudgePrimary} onClick={() => void save()}><Download size={15} /> Save a backup</button>
        <button type="button" className={s.textLink} onClick={() => savePreferences({ ...preferences, backupNudgeDismissedAt: new Date().toISOString() })}>Not now</button>
      </div>
    </div>
  )
}

export function Discover() {
  const state = useMatDays()
  const { sessions, history, userData, preferences, byId, setFilters, seriesDefs, seriesProgress, lastPractised } = state
  const activeSeries = seriesDefs.filter((d) => seriesProgress[d.id]?.status === 'active')
  const today = localDate()
  const [showAreas, setShowAreas] = useState(false)

  const explore = (f: Partial<Filters>) => {
    setFilters({ ...EMPTY_FILTERS, ...f })
    navigate({ name: 'explore' })
  }

  const recent = useMemo(() => {
    const seen = new Set<string>()
    return history.filter((h) => !seen.has(h.sessionId) && seen.add(h.sessionId)).map((h) => byId.get(h.sessionId)).filter(Boolean).slice(0, 8)
  }, [history, byId])

  const favourites = useMemo(() => sessions.filter((x) => userData[x.id]?.favourite && !isUnavailable(x)).slice(0, 8), [sessions, userData])
  const due = useMemo(() => dueForRepeat(sessions, userData, lastPractised, today), [sessions, userData, lastPractised, today])

  // After a few days away, Today opens with something gentle; the series waits, without a "behind".
  const away = daysAway(history, today)
  const returning = away != null && away >= RETURN_AFTER_DAYS
  const todayPick = useTodayPick(returning ? 'return' : 'moment')
  const pickId = todayPick.pick?.session.id

  const suggestions = useMemo(() => {
    const rand = seededRandom(seedFromText(`${today}:rail`))
    // Never the same session as Today's own pick.
    const shown: string[] = pickId ? [pickId] : []
    const out: { id: string; reason: string }[] = []
    for (let i = 0; i < 4; i++) {
      const pick = surprise('match', DEFAULT_CONSTRAINTS, { sessions, userData, history, preferences, shown, today }, rand)
      if (!pick || shown.includes(pick.session.id)) break
      shown.push(pick.session.id)
      out.push({ id: pick.session.id, reason: pick.reason })
    }
    return out
  }, [sessions, userData, history, preferences, today, pickId])

  const quietStyles = useMemo(() => {
    const p = buildProfile(sessions, history, today)
    const real = sessions.filter((x) => !x.isDemo)
    const present = new Set((real.length >= 10 ? real : sessions).flatMap((x) => x.styles))
    return [...present].sort((a, b) => (p.allStyleCounts[a] ?? 0) - (p.allStyleCounts[b] ?? 0) || a.localeCompare(b)).slice(0, 6)
  }, [sessions, history, today])

  const areas = useMemo(() => PHYSICAL_FOCUS.filter((f) => sessions.some((x) => matchesIntention(x, `area:${f}`))), [sessions])

  const week = summarise(thisWeek(history, today))
  const backup = backupNudge(history, preferences, today)
  // A series with a day left leads Today; one that's all done waits on the Series tab to be completed.
  const withNext = activeSeries.filter((d) => {
    const p = seriesProgress[d.id]
    return nextDay(d, doneDays(d, p, linkedSessions(d, sessions, p), history, sessions)) != null
  })
  const [lead, ...otherSeries] = withNext
  const leadHasNext = !!lead && !returning

  if (state.ready && sessions.length === 0) {
    return (
      <Empty title="Your library is empty">
        <p>Bring in Adriene’s videos from Settings with “Import the whole channel”, or add one by pasting a YouTube link. Her series are ready to follow meanwhile.</p>
        <a className={s.textLink} href="#/settings">Open Settings</a>
        <a className={s.textLink} href="#/series">Browse series</a>
      </Empty>
    )
  }

  return (
    <>
      <section className={s.todayHead}>
        <div>
          <p className={s.kicker}>{returning ? 'Welcome back' : greeting(new Date().getHours())}</p>
          <h1 className={s.heroTitle}>{returning ? <>Ease back in, <em>gently</em>.</> : <>What does your body <em>need</em> today?</>}</h1>
        </div>
        <WeekRing minutes={week.minutes} sessions={week.sessions} target={preferences.weeklyTargetMinutes} />
      </section>

      {leadHasNext
        ? <ContinueSeries def={lead} primary />
        : <TodayPick state={todayPick} kicker={returning ? `${away} days away · something short and soft` : undefined} />}
      {returning && lead && <ContinueSeries def={lead} soft />}

      {backup != null && <BackupNudge count={backup} />}

      {otherSeries.length > 0 && (
        <>
          <SectionHead title="Your other series" action={<a className={s.textLink} href="#/series">All series</a>} />
          {otherSeries.map((d) => <ContinueSeries key={d.id} def={d} soft={returning} />)}
        </>
      )}
      {leadHasNext && (
        <>
          <SectionHead title="Or something else" />
          <TodayPick state={todayPick} quiet />
        </>
      )}

      {due.length > 0 && (
        <>
          <SectionHead title="Due for a repeat" />
          <p className={s.muted} style={{ marginBottom: 'var(--space-sm)' }}>Ones you said you’d happily do again, not practised for a while.</p>
          <div className={s.rail}>
            {due.map((d) => (
              <SessionCard key={d.session.id} session={d.session} layout="rail"
                note={`Last practised ${formatDay(lastPractised[d.session.id])}`} />
            ))}
          </div>
        </>
      )}

      <SectionHead title="Practise for" />
      <div className={s.intentions}>
        {INTENTIONS.map((i) => (
          <button key={i.id} type="button" className={s.intention} onClick={() => explore({ intention: i.id })}>
            <strong>{i.label}</strong>
            <span>{i.hint}</span>
          </button>
        ))}
        <button type="button" className={s.intention} aria-expanded={showAreas} onClick={() => setShowAreas((v) => !v)}>
          <strong>Focus on a body area</strong>
          <span>{showAreas ? 'Choose one below' : 'Hips, back, shoulders…'}</span>
        </button>
      </div>
      {showAreas && (
        <div className={s.row} style={{ marginTop: 'var(--space-md)' }}>
          {areas.map((a) => <Chip key={a} onClick={() => explore({ intention: `area:${a}` })}>{a}</Chip>)}
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <SectionHead title="More ideas for today" action={<a className={s.textLink} href="#/surprise">Surprise Me</a>} />
          <div className={s.rail}>
            {suggestions.map((x) => {
              const session = byId.get(x.id)
              return session ? <SessionCard key={x.id} session={session} layout="rail" note={x.reason} /> : null
            })}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <SectionHead title="Recently practised" action={<a className={s.textLink} href="#/practice">History</a>} />
          <div className={s.rail}>{recent.map((x) => x && <SessionCard key={x.id} session={x} layout="rail" />)}</div>
        </>
      )}

      <SectionHead title="Favourites" action={favourites.length ? <button type="button" className={s.textLink} onClick={() => explore({ favouritesOnly: true })}>See all</button> : undefined} />
      {favourites.length > 0
        ? <div className={s.rail}>{favourites.map((x) => <SessionCard key={x.id} session={x} layout="rail" />)}</div>
        : <p className={s.muted}>Tap the heart on any session to keep it here.</p>}

      {quietStyles.length > 0 && (
        <>
          <SectionHead title="Less explored" />
          <p className={s.muted} style={{ marginBottom: 'var(--space-sm)' }}>Styles you’ve visited least. A small nudge towards variety.</p>
          <div className={s.row}>
            {quietStyles.map((st) => (
              <Chip key={st} tone="lavender" onClick={() => explore({ styles: [st] })}>{st} <ArrowRight size={13} style={{ verticalAlign: '-2px' }} /></Chip>
            ))}
          </div>
        </>
      )}
    </>
  )
}
