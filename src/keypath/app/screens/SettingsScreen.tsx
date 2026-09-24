import { useEffect, useRef, useState } from 'react'
import { Button, SegmentedControl, SettingsToggle } from '../../../ds'
import { BackupError, exportBackup, restoreBackup } from '../backup'
import { useApp } from '../context'
import type { Language, NoteNames, ProfileSettings } from '../profiles'
import { navigate } from '../router'
import { persistenceState, type Persistence } from '../store'
import type { OnWrong, ReportDepth, Timing } from '../../engine'
import { TopBar } from './TopBar'
import styles from '../app.module.css'

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  )
}

export function SettingsScreen() {
  const { profile, settings, t, updateSetting, choose, store, reload } = useApp()
  const [persisted, setPersisted] = useState<Persistence>('unknown')
  const [message, setMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void persistenceState().then(setPersisted)
  }, [])

  if (!profile) return null
  const set = <K extends keyof ProfileSettings>(key: K) => (value: string) => void updateSetting(key, value as ProfileSettings[K])

  const saveBackup = async () => {
    const backup = await exportBackup(store)
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `keypath-backup-${backup.exportedAt.slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage(t('backupDone'))
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    if (!window.confirm(t('restoreConfirm'))) return
    try {
      const count = await restoreBackup(store, await file.text())
      await reload()
      setMessage(t('restoreDone', { count }))
    } catch (err) {
      if (err instanceof BackupError) setMessage(t('restoreFailed'))
      else throw err
    }
  }

  return (
    <main className={styles.screen}>
      <TopBar title={t('settingsFor', { name: profile.name })} />

      <section className={styles.panel}>
        <Row label={t('language')}>
          <SegmentedControl
            value={settings.language}
            onChange={set('language') as (v: string) => void}
            options={[
              { value: 'en' satisfies Language, label: 'English' },
              { value: 'ro' satisfies Language, label: 'Română' },
            ]}
          />
        </Row>
        <Row label={t('noteNames')} hint={t('noteNamesHint')}>
          <SegmentedControl
            size="sm"
            value={settings.noteNames}
            onChange={set('noteNames')}
            options={[
              { value: 'auto' satisfies NoteNames, label: t('noteNamesAuto') },
              { value: 'letters' satisfies NoteNames, label: t('noteNamesLetters') },
              { value: 'solfege' satisfies NoteNames, label: t('noteNamesSolfege') },
              { value: 'both' satisfies NoteNames, label: t('noteNamesBoth') },
            ]}
          />
        </Row>
      </section>

      <section className={styles.panel}>
        <Row label={t('onWrong')} hint={t('onWrongHint')}>
          <SegmentedControl
            size="sm"
            value={settings.onWrong}
            onChange={set('onWrong')}
            options={[
              { value: 'keepGoing' satisfies OnWrong, label: t('onWrongKeepGoing') },
              { value: 'show' satisfies OnWrong, label: t('onWrongShow') },
              { value: 'wait' satisfies OnWrong, label: t('onWrongWait') },
            ]}
          />
        </Row>
        <Row label={t('timing')}>
          <SegmentedControl
            size="sm"
            value={settings.timing}
            onChange={set('timing')}
            options={[
              { value: 'relaxed' satisfies Timing, label: t('timingRelaxed') },
              { value: 'normal' satisfies Timing, label: t('timingNormal') },
              { value: 'strict' satisfies Timing, label: t('timingStrict') },
            ]}
          />
        </Row>
        <Row label={t('report')}>
          <SegmentedControl
            size="sm"
            value={settings.report}
            onChange={set('report')}
            options={[
              { value: 'off' satisfies ReportDepth, label: t('reportOff') },
              { value: 'short' satisfies ReportDepth, label: t('reportShort') },
              { value: 'detailed' satisfies ReportDepth, label: t('reportDetailed') },
            ]}
          />
        </Row>
        <SettingsToggle
          label={t('wrongAffectsStars')}
          hint={t('wrongAffectsStarsHint')}
          checked={settings.wrongAffectsStars}
          onChange={(e) => void updateSetting('wrongAffectsStars', e.target.checked)}
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.actions}>
          <Button
            variant="outline"
            onClick={async () => {
              await choose(null)
              navigate({ name: 'who' }, { replace: true })
            }}
          >
            {t('switchPlayer')}
          </Button>
          <Button variant="outline" onClick={() => navigate({ name: 'diagnostics' })}>
            {t('diagnostics')}
          </Button>
        </div>
        <p className={styles.hint}>{t('diagnosticsHint')}</p>
      </section>

      <section className={styles.panel}>
        <Row label={t('backup')} hint={t('backupHint')}>
          <div className={styles.actions}>
            <Button onClick={saveBackup}>{t('backupSave')}</Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              {t('backupRestore')}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void restore(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
        </Row>
        {message && (
          <p className={styles.message} role="status">
            {message}
          </p>
        )}
        <Row label={t('storage')}>
          <span className={styles.muted}>
            {persisted === 'persisted' ? t('storagePersisted') : persisted === 'best-effort' ? t('storageBestEffort') : t('storageUnknown')}
          </span>
        </Row>
      </section>
    </main>
  )
}
