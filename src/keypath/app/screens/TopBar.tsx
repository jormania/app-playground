import { useApp } from '../context'
import styles from '../app.module.css'

/** A title with a back arrow; back goes to the previous screen, like the phone's own back button. */
export function TopBar({ title }: { title: string }) {
  const { t } = useApp()
  return (
    <header className={styles.topBar}>
      <button type="button" className={styles.backButton} onClick={() => history.back()} aria-label={t('back')}>
        ←
      </button>
      <h1 className={styles.title}>{title}</h1>
    </header>
  )
}
