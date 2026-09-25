import type { ReactNode } from 'react'
import { useApp } from '../context'
import styles from '../app.module.css'

/**
 * A title with a back arrow; back goes to the previous screen, like the phone's own back button.
 * `aside` (the keyboard's status on the playing screens) sits under the title in portrait, and
 * beside it on a short landscape screen, where every line of height goes to the keys.
 * `compact` while the music is on: one slim line in either orientation, so the
 * notes and keys get the screen and the title stays out of the way.
 */
export function TopBar({ title, aside, compact }: { title: string; aside?: ReactNode; compact?: boolean }) {
  const { t } = useApp()
  return (
    <header className={styles.topBar} data-compact={compact || undefined}>
      <button type="button" className={styles.backButton} onClick={() => history.back()} aria-label={t('back')}>
        ←
      </button>
      <h1 className={styles.title}>{title}</h1>
      {aside && <div className={styles.topAside}>{aside}</div>}
    </header>
  )
}
