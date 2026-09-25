import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { askCoach, coachFacts, COACH_TIMEOUT_MS, readCoachKey, type FactsInput } from './coach'
import styles from './songs.module.css'

/**
 * The coach's note under the report: asked for once per attempt, shown when it
 * comes back. Without a key, offline, or on any failure, nothing shows; the
 * report never waits for it.
 */
export function CoachNote({ input }: { input: FactsInput }) {
  const { t } = useApp()
  const [state, setState] = useState<{ kind: 'asking' } | { kind: 'note'; text: string } | { kind: 'none' }>(() =>
    readCoachKey() && (typeof navigator === 'undefined' || navigator.onLine !== false) ? { kind: 'asking' } : { kind: 'none' },
  )

  useEffect(() => {
    const key = readCoachKey()
    if (!key || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
    let live = true
    const abort = new AbortController()
    // Too slow is the same as no answer: the waiting line goes away.
    const timer = setTimeout(() => abort.abort(), COACH_TIMEOUT_MS)
    void askCoach(key, coachFacts(input), input.language, input.song, abort.signal).then((text) => {
      if (live) setState(text ? { kind: 'note', text } : { kind: 'none' })
    })
    return () => {
      live = false
      clearTimeout(timer)
      abort.abort()
    }
  }, [input])

  if (state.kind === 'none') return null
  return (
    <aside className={styles.coach} aria-live="polite" aria-busy={state.kind === 'asking'}>
      <span className={styles.coachLabel}>🧑‍🏫 {t('coachTitle')}</span>
      {state.kind === 'asking' ? <p className={styles.coachWaiting}>{t('coachWriting')}</p> : <p className={styles.coachText}>{state.text}</p>}
    </aside>
  )
}
