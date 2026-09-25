import { useApp } from '../context'
import type { StringKey } from '../i18n'
import { navigate } from '../router'
import type { KeyboardStatus as Status } from './keyboard'
import styles from './connect.module.css'

/**
 * One line that always says whether the keyboard is there, with the way to
 * fix it when it isn't. Shown on Home and above every song. `compact` while
 * the music is on: just the dot, its words for a screen reader. A keyboard
 * lost mid-song pauses it with its own way back, so the button can go.
 */
export function KeyboardStatus({ status, missing = 'keyboardNotConnected', compact }: { status: Status; missing?: StringKey; compact?: boolean }) {
  const { t } = useApp()
  if (status.checking) return null
  if (compact)
    return (
      <p className={styles.pill} data-connected={status.connected || undefined} data-compact role="status">
        <span className={styles.pillWords}>{status.connected ? t('keyboardReady') : t(missing)}</span>
      </p>
    )
  if (status.connected)
    return (
      <p className={styles.pill} data-connected role="status">
        {t('keyboardReady')}
        {status.name && <span className={styles.pillName}> · {status.name}</span>}
      </p>
    )
  return (
    <p className={styles.pill} role="status">
      {t(missing)}
      <button type="button" className={styles.pillAction} onClick={() => navigate({ name: 'connect' })}>
        {t('connectAction')}
      </button>
    </p>
  )
}
