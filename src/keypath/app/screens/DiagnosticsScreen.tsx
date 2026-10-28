import { lazy, Suspense } from 'react'
import { useApp } from '../context'
import { TopBar } from './TopBar'
import styles from '../app.module.css'

// The probe is its own download: a grown-up's tool, kept out of the one every
// lesson waits for. Fetched in idle time after KeyPath starts (`prefetchDiagnostics`),
// so the worker has it and Diagnostics opens offline as well.
const loadProbe = () => import('../../App')
const ProbeApp = lazy(loadProbe)

/** Fetch the probe once KeyPath is idle. Never throws: offline, it waits for another start. */
export function prefetchDiagnostics(): void {
  loadProbe().catch(() => {})
}

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
      <Suspense fallback={null}>
        <ProbeApp />
      </Suspense>
    </>
  )
}
