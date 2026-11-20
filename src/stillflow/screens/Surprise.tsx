import { useEffect, useRef, useState } from 'react'
import { Sparkles, RefreshCw, Heart } from 'lucide-react'
import { Button, Field, SegmentedControl, SettingsToggle } from '../../ds'
import { hrefOf } from '../app/router'
import { useStillflow } from '../app/state'
import { StartPractice } from '../components/StartPractice'
import { ChipGroup, Empty, IntensityDots, Thumb } from '../components/ui'
import { INTENSITY_LABELS, PHYSICAL_FOCUS, STYLES } from '../domain/vocabulary'
import { localDate } from '../lib/practice'
import { DEFAULT_CONSTRAINTS, MODES, surprise, type Constraints, type Pick, type SurpriseMode } from '../lib/recommend'
import { readSessionJson, writeSessionJson } from '../../shared/storage'
import s from './screens.module.css'

const KEY = 'stillflow:surprise'

export function Surprise() {
  const { sessions, userData, history, preferences, toggleFavourite } = useStillflow()
  const saved = readSessionJson<{ mode?: SurpriseMode; constraints?: Constraints }>(KEY, {})
  const [mode, setMode] = useState<SurpriseMode>(saved.mode ?? 'match')
  const [c, setC] = useState<Constraints>({ ...DEFAULT_CONSTRAINTS, maxDuration: preferences.preferredMaxDuration, ...saved.constraints })
  const [pick, setPick] = useState<Pick | null>(null)
  const [shown, setShown] = useState<string[]>([])
  const [none, setNone] = useState(false)

  const persist = (m: SurpriseMode, constraints: Constraints) => writeSessionJson(KEY, { mode: m, constraints })
  const setConstraint = (patch: Partial<Constraints>) => {
    const next = { ...c, ...patch }
    setC(next)
    persist(mode, next)
    setShown([])
  }

  const draw = (fresh: boolean) => {
    const already = fresh ? [] : shown
    const p = surprise(mode, c, { sessions, userData, history, preferences, shown: already, today: localDate() })
    setPick(p)
    setNone(!p)
    setShown(p ? [...already, p.session.id] : already)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Arriving here is itself the request: offer a first pick straight away,
  // once the catalogue has loaded.
  const drewOnArrival = useRef(false)
  useEffect(() => {
    if (drewOnArrival.current || sessions.length === 0) return
    drewOnArrival.current = true
    draw(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on first load
  }, [sessions.length])

  const num = (v: string) => (v.trim() === '' ? undefined : Math.max(1, Number(v)))

  if (sessions.length === 0) {
    return <Empty title="Nothing to choose from yet"><p>Add sessions to your catalogue first.</p><a className={s.textLink} href="#/settings">Catalogue settings</a></Empty>
  }

  return (
    <>
      <header className={s.pageHead}>
        <p className={s.kicker}>Surprise me</p>
        <h1 className={s.pageTitle}>Let the practice find you</h1>
        <p className={s.lede}>Pick a mood for the choice. Stillflow weighs your history, favourites and time, and tells you why.</p>
      </header>

      {pick && (
        <section className={s.reveal} aria-live="polite">
          <a href={hrefOf({ name: 'session', id: pick.session.id })}><Thumb session={pick.session} /></a>
          <div className={s.stack}>
            <p className={s.why}>{pick.reason}</p>
            <div>
              <h2 className={s.revealTitle}><a href={hrefOf({ name: 'session', id: pick.session.id })}>{pick.session.title}</a></h2>
              <div className={s.facts}>
                <span>{pick.session.durationMinutes} min</span>
                <span>{pick.session.styles.join(' · ')}</span>
                <IntensityDots level={pick.session.intensity} showLabel />
              </div>
              {pick.session.physicalFocus.length > 0 && <p className={s.muted} style={{ marginTop: 4 }}>Focus: {pick.session.physicalFocus.join(', ')}</p>}
            </div>
            <div className={s.row}>
              <StartPractice session={pick.session} />
              <button type="button" className={s.tryAnother} onClick={() => draw(false)}><RefreshCw size={16} /> Try another</button>
              <button type="button" className={s.iconBtn} aria-pressed={!!userData[pick.session.id]?.favourite}
                aria-label={userData[pick.session.id]?.favourite ? 'Remove from favourites' : 'Add to favourites'} onClick={() => toggleFavourite(pick.session.id)}>
                <Heart size={18} fill={userData[pick.session.id]?.favourite ? 'currentColor' : 'none'} />
              </button>
            </div>
            <p className={s.muted}>One of {pick.poolSize} that fit.</p>
          </div>
        </section>
      )}
      {none && (
        <Empty title="Nothing fits those limits">
          <p>Loosen a constraint or choose another mode.</p>
        </Empty>
      )}

      <h2 style={{ fontSize: '1.35rem', margin: 'var(--space-xl) 0 var(--space-sm)' }}>{pick ? 'Or choose again' : 'How should I choose?'}</h2>
      <div className={s.modes}>
        {MODES.map((m) => (
          <button key={m.id} type="button" className={s.mode} aria-pressed={mode === m.id}
            onClick={() => { setMode(m.id); persist(m.id, c); setShown([]) }}>
            <strong>{m.label}</strong>
            <span>{m.hint}</span>
          </button>
        ))}
      </div>

      <details className={s.constraints}>
        <summary>Constraints {mode === 'short' ? '(set your time limit here)' : '(optional)'}</summary>
        <div className={s.constraintsBody}>
          <div className={s.rangeRow}>
            <Field label="Maximum minutes" type="number" inputMode="numeric" min={1} placeholder={mode === 'short' ? '15' : 'Any'}
              value={c.maxDuration ?? ''} onChange={(e) => setConstraint({ maxDuration: num(e.target.value) })} />
            <div />
          </div>
          <div className={s.rangeRow}>
            <label className={s.stack} style={{ gap: 4 }}>
              <span className={s.muted}>Gentlest</span>
              <select className={s.select} value={c.minIntensity ?? ''} onChange={(e) => setConstraint({ minIntensity: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">Any</option>
                {INTENSITY_LABELS.map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
              </select>
            </label>
            <label className={s.stack} style={{ gap: 4 }}>
              <span className={s.muted}>Most intense</span>
              <select className={s.select} value={c.maxIntensity ?? ''} onChange={(e) => setConstraint({ maxIntensity: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">Any</option>
                {INTENSITY_LABELS.map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
              </select>
            </label>
          </div>
          <ChipGroup label="Body area" options={PHYSICAL_FOCUS} selected={c.focus} onChange={(v) => setConstraint({ focus: v })} />
          <ChipGroup label="Only these styles" options={STYLES} selected={c.styles} onChange={(v) => setConstraint({ styles: v })} />
          <ChipGroup label="Never these styles" options={STYLES} selected={c.excludeStyles} onChange={(v) => setConstraint({ excludeStyles: v })} />
          <div className={s.stack}>
            <SettingsToggle label="Skip sessions I’ve already completed" checked={c.excludeCompleted} onChange={(e) => setConstraint({ excludeCompleted: e.target.checked })} />
            <SegmentedControl label="Favourites" value={c.favourites} onChange={(v) => setConstraint({ favourites: v as Constraints['favourites'] })}
              options={[{ value: 'any', label: 'Include' }, { value: 'only', label: 'Only' }, { value: 'exclude', label: 'Leave out' }]} />
            <button type="button" className={s.textLink} style={{ justifySelf: 'start' }} onClick={() => setConstraint({ ...DEFAULT_CONSTRAINTS })}>Reset constraints</button>
          </div>
        </div>
      </details>

      <div style={{ marginTop: 'var(--space-lg)' }}>
        <Button onClick={() => draw(true)}><Sparkles size={16} /> {pick ? 'Choose again' : 'Surprise me'}</Button>
      </div>
    </>
  )
}
