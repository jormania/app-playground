import { useEffect, useRef, useState } from 'react'
import { Button, Field, SegmentedControl, SettingsToggle } from '../../../ds'
import { BackupError, exportBackup, restoreBackup } from '../backup'
import { useApp } from '../context'
import { AVATARS, type Language, type NoteNames, type ProfileSettings } from '../profiles'
import { navigate } from '../router'
import { persistenceState, type Persistence } from '../store'
import type { OnWrong, ReportDepth, Timing } from '../../engine'
import { TopBar } from './TopBar'
import { RELEASE } from '../release'
import { readAiKey, saveAiKey, testAiKey, type KeyCheck } from '../ai'
import type { StringKey } from '../i18n'
import styles from '../app.module.css'

const KEY_CHECK: Record<KeyCheck, StringKey> = {
  ok: 'coachTestOk',
  'bad-key': 'coachTestBadKey',
  'no-credit': 'coachTestNoCredit',
  limited: 'coachTestLimited',
  busy: 'coachTestBusy',
  offline: 'coachTestOffline',
  error: 'coachTestError',
}

/** A saved key, shown only by its ends: sk-ant-…a1B2. */
const keyHint = (key: string) => `${key.slice(0, 7)}…${key.slice(-4)}`

/** A group of settings under its heading. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.panel} aria-label={title}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

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
  const { profile, profiles, settings, t, updateSetting, choose, removeProfile, store, reload } = useApp()
  const [persisted, setPersisted] = useState<Persistence>('unknown')
  const [message, setMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** A backup file picked, waiting for "Replace everything". */
  const [pendingRestore, setPendingRestore] = useState<File | null>(null)
  const [editing, setEditing] = useState<{ name: string; avatar: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  /** The phone's Anthropic key: what's saved, what's being typed, and the last test's answer. */
  const [savedKey, setSavedKey] = useState(readAiKey)
  const [keyDraft, setKeyDraft] = useState('')
  const [keyCheck, setKeyCheck] = useState<KeyCheck | 'testing' | null>(null)

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

  const restore = async (file: File) => {
    setPendingRestore(null)
    try {
      const count = await restoreBackup(store, await file.text())
      await reload()
      setMessage(t('restoreDone', { count }))
    } catch (err) {
      if (err instanceof BackupError) setMessage(t('restoreFailed'))
      else throw err
    }
  }

  const saveKey = () => {
    saveAiKey(keyDraft)
    setSavedKey(readAiKey())
    setKeyDraft('')
    setKeyCheck(null)
  }
  const removeKey = () => {
    saveAiKey('')
    setSavedKey('')
    setKeyCheck(null)
  }
  const testKey = async () => {
    setKeyCheck('testing')
    setKeyCheck(await testAiKey(keyDraft.trim() || savedKey))
  }

  const savePlayer = async () => {
    if (!editing) return
    await profiles.update(profile.id, editing)
    await reload()
    setEditing(null)
  }

  return (
    <main className={styles.screen}>
      <TopBar title={t('settingsFor', { name: profile.name })} />

      {/* Who's playing: name and avatar, another player, or this one gone. */}
      <Section title={t('settingsPlayer')}>
        {editing ? (
          <form
            className={styles.row}
            onSubmit={(e) => {
              e.preventDefault()
              void savePlayer()
            }}
          >
            <Field label={t('name')} value={editing.name} maxLength={40} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>{t('pickFace')}</legend>
              <div className={styles.avatarGrid} role="radiogroup">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={editing.avatar === a}
                    className={`${styles.avatarChoice} ${editing.avatar === a ? styles.avatarChosen : ''}`}
                    onClick={() => setEditing({ ...editing, avatar: a })}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className={styles.actions}>
              <Button type="submit" disabled={!editing.name.trim()}>
                {t('savePlayer')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <div className={styles.playerRow}>
            <span className={styles.avatarSmall} aria-hidden>
              {profile.avatar}
            </span>
            <span className={styles.playerName}>{profile.name}</span>
          </div>
        )}
        {!editing && (
          <div className={styles.actions}>
            <Button size="sm" variant="outline" onClick={() => setEditing({ name: profile.name, avatar: profile.avatar })}>
              {t('editPlayer')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await choose(null)
                navigate({ name: 'who' }, { replace: true })
              }}
            >
              {t('switchPlayer')}
            </Button>
            {!confirmDelete && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                {t('deletePlayer')}
              </Button>
            )}
          </div>
        )}
        {confirmDelete && (
          <div className={styles.confirm} role="alertdialog" aria-label={t('deletePlayerConfirm', { name: profile.name })}>
            <p className={styles.confirmText}>{t('deletePlayerConfirm', { name: profile.name })}</p>
            <div className={styles.actions}>
              <Button
                variant="danger"
                onClick={async () => {
                  await removeProfile(profile)
                  navigate({ name: 'who' }, { replace: true })
                }}
              >
                {t('deletePlayerYes', { name: profile.name })}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}
      </Section>

      {/* What she reads: the language, the notes' names, and what's printed on keys and notes. */}
      <Section title={t('settingsNames')}>
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
        <SettingsToggle label={t('keyNames')} hint={t('keyNamesHint')} checked={settings.keyNames} onChange={(e) => void updateSetting('keyNames', e.target.checked)} />
        <SettingsToggle label={t('fingerNumbers')} hint={t('fingerNumbersHint')} checked={settings.fingers} onChange={(e) => void updateSetting('fingers', e.target.checked)} />
      </Section>

      {/* How a song is judged, and what the end of it shows. */}
      <Section title={t('settingsPlaying')}>
        <Row label={t('onWrong')} hint={t('onWrongHint')}>
          <SegmentedControl
            size="sm"
            value={settings.onWrong}
            onChange={set('onWrong')}
            options={[
              { value: 'wait' satisfies OnWrong, label: t('onWrongWait') },
              { value: 'show' satisfies OnWrong, label: t('onWrongShow') },
              { value: 'keepGoing' satisfies OnWrong, label: t('onWrongKeepGoing') },
            ]}
          />
        </Row>
        <Row label={t('timing')} hint={t('timingHint')}>
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
        <SettingsToggle
          label={t('wrongAffectsStars')}
          hint={t('wrongAffectsStarsHint')}
          checked={settings.wrongAffectsStars}
          onChange={(e) => void updateSetting('wrongAffectsStars', e.target.checked)}
        />
        <Row label={t('report')} hint={t('reportHint')}>
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
      </Section>

      {/* The coach's note: on or off for this player; the key is the phone's. */}
      <Section title={t('settingsCoach')}>
        <SettingsToggle label={t('coachToggle')} hint={t('coachToggleHint')} checked={settings.coach} onChange={(e) => void updateSetting('coach', e.target.checked)} />
        <form
          className={styles.row}
          onSubmit={(e) => {
            e.preventDefault()
            saveKey()
          }}
        >
          <Field
            label={t('coachKey')}
            hint={t('coachKeyHint')}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={keyDraft}
            onChange={(e) => {
              setKeyDraft(e.target.value)
              setKeyCheck(null)
            }}
          />
          <p className={styles.muted}>{savedKey ? t('coachKeySaved', { hint: keyHint(savedKey) }) : t('coachKeyNone')}</p>
          <div className={styles.actions}>
            <Button type="submit" size="sm" disabled={!keyDraft.trim()}>
              {t('coachKeySave')}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!keyDraft.trim() && !savedKey} onClick={() => void testKey()}>
              {keyCheck === 'testing' ? t('coachTesting') : t('coachKeyTest')}
            </Button>
            {savedKey && (
              <Button type="button" size="sm" variant="ghost" onClick={removeKey}>
                {t('coachKeyRemove')}
              </Button>
            )}
          </div>
          {keyCheck && keyCheck !== 'testing' && (
            <p className={keyCheck === 'ok' ? styles.message : styles.problem} role="status">
              {t(KEY_CHECK[keyCheck])}
            </p>
          )}
        </form>
      </Section>

      {/* What's on this phone: the family's progress, and keeping it safe. */}
      <Section title={t('settingsPhone')}>
        <div className={styles.row}>
          <div>
            <Button variant="outline" onClick={() => navigate({ name: 'progress' })}>
              {t('progress')}
            </Button>
          </div>
          <p className={styles.hint}>{t('progressHint')}</p>
        </div>
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
                setPendingRestore(e.target.files?.[0] ?? null)
                setMessage(null)
                e.target.value = ''
              }}
            />
          </div>
          {pendingRestore && (
            <div className={styles.confirm} role="alertdialog" aria-label={t('restoreConfirm')}>
              <p className={styles.confirmText}>{t('restoreConfirm')}</p>
              <div className={styles.actions}>
                <Button variant="danger" onClick={() => void restore(pendingRestore)}>
                  {t('restoreConfirmYes')}
                </Button>
                <Button variant="ghost" onClick={() => setPendingRestore(null)}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          )}
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
      </Section>

      {/* The Yamaha: its connection and the hardware tests. */}
      <Section title={t('settingsKeyboard')}>
        <div className={styles.row}>
          <div>
            <Button variant="outline" onClick={() => navigate({ name: 'diagnostics' })}>
              {t('diagnostics')}
            </Button>
          </div>
          <p className={styles.hint}>{t('diagnosticsHint')}</p>
        </div>
      </Section>
      <p className={styles.hint}>{t('release', { n: RELEASE })}</p>
    </main>
  )
}
