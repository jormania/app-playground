import { useApp } from '../context'
import type { Door } from '../log'
import type { StringKey } from '../i18n'
import { TopBar } from './TopBar'
import styles from '../app.module.css'

const TITLE: Record<Door, StringKey> = { songs: 'doorSongs', journey: 'doorJourney', challenges: 'doorChallenges', studio: 'doorStudio' }

/** Each door is a placeholder until its step of the build order (KEYPATH_TUTOR.md §9). Opening it is already logged. */
export function DoorScreen({ door }: { door: Door }) {
  const { t } = useApp()
  return (
    <main className={styles.screen}>
      <TopBar title={t(TITLE[door])} />
      <section className={`${styles.panel} ${styles.soon}`}>
        <h2 className={styles.h2}>{t('comingSoon')}</h2>
        <p className={styles.muted}>{t('comingSoonBody')}</p>
      </section>
    </main>
  )
}
