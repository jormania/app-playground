import { useEffect, useState } from 'react'
import { backupDue } from '../backup'
import { useApp } from '../context'
import type { Door } from '../log'
import { navigate } from '../router'
import type { StringKey } from '../i18n'
import styles from '../app.module.css'

const DOORS: { door: Door; icon: string; title: StringKey; blurb: StringKey }[] = [
  { door: 'songs', icon: '🎵', title: 'doorSongs', blurb: 'doorSongsBlurb' },
  { door: 'journey', icon: '🗺️', title: 'doorJourney', blurb: 'doorJourneyBlurb' },
  { door: 'challenges', icon: '⚡', title: 'doorChallenges', blurb: 'doorChallengesBlurb' },
  { door: 'studio', icon: '🎨', title: 'doorStudio', blurb: 'doorStudioBlurb' },
]

/** Four equal doors, no order, no gate (KEYPATH_TUTOR.md §3). */
export function Home() {
  const { profile, t, log, store } = useApp()
  const [nudge, setNudge] = useState(false)

  useEffect(() => {
    void backupDue(store).then(setNudge)
  }, [store])

  if (!profile) return null
  const open = (door: Door) => {
    void log.add(profile.id, { type: 'door_opened', door })
    navigate({ name: 'door', door })
  }

  return (
    <main className={styles.screen}>
      <header className={styles.homeHeader}>
        <button type="button" className={styles.meButton} onClick={() => navigate({ name: 'settings' })} aria-label={t('settings')}>
          <span className={styles.avatarSmall} aria-hidden>
            {profile.avatar}
          </span>
          <span className={styles.gear} aria-hidden>
            ⚙
          </span>
        </button>
        <div>
          <h1 className={styles.hero}>{t('hello', { name: profile.name })}</h1>
          <p className={styles.sub}>{t('whereToday')}</p>
        </div>
      </header>
      {nudge && (
        <button type="button" className={styles.nudge} onClick={() => navigate({ name: 'settings' })}>
          {t('backupDue')}
        </button>
      )}
      <nav className={styles.doors}>
        {DOORS.map((d) => (
          <button key={d.door} type="button" className={`${styles.door} ${styles[d.door]}`} onClick={() => open(d.door)}>
            <span className={styles.doorIcon} aria-hidden>
              {d.icon}
            </span>
            <span className={styles.doorTitle}>{t(d.title)}</span>
            <span className={styles.doorBlurb}>{t(d.blurb)}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}
