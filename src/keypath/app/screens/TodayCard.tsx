import { useEffect, useState } from 'react'
import { useApp } from '../context'
import type { StringKey } from '../i18n'
import { JourneyRepo } from '../journey/progress'
import { stepById } from '../journey/steps'
import type { Door } from '../log'
import { localDate } from '../progress/summary'
import { navigate } from '../router'
import { SongLibrary } from '../songs/library'
import { isDone, planToday, todayFor, type TodayItem, type TodayPlan } from './today'
import styles from '../app.module.css'

const GAME: Record<'race' | 'echo' | 'chord', { icon: string; title: StringKey }> = {
  race: { icon: '🏁', title: 'raceTitle' },
  echo: { icon: '🥁', title: 'echoTitle' },
  chord: { icon: '🎹', title: 'chordTitle' },
}
const KIND: Record<TodayItem['kind'], StringKey> = { song: 'todaySong', journey: 'todayJourney', game: 'todayGame' }
const DOOR: Record<TodayItem['kind'], Door> = { song: 'songs', journey: 'journey', game: 'challenges' }

/** Home's "Today": a song, a Journey step and a game, each ticked off as she does it. */
export function TodayCard() {
  const { t, store, log, profile, settings } = useApp()
  const [today, setToday] = useState<{ plan: TodayPlan; done: boolean[]; titles: Map<string, string> } | null>(null)

  useEffect(() => {
    if (!profile) return
    let live = true
    void (async () => {
      const date = localDate(new Date().toISOString())
      const [records, journey, songs] = await Promise.all([log.read(profile.id), new JourneyRepo(store).get(profile.id), new SongLibrary(store).list(settings.language)])
      const plan = await todayFor(store, profile.id, () => planToday(records, journey, songs, date), date)
      if (live) setToday({ plan, done: plan.items.map((i) => isDone(i, records, date)), titles: new Map(songs.map((e) => [e.song.id, e.song.title])) })
    })()
    return () => {
      live = false
    }
  }, [profile, log, store, settings.language])

  if (!profile || !today) return null
  const what = (i: TodayItem): string | null => {
    if (i.kind === 'song') return today.titles.has(i.songId) ? `🎵 ${today.titles.get(i.songId)}` : null
    if (i.kind === 'journey') {
      const step = stepById(i.step)
      return step ? `🗺️ ${t(step.title)}` : null
    }
    return `${GAME[i.game].icon} ${t(GAME[i.game].title)}`
  }
  // A song taken off the phone since the morning simply drops out.
  const shown = today.plan.items.map((item, i) => ({ item, done: today.done[i], label: what(item) })).filter((x) => x.label)
  const allDone = shown.every((x) => x.done)
  const open = (i: TodayItem) => {
    void log.add(profile.id, { type: 'door_opened', door: DOOR[i.kind] })
    if (i.kind === 'song') navigate({ name: 'play', songId: i.songId })
    else if (i.kind === 'journey') navigate({ name: 'journeyStep', step: i.step })
    else navigate({ name: 'challenge', game: i.game })
  }

  return (
    <section className={styles.today} aria-labelledby="today-title" data-all-done={allDone || undefined}>
      <div className={styles.todayHead}>
        <h2 id="today-title" className={styles.todayTitle}>
          ☀️ {t('todayTitle')}
        </h2>
        <span className={styles.todayHint}>{allDone ? t('todayAllDone') : t('todayHint')}</span>
      </div>
      <ul className={styles.todayItems}>
        {shown.map(({ item, done, label }) => (
          <li key={item.kind}>
            <button type="button" className={styles.todayItem} data-done={done || undefined} aria-label={`${t(KIND[item.kind])}: ${label}${done ? ` · ${t('todayDone')}` : ''}`} onClick={() => open(item)}>
              <span className={styles.todayCheck} aria-hidden>
                {done ? '✓' : ''}
              </span>
              <span className={styles.todayText}>
                <span className={styles.todayKind}>{t(KIND[item.kind])}</span>
                <span className={styles.todayWhat}>{label}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
