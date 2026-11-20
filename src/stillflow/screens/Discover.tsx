import { useMemo, useState } from 'react'
import { Sparkles, ArrowRight, Shuffle, Download } from 'lucide-react'
import { navigate } from '../app/router'
import { useStillflow } from '../app/state'
import { SessionCard } from '../components/SessionCard'
import { Chip, Empty, SectionHead } from '../components/ui'
import { EMPTY_FILTERS, INTENTIONS, type Filters } from '../lib/filter'
import { localDate, summarise, thisWeek } from '../lib/practice'
import { DEFAULT_CONSTRAINTS, buildProfile, surprise } from '../lib/recommend'
import { seedFromText, seededRandom } from '../lib/seeded'
import { PHYSICAL_FOCUS } from '../domain/vocabulary'
import { PracticeLink, StartPractice } from '../components/StartPractice'
import type { SeriesDef } from '../domain/types'
import { dayTheme, daySearchUrl, doneDays, linkedSessions, nextDay } from '../lib/series'
import { useSeries } from './Series'
import { hrefOf } from '../app/router'
import { backupNudge, dueForRepeat, isUnavailable, shortTitle, weekRing } from '../lib/today'
import { downloadText, stamp } from '../lib/download'
import { Thumb } from '../components/ui'
import { formatDay } from '../lib/practice'
import s from './screens.module.css'

