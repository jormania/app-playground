import { useMemo, useState } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { navigate } from '../app/router'
import { useStillflow } from '../app/state'
import { SessionCard } from '../components/SessionCard'
import { Chip, Empty, SectionHead } from '../components/ui'
import { EMPTY_FILTERS, INTENTIONS, type Filters } from '../lib/filter'
import { localDate, summarise, thisWeek } from '../lib/practice'
import { DEFAULT_CONSTRAINTS, buildProfile, surprise } from '../lib/recommend'
import { seedFromText, seededRandom } from '../lib/seeded'
import { PHYSICAL_FOCUS } from '../domain/vocabulary'
import s from './screens.module.css'

const QUICK_DURATIONS = [10, 15, 20, 30, 45]

function greeting(hour: number) {
  if (hour < 5) return 'Late evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function Discover() {
  const state = useStillflow()
  const { sessions, history, userData, preferences, byId, setFilters } = state
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

  const favourites = useMemo(() => sessions.filter((x) => userData[x.id]?.favourite).slice(0, 8), [sessions, userData])

  const suggestions = useMemo(() => {
    const rand = seededRandom(seedFromText(today))
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
    const present = new Set(sessions.flatMap((x) => x.styles))
    return [...present].sort((a, b) => (p.allStyleCounts[a] ?? 0) - (p.allStyleCounts[b] ?? 0) || a.localeCompare(b)).slice(0, 6)
  }, [sessions, history, today])

  const areas = useMemo(() => PHYSICAL_FOCUS.filter((f) => sessions.some((x) => x.physicalFocus.includes(f))), [sessions])

  const week = summarise(thisWeek(history, today))
  const target = preferences.weeklyTargetMinutes

  if (state.ready && sessions.length === 0) {
    return (
      <Empty title="Your library is empty">
        <p>Import a catalogue of sessions, or add one by pasting a YouTube link.</p>
        <a className={s.textLink} href="#/settings">Open catalogue settings</a>
      </Empty>
    )
  }

  return (
    <>
      <section className={s.hero}>
        <div>
          <p className={s.kicker}>{greeting(new Date().getHours())}</p>
          <h1 className={s.heroTitle}>What does your body <em>need</em> today?</h1>
        </div>
        <a href="#/surprise" className={s.surpriseCta}>
          <Sparkles size={20} strokeWidth={1.6} />
          <span>Surprise me <small>· a practice chosen for today</small></span>
        </a>
        <div className={s.week} aria-label="This week">
          <span>This week: {week.sessions} {week.sessions === 1 ? 'practice' : 'practices'} · {week.minutes} min</span>
          {target ? (
            <span className={s.weekBar} title={`${week.minutes} of ${target} minutes`}>
              <span style={{ width: `${Math.min(100, (week.minutes / target) * 100)}%` }} />
            </span>
          ) : null}
        </div>
      </section>

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

      <SectionHead title="How long have you got?" />
      <div className={s.row}>
        {QUICK_DURATIONS.map((m) => (
          <Chip key={m} onClick={() => explore(m === 45 ? { customMin: 45 } : { customMax: m })}>
            {m === 45 ? '45 min +' : `Up to ${m} min`}
          </Chip>
        ))}
      </div>

      {suggestions.length > 0 && (
        <>
          <SectionHead title="Suggested for today" action={<a className={s.textLink} href="#/surprise">More ideas</a>} />
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
