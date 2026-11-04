import { useEffect, useState } from 'react'
import { SegmentedControl } from '../../ds'
import { hasHealthKey, fetchSleep, localDate, HEALTH_PAGE } from '../../shared/googleHealth'
import { loadNights } from '../lib/nights'
import { matchNights, compareBy, hm } from '../lib/sleepMatch'
import styles from './SleepNights.module.css'

const LINK_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
]

const SHOWN = 7
const LOOKBACK_DAYS = 45

const DIMENSIONS = [
  ['blend', 'by blend'],
  ['breathwork', 'by breath'],
  ['screen', 'by screen'],
]

function dayLabel(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Lives at the foot of Settings and nowhere else. Yoru's own screens — Home, the
// session, the close — carry no numbers, and this doesn't change that: a sleep
// score glimpsed at bedtime is exactly the kind of thing that keeps you awake.
// Off by default; it reads the band only while this section is open and on.
export default function SleepNights({ enabled, onToggle }) {
  const [state, setState] = useState({ status: 'idle', matched: [] })
  const keySet = hasHealthKey()

  useEffect(() => {
    if (!enabled || !keySet) return
    const nights = loadNights()
    if (!nights.length) {
      setState({ status: 'empty', matched: [] })
      return
    }
    let live = true
    setState({ status: 'loading', matched: [] })
    const now = Date.now()
    const oldest = Math.max(nights[nights.length - 1].startedAt, now - LOOKBACK_DAYS * 86400000)
    // Wake-up dates: a night begun on the evening of `oldest` ends the day after.
    fetchSleep(localDate(oldest), localDate(now))
      .then((sleeps) => live && setState({ status: 'ready', matched: matchNights(nights, sleeps) }))
      .catch((err) => live && setState({ status: 'error', message: err.message, matched: [] }))
    return () => { live = false }
  }, [enabled, keySet])

  const matched = state.matched.filter((n) => n.sleep)
  const comparisons = DIMENSIONS.map(([dim, title]) => [title, compareBy(state.matched, dim)]).filter(([, rows]) => rows)

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.label}>nights &amp; sleep</span>
        <SegmentedControl options={LINK_OPTIONS} value={enabled ? 'on' : 'off'} onChange={(v) => onToggle(v === 'on')} />
      </div>

      {enabled && !keySet && (
        <p className={styles.hint}>
          Pairs each night here with the sleep your band recorded.{' '}
          <a className={styles.link} href={HEALTH_PAGE}>Connect this device to Google Health →</a>
        </p>
      )}

      {enabled && keySet && state.status === 'loading' && <p className={styles.hint}>reading the band…</p>}
      {enabled && keySet && state.status === 'empty' && (
        <p className={styles.hint}>No nights yet. Each one you begin from here on is remembered on this device.</p>
      )}
      {enabled && keySet && state.status === 'error' && <p className={styles.hint}>{state.message}</p>}

      {enabled && keySet && state.status === 'ready' && (
        <>
          <ul className={styles.nights}>
            {state.matched.slice(0, SHOWN).map((n) => (
              <li key={n.startedAt} className={styles.night}>
                <span className={styles.when}>{dayLabel(n.startedAt)} · {n.blend}</span>
                {n.sleep ? (
                  <span className={styles.what}>
                    asleep {n.latency}′ after you began · {hm(n.sleep.minutesAsleep)}
                    {n.sleep.deep !== null && <> · deep {hm(n.sleep.deep)}</>}
                  </span>
                ) : (
                  <span className={styles.what}>no sleep recorded for this night (yet)</span>
                )}
              </li>
            ))}
          </ul>

          {comparisons.length > 0 ? (
            <div className={styles.compare}>
              {comparisons.map(([title, rows]) => (
                <p key={title} className={styles.line}>
                  <span className={styles.dim}>{title}</span>{' '}
                  {rows.map((r, i) => (
                    <span key={r.label}>
                      {i > 0 && ' · '}
                      {r.label} <b>{r.latency}′</b> ({r.nights})
                    </span>
                  ))}
                </p>
              ))}
              <p className={styles.caveat}>
                Median minutes from Begin to sleep. You pick a blend by mood, so a slow one may simply be a restless
                night&apos;s choice — read it as a hint, and it sharpens with more nights.
              </p>
            </div>
          ) : (
            <p className={styles.hint}>
              {matched.length} of {state.matched.length} nights paired. A comparison appears once two choices each
              have three nights.
            </p>
          )}
        </>
      )}
    </div>
  )
}
