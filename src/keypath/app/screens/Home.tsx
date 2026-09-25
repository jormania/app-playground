import { useEffect, useMemo, useState } from 'react'
import { backupDue } from '../backup'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import { rememberedKeyboard, rememberKeyboard } from '../connect/remember'
import connectStyles from '../connect/connect.module.css'
import { useApp } from '../context'
import type { Door } from '../log'
import { navigate } from '../router'
import type { StringKey } from '../i18n'
import { JOURNEY } from '../journey/steps'
import { SongLibrary } from '../songs/library'
import { resumeFrom, type Resume } from './resume'
import styles from '../app.module.css'

const DOORS: { door: Door; icon: string; title: StringKey; blurb: StringKey }[] = [
  { door: 'songs', icon: '🎵', title: 'doorSongs', blurb: 'doorSongsBlurb' },
  { door: 'journey', icon: '🗺️', title: 'doorJourney', blurb: 'doorJourneyBlurb' },
  { door: 'challenges', icon: '⚡', title: 'doorChallenges', blurb: 'doorChallengesBlurb' },
  { door: 'studio', icon: '🎨', title: 'doorStudio', blurb: 'doorStudioBlurb' },
]

/** Four equal doors, no order, no gate (KEYPATH_TUTOR.md §3). */
export function Home() {
  const { profile, t, log, store, settings } = useApp()
  const [nudge, setNudge] = useState(false)

  // "Pick up where you left off": the last song or Journey step in her log.
  const library = useMemo(() => new SongLibrary(store), [store])
  const [resume, setResume] = useState<{ at: Resume; songTitle?: string } | null>(null)
  useEffect(() => {
    if (!profile) return
    void (async () => {
      const at = resumeFrom(await log.read(profile.id))
      if (!at) return setResume(null)
      if (at.kind === 'journey') return setResume({ at })
      const song = await library.get(at.songId, settings.language)
      setResume(song ? { at, songTitle: song.title } : null)
    })()
  }, [profile, log, library, settings.language])
  const resumeStep = resume?.at.kind === 'journey' ? JOURNEY.find((s) => s.id === (resume.at as { step: string }).step) : undefined

  useEffect(() => {
    void backupDue(store).then(setNudge)
  }, [store])

  // Until this phone has reached a keyboard once, the way to connect it is a card, not a footnote.
  const keyboard = useKeyboard()
  const [knownKeyboard, setKnownKeyboard] = useState<boolean | null>(null)
  useEffect(() => {
    void rememberedKeyboard(store).then((k) => setKnownKeyboard(!!k))
  }, [store])
  useEffect(() => {
    if (keyboard.connected && keyboard.name) void rememberKeyboard(store, keyboard.name).then(() => setKnownKeyboard(true))
  }, [keyboard.connected, keyboard.name, store])

  if (!profile) return null
  const open = (door: Door) => {
    void log.add(profile.id, { type: 'door_opened', door })
    navigate({ name: 'door', door })
  }

  return (
    <main className={`${styles.screen} ${styles.homeScreen}`}>
      <header className={styles.homeHeader}>
        <button type="button" className={styles.meButton} onClick={() => navigate({ name: 'settings' })} aria-label={t('settings')}>
          <span className={styles.avatarSmall} aria-hidden>
            {profile.avatar}
          </span>
          <span className={styles.gear} aria-hidden>
            ⚙
          </span>
        </button>
        <div>
          <h1 className={styles.hero}>{t('hello', { name: profile.name })}</h1>
          <p className={styles.sub}>{t('whereToday')}</p>
        </div>
      </header>
      {!keyboard.checking && knownKeyboard === false && !keyboard.connected ? (
        <button type="button" className={connectStyles.card} onClick={() => navigate({ name: 'connect' })}>
          <span className={connectStyles.cardTitle}>🎹 {t('connectCardTitle')}</span>
          <span className={connectStyles.cardBody}>{t('connectCardBody')}</span>
        </button>
      ) : (
        <KeyboardStatus status={keyboard} />
      )}
      {nudge && (
        <button type="button" className={styles.nudge} onClick={() => navigate({ name: 'settings' })}>
          {t('backupDue')}
        </button>
      )}
      {resume && (resume.songTitle || resumeStep) && (
        <button
          type="button"
          className={styles.resume}
          onClick={() => {
            // Through its door, as far as Progress is concerned: time spent there counts to it.
            void log.add(profile.id, { type: 'door_opened', door: resume.at.kind === 'song' ? 'songs' : 'journey' })
            if (resume.at.kind === 'song') navigate({ name: 'play', songId: resume.at.songId })
            else navigate({ name: 'journeyStep', step: resume.at.step })
          }}
        >
          <span className={styles.resumeLabel}>{t('resumeTitle')}</span>
          <span className={styles.resumeWhat}>
            {resume.at.kind === 'song' ? `▶ ${resume.songTitle}` : `🗺️ ${resumeStep ? t(resumeStep.title) : ''}`}
            {resume.at.kind === 'song' && resume.at.bestStars !== null && <span className={styles.resumeStars}> {'★'.repeat(resume.at.bestStars) + '☆'.repeat(Math.max(0, 3 - resume.at.bestStars))}</span>}
          </span>
        </button>
      )}
      <nav className={styles.doors}>
        {DOORS.map((d, i) => (
          <button key={d.door} type="button" className={`${styles.door} ${styles[d.door]}`} style={{ '--i': i } as React.CSSProperties} onClick={() => open(d.door)}>
            <span className={styles.doorIcon} aria-hidden>
              {d.icon}
            </span>
            <span className={styles.doorTitle}>{t(d.title)}</span>
            <span className={styles.doorBlurb}>{t(d.blurb)}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}
