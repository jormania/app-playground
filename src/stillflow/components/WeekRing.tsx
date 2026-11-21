import { weekRing } from '../lib/today'
import s from '../screens/screens.module.css'

/** Minutes this week against your goal, as a quiet ring. */
export function WeekRing({ minutes, sessions, target, link = true }: { minutes: number; sessions: number; target?: number; link?: boolean }) {
  const r = 26
  const c = 2 * Math.PI * r
  const { frac, label } = weekRing(minutes, target)
  const Tag = link ? 'a' : 'div'
  return (
    <Tag {...(link ? { href: '#/practice' } : {})} className={s.weekRing} aria-label={`This week: ${sessions} ${sessions === 1 ? 'practice' : 'practices'}, ${label}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className={s.ringTrack} />
        {frac > 0 && <circle cx="32" cy="32" r={r} className={s.ringFill} strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 32 32)" />}
      </svg>
      <span className={s.weekRingText}>
        <strong>{minutes}</strong>
        <small>{target ? `of ${target} min` : 'min'} this week</small>
      </span>
    </Tag>
  )
}

