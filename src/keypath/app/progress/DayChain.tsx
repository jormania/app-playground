import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { PRACTICE_TYPES } from '../log'
import { useLocalDay } from '../screens/TodayCard'
import { beads, runOf } from './streak'
import { localDate } from './summary'
import styles from './dayChain.module.css'

/**
 * Her string of days: a bead for each day she played, the days in a row
 * joined, and how many in a row now. `full` (Progress) shows two weeks, the
 * big number and her longest string; otherwise (Home) one week, small.
 * Nothing in it scolds: a string that ends is simply followed by a new one.
 */
export function DayChain({ days, full = false }: { days: readonly string[]; full?: boolean }) {
  const { t, settings } = useApp()
  const today = useLocalDay()
  const run = runOf(days, today)
  const shown = beads(days, today, full ? 14 : 7)
  const played = shown.filter((b) => b.played).length
  const weekday = new Intl.DateTimeFormat(settings.language === 'ro' ? 'ro-RO' : 'en-GB', { weekday: 'narrow' })
  const message = run.playedToday ? t('streakPlayedToday', { count: run.current }) : run.current > 0 ? t('streakKeepGoing', { next: run.current + 1 }) : t('streakStart')

  return (
    <section className={full ? styles.full : styles.compact} aria-labelledby={full ? 'streak-full' : 'streak-home'}>
      <div className={styles.head}>
        <span className={styles.count} aria-hidden>
          {run.current}
        </span>
        <div className={styles.words}>
          <h2 id={full ? 'streak-full' : 'streak-home'} className={styles.title}>
            {t('streakUnit', { count: run.current })}
          </h2>
          <p className={styles.message}>{message}</p>
        </div>
      </div>
      {/* One picture with one name: the beads themselves are drawing, not a list to step through. */}
      <div className={styles.beads} role="img" aria-label={t('streakAria', { played, count: shown.length })}>
        {shown.map((b, i) => (
          <span key={b.date} className={styles.bead} data-played={b.played || undefined} data-joined={b.joined || undefined} data-today={b.today || undefined} style={{ '--i': i } as React.CSSProperties}>
            <span className={styles.dot} />
            <span className={styles.day}>{weekday.format(new Date(`${b.date}T12:00`))}</span>
          </span>
        ))}
      </div>
      {full && run.best > 0 && <p className={styles.best}>{t('streakBest', { count: run.best })}</p>}
    </section>
  )
}

/** Home's string: the current player's practice days, read from her log. */
export function HomeDayChain() {
  const { log, profile } = useApp()
  const [days, setDays] = useState<string[] | null>(null)
  const today = useLocalDay()
  useEffect(() => {
    if (!profile) return
    let live = true
    void log.read(profile.id).then((records) => {
      if (live) setDays([...new Set(records.filter((r) => PRACTICE_TYPES.has(r.type)).map((r) => localDate(r.at)))])
    })
    return () => {
      live = false
    }
  }, [log, profile, today])
  // Nothing to show before her first day of playing: the string starts with the first bead.
  if (!days || days.length === 0) return null
  return <DayChain days={days} />
}
