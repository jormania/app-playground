import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../../ds'
import { useApp } from '../context'
import type { StringKey } from '../i18n'
import { K, update } from '../store'
import styles from '../app.module.css'

// A first look at a game or the Journey (KEYPATH_TUTOR.md §9, "Release 5"):
// half a screen on what it is and how to play, the first time it is opened
// and every time after until she says not to. For a player who won't read
// the guide. Kept per player, like everything she chooses.

export type IntroId = 'journey' | 'race' | 'echo' | 'chord' | 'ear' | 'read'

export const INTROS: Record<IntroId, { icon: string; title: StringKey; lines: StringKey[] }> = {
  journey: { icon: '🧭', title: 'doorJourney', lines: ['introJourney1', 'introJourney2', 'introJourney3'] },
  race: { icon: '🏁', title: 'raceTitle', lines: ['introRace1', 'introRace2', 'introRace3'] },
  echo: { icon: '🥁', title: 'echoTitle', lines: ['introEcho1', 'introEcho2', 'introEcho3'] },
  chord: { icon: '🎹', title: 'chordTitle', lines: ['introChord1', 'introChord2', 'introChord3'] },
  ear: { icon: '👂', title: 'earTitle', lines: ['introEar1', 'introEar2', 'introEar3'] },
  read: { icon: '📖', title: 'readTitle', lines: ['introRead1', 'introRead2', 'introRead3'] },
}

/** Which intros this player has asked not to see again. */
export class IntroRepo {
  constructor(private readonly store: import('../store').KeyValueStore) {}
  async dismissed(profileId: string): Promise<string[]> {
    return (await this.store.get<string[]>(K.intros(profileId))) ?? []
  }
  async dismiss(profileId: string, id: IntroId): Promise<void> {
    await update<string[]>(this.store, K.intros(profileId), (now = []) => (now.includes(id) ? now : [...now, id]))
  }
}

/** Whether the intro is showing, and the ways to close it: for now, for good, or to see it again. */
export function useIntro(id: IntroId) {
  const { store, profile } = useApp()
  const [open, setOpen] = useState(false)
  const profileId = profile?.id ?? null
  useEffect(() => {
    if (!profileId) return
    let live = true
    void new IntroRepo(store).dismissed(profileId).then((d) => live && setOpen(!d.includes(id)))
    return () => {
      live = false
    }
  }, [store, profileId, id])
  const close = useCallback(() => setOpen(false), [])
  const never = useCallback(() => {
    setOpen(false)
    if (profileId) void new IntroRepo(store).dismiss(profileId, id)
  }, [store, profileId, id])
  const show = useCallback(() => setOpen(true), [])
  return { open, close, never, show }
}

/** The card itself, over the screen: what it is, in three lines, and two ways out. */
export function IntroCard({ id, open, onClose, onNever }: { id: IntroId; open: boolean; onClose: () => void; onNever: () => void }) {
  const { t } = useApp()
  const go = useRef<HTMLButtonElement>(null)
  // Focus on the way on, without scrolling the card away from its title.
  useEffect(() => {
    if (open) go.current?.focus({ preventScroll: true })
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const intro = INTROS[id]
  // On the page itself, not inside the screen: a screen's transitions would hold a fixed card inside its own height.
  return createPortal(
    <div className={styles.introBackdrop} onClick={onClose}>
      <section className={styles.introCard} role="dialog" aria-modal="true" aria-labelledby={`intro-${id}`} onClick={(e) => e.stopPropagation()}>
        <span className={styles.introIcon} aria-hidden>
          {intro.icon}
        </span>
        <h2 id={`intro-${id}`} className={styles.introTitle}>
          {t(intro.title)}
        </h2>
        <ul className={styles.introLines}>
          {intro.lines.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
        <div className={styles.introActions}>
          <Button ref={go} onClick={onClose}>
            {t('introGo')}
          </Button>
          <Button variant="ghost" onClick={onNever}>
            {t('introNever')}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

/** "How it works": the intro again, after it was closed or turned off. */
export function IntroLink({ onShow }: { onShow: () => void }) {
  const { t } = useApp()
  return (
    <button type="button" className={styles.introLink} onClick={onShow}>
      ⓘ {t('introAgain')}
    </button>
  )
}
