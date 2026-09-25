import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { JourneyRepo, stateOf, type JourneyProgress } from './progress'
import { JOURNEY } from './steps'
import styles from './journey.module.css'

/** The Journey door: its steps on a path. Every one can be opened; the locked ones offer a test-out. */
export function JourneyHome() {
  const { t, store, profile } = useApp()
  const repo = useMemo(() => new JourneyRepo(store), [store])
  const [progress, setProgress] = useState<JourneyProgress | null>(null)
  useEffect(() => {
    if (profile) void repo.get(profile.id).then(setProgress)
  }, [repo, profile])
  if (!progress) return null

  const allDone = JOURNEY.every((s) => progress[s.id])
  return (
    <main className={styles.screen}>
      <TopBar title={t('doorJourney')} />
      <p className={styles.intro}>{allDone ? t('jAllDone') : t('journeyIntro')}</p>
      <ol className={styles.path} style={{ '--done': JOURNEY.filter((s) => progress[s.id]).length / JOURNEY.length } as React.CSSProperties}>
        {JOURNEY.map((s, i) => {
          const state = stateOf(progress, s.id)
          const done = progress[s.id]
          return (
            <li key={s.id} className={styles.stop} data-state={state} style={{ '--i': i } as React.CSSProperties}>
              <button type="button" className={styles.stopButton} onClick={() => navigate({ name: 'journeyStep', step: s.id })}>
                <span className={styles.stopBadge} aria-hidden>
                  {state === 'done' ? '✓' : state === 'locked' ? '🔒' : i + 1}
                </span>
                <span className={styles.stopText}>
                  <span className={styles.stopTitle}>{t(s.title)}</span>
                  <span className={styles.stopBlurb}>
                    {done ? t(done.how === 'testOut' ? 'jDoneTestOut' : 'jDoneCheck') : state === 'locked' ? t('jTestOut') : t(s.blurb)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
