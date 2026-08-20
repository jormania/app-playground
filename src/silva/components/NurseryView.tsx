import { useState } from 'react'
import { Button } from '../../ds'
import { fadeRatio, daysRemaining, DEFAULT_SEASON_DAYS } from '../lib/understory'
import type { Thing } from '../lib/notion'
import styles from './NurseryView.module.css'

export interface NurseryViewProps {
  things: Thing[]
  onKeep: (id: string, note?: string) => void
  onRelease: (id: string) => void
  seasonDays?: number
}

/** Unkept arrivals, each shown with its remaining season as a fade rather
 *  than a countdown number (SILVA.md: "the understory... with their
 *  remaining season shown as a fade rather than a number"). */
export function NurseryView({ things, onKeep, onRelease, seasonDays = DEFAULT_SEASON_DAYS }: NurseryViewProps) {
  // Why this, right when you decide it matters — SILVA.md's Keep → Annotate
  // step, without making Keep itself wait on it. Collapsed by default so the
  // one-tap keep nobody wants to slow down stays one tap; only a row you
  // deliberately open costs anything.
  const [openId, setOpenId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  if (things.length === 0) {
    return <p className={styles.empty}>The nursery is empty. Type or paste something to begin.</p>
  }

  function keep(id: string) {
    const note = drafts[id]?.trim()
    onKeep(id, note || undefined)
    setOpenId(null)
  }

  return (
    <ul className={styles.list}>
      {things.map((thing) => {
        const fade = fadeRatio(thing, seasonDays)
        const remaining = Math.max(0, Math.ceil(daysRemaining(thing, seasonDays)))
        // SILVA.md: the remaining season is "shown as a fade rather than a
        // number" — "No badge, no counter". The countdown that used to sit
        // under every row was exactly the debt-clock the understory is
        // designed not to be. The number survives only as a title/label, for
        // anyone who deliberately asks (and for screen readers, which cannot
        // read an opacity).
        const seasonText = remaining > 0
          ? `${remaining} day${remaining === 1 ? '' : 's'} of this season left`
          : 'fading out of the nursery'
        const isOpen = openId === thing.id
        return (
          <li
            key={thing.id}
            className={styles.row}
            style={{ opacity: 0.4 + fade * 0.6 }}
            title={seasonText}
          >
            <div className={styles.body}>
              {thing.kind && <span className={styles.kind}>{thing.kind}</span>}
              <p className={styles.text}>{thing.body}</p>
              <span
                className={styles.season}
                role="img"
                aria-label={seasonText}
                style={{ ['--season-left' as string]: `${Math.round(fade * 100)}%` }}
              />
              {isOpen ? (
                <textarea
                  className={styles.whyInput}
                  autoFocus
                  rows={2}
                  placeholder="Why this. What it rhymed with."
                  value={drafts[thing.id] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [thing.id]: e.target.value }))}
                />
              ) : (
                <button type="button" className={styles.whyToggle} onClick={() => setOpenId(thing.id)}>
                  + Why
                </button>
              )}
            </div>
            <div className={styles.actions}>
              <Button size="sm" variant="primary" onClick={() => keep(thing.id)}>
                Keep
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onRelease(thing.id)}>
                Release
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
