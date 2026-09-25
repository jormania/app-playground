import { useEffect, useState } from 'react'
import { celebrate } from '../celebrate/celebrate'
import { useApp } from '../context'
import { earnedStickers, markSeen, seenStickers, STICKERS } from './stickers'
import styles from '../app.module.css'

/** Home's stickers: every one there is, the earned ones in colour. A new one is announced once. */
export function StickerShelf() {
  const { t, store, log, profile, settings } = useApp()
  const [earned, setEarned] = useState<Map<string, string> | null>(null)
  const [fresh, setFresh] = useState<string[]>([])
  const [chosen, setChosen] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    let live = true
    void (async () => {
      const [records, seen] = await Promise.all([log.read(profile.id), seenStickers(store, profile.id)])
      const e = earnedStickers(records)
      const now = [...e.keys()].filter((id) => !seen.has(id))
      if (!live) return
      setEarned(e)
      setFresh(now)
      if (now.length) {
        celebrate('newBest')
        void markSeen(store, profile.id, now)
      }
    })()
    return () => {
      live = false
    }
  }, [profile, log, store])

  if (!earned) return null
  const day = (d: string) => new Date(`${d}T12:00`).toLocaleDateString(settings.language === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short' })
  const name = (id: string) => t(STICKERS.find((s) => s.id === id)!.title)
  const line = chosen ? (earned.has(chosen) ? t('stickerEarnedOn', { name: name(chosen), date: day(earned.get(chosen)!) }) : t('stickerNotYet', { name: name(chosen) })) : fresh.length === 1 ? t('stickerNew', { name: name(fresh[0]) }) : fresh.length > 1 ? t('stickersNew', { count: fresh.length }) : null

  return (
    <section className={styles.stickers} aria-labelledby="stickers-title">
      <div className={styles.todayHead}>
        <h2 id="stickers-title" className={styles.todayTitle}>
          {t('stickersTitle')}
        </h2>
        <span className={styles.todayHint}>{t('stickersCount', { earned: earned.size, total: STICKERS.length })}</span>
      </div>
      <ul className={styles.stickerRow}>
        {STICKERS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={styles.sticker}
              data-earned={earned.has(s.id) || undefined}
              data-new={fresh.includes(s.id) || undefined}
              aria-pressed={chosen === s.id}
              aria-label={`${t(s.title)}${earned.has(s.id) ? '' : ` · ${t('stickerNotYetShort')}`}`}
              onClick={() => setChosen((c) => (c === s.id ? null : s.id))}
            >
              <span aria-hidden>{s.icon}</span>
            </button>
          </li>
        ))}
      </ul>
      {line && (
        <p className={styles.stickerLine} aria-live="polite">
          {line}
        </p>
      )}
    </section>
  )
}
