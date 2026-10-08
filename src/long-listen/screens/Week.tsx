import { useCallback, useEffect, useState } from 'react'
import type { ProgrammeOption, Theme, WeekRecord } from '../domain/types'
import { sinceWords, weekFromKey } from '../domain/week'
import { useServices } from '../app/services'
import { go } from '../app/router'
import { CuratorUnavailable } from '../curation/api'
import { Problem, Waiting } from '../components/common'
import { ProgrammeScreen } from './Programme'
import s from '../styles/editorial.module.css'

const MOOD_WORD = { immersive: 'Immersive', curious: 'Curious', adventurous: 'Adventurous' } as const

interface WeekView {
  record: WeekRecord
  options: ProgrammeOption[]
  openPaths: ProgrammeOption[]
  themes: Map<string, Theme>
  firstVisit: boolean
}

/**
 * This week: what am I listening to? Before a choice, the three directions;
 * after, the programme itself. Opening this page is what makes a new week —
 * once, and never again for the same week.
 */
export function WeekScreen() {
  const { journey, repo, version, bump, settings } = useServices()
  const [view, setView] = useState<WeekView | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [chooseError, setChooseError] = useState<unknown>(null)

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
      setView({ record, options, openPaths, themes, firstVisit })
    } catch (e) {
      setError(e)
    }
  }, [journey, repo])

  // Reload on data changes and when the curator setup changes (passphrase, demo).
  useEffect(() => { void load() }, [load, version, settings.passphrase])

  async function choose(o: ProgrammeOption, fromEarlier = false) {
    setChoosing(o.id)
    setChooseError(null)
    try {
      const p = fromEarlier ? await journey.takeOpenPath(o.id) : await journey.choose(o.id)
      bump()
      go({ name: 'programme', id: p.id })
    } catch (e) {
      setChooseError(e)
    } finally {
      setChoosing(null)
    }
  }

  if (error) {
    const locked = error instanceof CuratorUnavailable && (error.code === 'locked' || error.code === 'not-set-up')
    return (
      <div>
        <p className={s.eyebrow}>{journey.currentWeek().label}</p>
        <h1 className={s.titleSmall}>{locked ? 'Before the first programme' : 'This week is still being prepared'}</h1>
        <Problem error={error} onRetry={locked ? undefined : () => void load()} />
        {locked && <p><a href="#/settings">Open Settings</a> to add your passphrase.</p>}
      </div>
    )
  }
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

      {chooseError != null && <Problem error={chooseError} />}
      {choosing && <Waiting>The curator is building your programme — choosing works, recordings, and what to listen for…</Waiting>}

      <ol className={s.options}>
        {view.options.map((o) => (
          <OptionEntry key={o.id} o={o} theme={o.returning ? view.themes.get(o.returning.themeId) : undefined} weekKey={view.record.weekKey} busy={choosing !== null} onChoose={() => choose(o)} />
        ))}
      </ol>

      {view.openPaths.length > 0 && (
        <details className={s.block}>
          <summary className={s.textButton}>Or take a path from an earlier week</summary>
          <ul className={s.entries}>
            {view.openPaths.map((o) => (
              <li key={o.id} className={s.entry}>
                <p className={s.mood}>{MOOD_WORD[o.mood]} · offered {sinceWords(o.weekKey, view.record.weekKey)}</p>
                <h3 className={s.entryTitle}>{o.title}</h3>
                <p className={s.quiet}>{o.pitch}</p>
                <button className={s.textButton} disabled={choosing !== null} onClick={() => choose(o, true)}>Take this path now</button>
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
        <p className={s.mood} style={{ marginTop: 'var(--space-2xs)' }}>{MOOD_WORD[o.mood]}</p>
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
          <button className={s.textButton} onClick={onChoose} disabled={busy}>Listen this way →</button>
        </div>
      </div>
    </li>
  )
}

