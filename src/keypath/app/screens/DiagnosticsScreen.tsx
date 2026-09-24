import ProbeApp from '../../App'
import { useApp } from '../context'
import { TopBar } from './TopBar'
import styles from '../app.module.css'

/**
 * The hardware probe, unchanged, reached from Settings (KEYPATH_TUTOR.md §9):
 * connection check, event monitor, tests, tempo, phone audio, report.
 */
export function DiagnosticsScreen() {
  const { t } = useApp()
  return (
    <>
      <div className={styles.diagnosticsBar}>
        <TopBar title={t('diagnostics')} />
      </div>
      <ProbeApp />
    </>
  )
}
