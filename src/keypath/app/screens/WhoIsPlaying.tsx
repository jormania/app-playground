import { useEffect, useState } from 'react'
import { Button, Field, SegmentedControl } from '../../../ds'
import { useApp } from '../context'
import { translate, type StringKey } from '../i18n'
import { AVATARS, DEFAULT_PROFILE_SETTINGS, PIN_LENGTH, type Language, type Profile } from '../profiles'
import { requestPersistence } from '../store'
import styles from '../app.module.css'

export function WhoIsPlaying({ onChosen }: { onChosen: () => void }) {
  const { profiles, log, choose } = useApp()
  // Before anyone is chosen there are no settings yet: the screen speaks the
  // language being picked for the new player, so a Romanian speaker can read it.
  const [language, setLanguage] = useState<Language>(DEFAULT_PROFILE_SETTINGS.language)
  const t = (key: StringKey, vars?: Record<string, string | number>) => translate(language, key, vars)
  const [list, setList] = useState<Profile[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string>(AVATARS[0])

  useEffect(() => {
    void profiles.list().then((l) => {
      setList(l)
      if (l.length === 0) setAdding(true)
    })
  }, [profiles])

  /** The player whose PIN is being asked, what has been typed, and whether it was wrong. */
  const [asking, setAsking] = useState<Profile | null>(null)
  const [pinDraft, setPinDraft] = useState('')
  const [pinWrong, setPinWrong] = useState(false)
  const [forgot, setForgot] = useState(false)

  const open = async (p: Profile) => {
    await choose(p)
    onChosen()
  }
  const pick = async (p: Profile) => {
    if (!p.pin) return open(p)
    setAsking(p)
    setPinDraft('')
    setPinWrong(false)
    setForgot(false)
  }
  const tryPin = async (pin: string) => {
    if (!asking) return
    if (await profiles.checkPin(asking, pin)) return open(asking)
    setPinWrong(true)
    setPinDraft('')
  }
  /** The PIN is a guard against mix-ups: whoever holds the phone can take it off. */
  const forgotPin = async () => {
    if (!asking) return
    await profiles.setPin(asking.id, null)
    const { pin: _gone, ...rest } = asking
    await open(rest)
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const p = await profiles.create(name, avatar)
    if (language !== DEFAULT_PROFILE_SETTINGS.language) await profiles.saveSettings(p.id, { ...DEFAULT_PROFILE_SETTINGS, language })
    await log.add(p.id, { type: 'profile_created' })
    // The first real data on this phone: ask Chrome to keep it (store.ts).
    void requestPersistence()
    await pick(p)
  }

  if (list === null) return null
  return (
    <main className={styles.screen}>
      <h1 className={styles.hero}>{t('whoIsPlaying')}</h1>
      {asking && (
        <form
          className={styles.panel}
          onSubmit={(e) => {
            e.preventDefault()
            void tryPin(pinDraft)
          }}
        >
          <h2 className={styles.h2}>
            <span aria-hidden>{asking.avatar}</span> {t('pinFor', { name: asking.name })}
          </h2>
          <Field
            label={t('pinLabel')}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH}
            value={pinDraft}
            onChange={(e) => {
              const pin = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
              setPinDraft(pin)
              setPinWrong(false)
              // The fourth digit opens it: no button to find on a small screen.
              if (pin.length === PIN_LENGTH) void tryPin(pin)
            }}
            autoFocus
          />
          {pinWrong && (
            <p className={styles.problem} role="alert">
              {t('pinWrong')}
            </p>
          )}
          {forgot && <p className={styles.hint}>{t('pinForgotHint')}</p>}
          <div className={styles.actions}>
            <Button type="submit" disabled={pinDraft.length !== PIN_LENGTH}>
              {t('pinOpen')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAsking(null)}>
              {t('cancel')}
            </Button>
            {forgot ? (
              <Button type="button" variant="outline" onClick={() => void forgotPin()}>
                {t('pinRemoveAndOpen')}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setForgot(true)}>
                {t('pinForgot')}
              </Button>
            )}
          </div>
        </form>
      )}
      {!adding && !asking && (
        <>
          <div className={styles.profileGrid}>
            {list.map((p) => (
              <button key={p.id} type="button" className={styles.profileCard} onClick={() => pick(p)}>
                <span className={styles.avatar} aria-hidden>
                  {p.avatar}
                </span>
                <span className={styles.profileName}>{p.name}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setAdding(true)}>
            {t('addProfile')}
          </Button>
        </>
      )}
      {adding && (
        <form className={styles.panel} onSubmit={create}>
          <h2 className={styles.h2}>{t('newProfileTitle')}</h2>
          <div className={styles.row}>
            <span className={styles.label}>{t('language')}</span>
            <SegmentedControl
              value={language}
              onChange={(v) => setLanguage(v as Language)}
              options={[
                { value: 'en' satisfies Language, label: 'English' },
                { value: 'ro' satisfies Language, label: 'Română' },
              ]}
            />
          </div>
          <Field label={t('name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus required />
          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>{t('pickFace')}</legend>
            <div className={styles.avatarGrid} role="radiogroup">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={avatar === a}
                  className={`${styles.avatarChoice} ${avatar === a ? styles.avatarChosen : ''}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </fieldset>
          <div className={styles.actions}>
            <Button type="submit" disabled={!name.trim()}>
              {t('create')}
            </Button>
            {list.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                {t('cancel')}
              </Button>
            )}
          </div>
        </form>
      )}
    </main>
  )
}
