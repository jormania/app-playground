import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../ds'
import { readAiKey } from '../ai'
import { useApp } from '../context'
import type { LogRecord } from '../log'
import type { Profile } from '../profiles'
import { earnedStickers, STICKERS } from '../screens/stickers'
import { askWeekly, weekFacts, WeeklyRepo, withName, type KeptWeekly } from './weekly'
import { localDate } from './summary'
import styles from './progress.module.css'

/** Long enough for a slow connection; the button comes back after it. */
const WEEKLY_TIMEOUT_MS = 25_000

/**
 * The weekly note at the top of Progress: written by Claude when asked, kept
 * until asked again. Without a key it says where one goes.
 */
export function WeeklyNote({ player, records, titles, levels }: { player: Profile; records: readonly LogRecord[]; titles: Map<string, string>; levels: Map<string, 1 | 2 | 3> }) {
  const { t, store, settings } = useApp()
  const repo = useMemo(() => new WeeklyRepo(store), [store])
  const [kept, setKept] = useState<KeptWeekly | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const key = readAiKey()
  /** Just written: the note appears above the button, so it's brought into view (on a phone on its side it would be off the top). */
  const [fresh, setFresh] = useState(false)
  const noteRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!fresh) return
    noteRef.current?.scrollIntoView?.({ block: 'nearest', behavior: matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    setFresh(false)
  }, [fresh])

  useEffect(() => {
    setFailed(false)
    void repo.get(player.id).then(setKept)
  }, [repo, player.id])

  const day = (d: string) => new Date(`${d}T12:00`).toLocaleDateString(settings.language === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short' })

  const write = async () => {
    setBusy(true)
    setFailed(false)
    const today = localDate(new Date().toISOString())
    const facts = weekFacts({
      records,
      today,
      title: (id) => titles.get(id) ?? id,
      stickers: earnedStickers(records, (id) => levels.get(id)),
      stickerName: (id) => {
        const s = STICKERS.find((x) => x.id === id)
        return s ? t(s.title) : id
      },
    })
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), WEEKLY_TIMEOUT_MS)
    const text = await askWeekly(key, facts, settings.language, { signal: abort.signal })
    clearTimeout(timer)
    if (text) {
      const note: KeptWeekly = { date: today, language: settings.language, text }
      await repo.keep(player.id, note)
      setKept(note)
      setFresh(true)
    } else setFailed(true)
    setBusy(false)
  }

  if (!key && !kept) return <p className={styles.hint}>{t('pWeeklyNoKey')}</p>
  return (
    <section className={`${styles.panel} ${styles.weekly}`} aria-busy={busy}>
      <h2 className={styles.h2}>{t('pWeekly')}</h2>
      {kept && (
        <>
          <p ref={noteRef} className={styles.weeklyText}>
            {withName(kept.text, player.name)}
          </p>
          <p className={styles.hint}>{t('pWeeklyWritten', { date: day(kept.date) })}</p>
        </>
      )}
      {failed && <p className={styles.problem}>{t('pWeeklyFailed')}</p>}
      {key && (
        <div>
          <Button size="sm" variant={kept ? 'outline' : 'primary'} disabled={busy} onClick={() => void write()}>
            {busy ? t('pWeeklyWriting') : kept ? t('pWeeklyAgain') : t('pWeeklyWrite')}
          </Button>
        </div>
      )}
    </section>
  )
}