function ContinueSeries({ def, primary = false }: { def: SeriesDef; primary?: boolean }) {
  const { markLaunched } = useStillflow()
  const { done, next, linked, pace } = useSeries(def)
  const session = next ? linked.get(next) : undefined
  return (
    <div className={primary ? s.todayCard : s.continue}>
      {primary && <span className={s.todayKicker}>Your next practice</span>}
      <div className={s.spread}>
        <a href={hrefOf({ name: 'seriesDetail', id: def.id })} className={s.entryTitle} style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>
          {def.name} · {next ? `${def.unit} ${next}` : 'all done'}
        </a>
        <span className={s.muted}>{done.size}/{def.length}</span>
      </div>
      {session && dayTheme(session.title, def) && <span className={s.muted}>{dayTheme(session.title, def)} · {session.durationMinutes} min</span>}
      {pace && <span className={s.paceNote}>{pace.label}</span>}
      {next && (
        <div className={s.row}>
          {session
            ? <StartPractice session={session} compact series={{ seriesId: def.id, day: next }} label={`Start ${def.unit} ${next}`} />
            : <PracticeLink url={daySearchUrl(def, next)} compact search label={`Find ${def.unit} ${next}`} onLaunch={() => markLaunched({ seriesId: def.id, day: next })} />}
          <a className={s.textLink} href={hrefOf({ name: 'seriesDetail', id: def.id })}>Open series</a>
        </div>
      )}
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

/** Minutes this week against your goal, as a quiet ring. */
function WeekRing({ minutes, sessions, target }: { minutes: number; sessions: number; target?: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const { frac, label } = weekRing(minutes, target)
  return (
    <a href="#/practice" className={s.weekRing} aria-label={`This week: ${sessions} ${sessions === 1 ? 'practice' : 'practices'}, ${label}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className={s.ringTrack} />
        {frac > 0 && <circle cx="32" cy="32" r={r} className={s.ringFill} strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 32 32)" />}
      </svg>
      <span className={s.weekRingText}>
        <strong>{minutes}</strong>
        <small>{target ? `of ${target} min` : 'min'} this week</small>
      </span>
    </a>
  )
}

/** One practice for today, re-picked when you say how long you have. */
function TodayPick({ quiet = false }: { quiet?: boolean }) {
  const { sessions, userData, history, preferences, seriesDefs } = useStillflow()
  const today = localDate()
  const [minutes, setMinutes] = useState<number | null>(null)
  const [turn, setTurn] = useState(0)
  const pick = useMemo(() => {
    const rand = seededRandom(seedFromText(`${today}:${minutes ?? 'any'}:${turn}`))
    const c = minutes ? { ...DEFAULT_CONSTRAINTS, maxDuration: minutes } : DEFAULT_CONSTRAINTS
    return surprise('match', c, { sessions, userData, history, preferences, shown: [], today }, rand)
  }, [sessions, userData, history, preferences, today, minutes, turn])

  return (
    <div className={quiet ? s.continue : s.todayCard}>
      {!quiet && <span className={s.todayKicker}>A practice for today</span>}
      {pick ? (
        <a href={hrefOf({ name: 'session', id: pick.session.id })} className={s.todayPick}>
          <Thumb session={pick.session} className={s.todayThumb} />
          <span>
            <strong className={s.todayTitle}>{shortTitle(pick.session, seriesDefs).title}</strong>
            <span className={s.muted}>{pick.session.durationMinutes} min · {pick.reason}</span>
          </span>
        </a>
      ) : (
        <p className={s.muted}>Nothing fits {minutes ? `${minutes} minutes` : 'right now'}. Try another length.</p>
      )}
      <div className={s.todayTimes} role="group" aria-label="How long have you got?">
        {TIME_CHOICES.map((m) => (
          <button key={m} type="button" aria-pressed={minutes === m} onClick={() => { setMinutes(minutes === m ? null : m); setTurn(0) }}>
            {m} min
          </button>
        ))}
        <button type="button" aria-label="Another idea" onClick={() => setTurn((t) => t + 1)}><Shuffle size={16} /></button>
      </div>
      <div className={s.row}>
        {pick && <StartPractice session={pick.session} compact />}
        <a href="#/surprise" className={s.textLink}><Sparkles size={14} style={{ verticalAlign: '-2px' }} /> More ways to choose</a>
      </div>
    </div>
  )
}

/** Your history lives only in this browser: a gentle reminder to keep a copy. */
function BackupNudge({ count }: { count: number }) {
  const { exportBackup, preferences, savePreferences, toast } = useStillflow()
  return (
    <div className={s.nudge} role="note">
      <p>
        <strong>{count} {count === 1 ? 'practice' : 'practices'} since your last backup.</strong>{' '}
        Your history is kept only on this phone. A backup file keeps it safe if the browser clears its data.
      </p>
      <div className={s.row}>
        <button type="button" className={s.nudgePrimary} onClick={async () => {
          downloadText(`stillflow-backup-${stamp()}.json`, JSON.stringify(await exportBackup(), null, 2), 'application/json')
          toast('Backup saved to your downloads', 'success')
        }}><Download size={15} /> Save a backup</button>
        <button type="button" className={s.textLink} onClick={() => savePreferences({ ...preferences, backupNudgeDismissedAt: new Date().toISOString() })}>Not now</button>
      </div>
    </div>
  )
}

export function Discover() {
  const state = useStillflow()
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

  const suggestions = useMemo(() => {
    const rand = seededRandom(seedFromText(`${today}:rail`))
    const shown: string[] = []
    const out: { id: string; reason: string }[] = []
    for (let i = 0; i < 4; i++) {
      const pick = surprise('match', DEFAULT_CONSTRAINTS, { sessions, userData, history, preferences, shown, today }, rand)
      if (!pick || shown.includes(pick.session.id)) break
      shown.push(pick.session.id)
      out.push({ id: pick.session.id, reason: pick.reason })
    }
    return out
  }, [sessions, userData, history, preferences, today])

  const quietStyles = useMemo(() => {
    const p = buildProfile(sessions, history, today)
    const real = sessions.filter((x) => !x.isDemo)
    const present = new Set((real.length >= 10 ? real : sessions).flatMap((x) => x.styles))
    return [...present].sort((a, b) => (p.allStyleCounts[a] ?? 0) - (p.allStyleCounts[b] ?? 0) || a.localeCompare(b)).slice(0, 6)
  }, [sessions, history, today])

  const areas = useMemo(() => PHYSICAL_FOCUS.filter((f) => sessions.some((x) => x.physicalFocus.includes(f))), [sessions])

  const week = summarise(thisWeek(history, today))
  const backup = backupNudge(history, preferences, today)
  // A series with a day left leads Today; one that's all done waits on the Series tab to be completed.
  const withNext = activeSeries.filter((d) => {
    const p = seriesProgress[d.id]
    return nextDay(d, doneDays(d, p, linkedSessions(d, sessions, p), history)) != null
  })
  const [lead, ...otherSeries] = withNext
  const leadHasNext = !!lead

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
          <p className={s.kicker}>{greeting(new Date().getHours())}</p>
          <h1 className={s.heroTitle}>What does your body <em>need</em> today?</h1>
        </div>
        <WeekRing minutes={week.minutes} sessions={week.sessions} target={preferences.weeklyTargetMinutes} />
      </section>

      {leadHasNext ? <ContinueSeries def={lead} primary /> : <TodayPick />}

      {backup != null && <BackupNudge count={backup} />}

      {otherSeries.length > 0 && (
        <>
          <SectionHead title="Your other series" action={<a className={s.textLink} href="#/series">All series</a>} />
          {otherSeries.map((d) => <ContinueSeries key={d.id} def={d} />)}
        </>
      )}
      {leadHasNext && (
        <>
          <SectionHead title="Or something else" />
          <TodayPick quiet />
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
          <button key={i.id} type="button" className={s.intention} onClick={() => explore(i.filters)}>
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
          {areas.map((a) => <Chip key={a} onClick={() => explore({ focus: [a] })}>{a}</Chip>)}
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <SectionHead title="More ideas for today" action={<a className={s.textLink} href="#/surprise">Surprise me</a>} />
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
