import { useEffect, useState } from 'react'
import { Button } from '../../../ds'
import { useApp } from '../context'
import { localDate } from '../progress/summary'
import { SongLibrary } from '../songs/library'
import { K } from '../store'
import { isDone, sameTodayItem, type TodayItem, type TodayPlan } from './today'
import { openToday, todayLabel } from './TodayCard'
import styles from '../app.module.css'

/**
 * At the end of something Today asked for (a song, a step, a game), the next
 * of Today's four not done yet, one tap away: Today is meant to be played
 * through in five minutes, not reached back to Home for each. Shown only when
 * what just ended is on today's card; nothing when the rest is done.
 */
export function TodayNext({ current }: { current: TodayItem }) {
  const { t, store, log, profile, settings } = useApp()
  const [next, setNext] = useState<{ item: TodayItem; label: string } | null>(null)
  const key = JSON.stringify(current)

  useEffect(() => {
    if (!profile) return
    let live = true
    void (async () => {
      const date = localDate(new Date().toISOString())
      const plan = await store.get<TodayPlan>(K.today(profile.id))
      const here: TodayItem = JSON.parse(key)
      if (plan?.date !== date || !plan.items.some((i) => sameTodayItem(i, here))) return
      const [records, songs] = await Promise.all([log.read(profile.id), new SongLibrary(store).list(settings.language)])
      const titles = new Map(songs.map((e) => [e.song.id, e.song.title]))
      for (const item of plan.items) {
        if (sameTodayItem(item, here) || isDone(item, records, date)) continue
        const label = todayLabel(item, t, titles)
        if (label) {
          if (live) setNext({ item, label })
          return
        }
      }
    })()
    return () => {
      live = false
    }
  }, [profile, store, log, settings.language, key, t])

  if (!next || !profile) return null
  return (
    <div className={styles.todayNext}>
      <span className={styles.todayNextLabel}>☀️ {t('todayNext')}</span>
      <Button size="sm" variant="outline" onClick={() => openToday(next.item, log, profile.id)}>
        {next.label}
      </Button>
    </div>
  )
}
