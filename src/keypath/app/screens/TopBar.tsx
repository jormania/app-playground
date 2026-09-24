import type { ReactNode } from 'react'
import { useApp } from '../context'
import styles from '../app.module.css'

/**
 * A title with a back arrow; back goes to the previous screen, like the phone's own back button.
 * `aside` (the keyboard's status on the playing screens) sits under the title in portrait, and
 * beside it on a short landscape screen, where every line of height goes to the keys.
 */
export function TopBar({ title, aside }: { title: string; aside?: ReactNode }) {
  const { t } = useApp()
  return (
    <header className={styles.topBar}>
      <button type="button" className={styles.backButton} onClick={() => history.back()} aria-label={t('back')}>
        ←
      </button>
      <h1 className={styles.title}>{title}</h1>
      {aside && <div className={styles.topAside}>{aside}</div>}
    </header>
  )
}
