import { useEffect, useState } from 'react'
import { Button, Field } from '../../../ds'
import { useApp } from '../context'
import { AVATARS, type Profile } from '../profiles'
import { requestPersistence } from '../store'
import styles from '../app.module.css'

export function WhoIsPlaying({ onChosen }: { onChosen: () => void }) {
  const { profiles, log, t, choose } = useApp()
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

  const pick = async (p: Profile) => {
    await choose(p)
    onChosen()
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const p = await profiles.create(name, avatar)
    await log.add(p.id, { type: 'profile_created' })
    // The first real data on this phone: ask Chrome to keep it (store.ts).
    void requestPersistence()
    await pick(p)
  }

  if (list === null) return null
  return (
    <main className={styles.screen}>
      <h1 className={styles.hero}>{t('whoIsPlaying')}</h1>
      {!adding && (
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
