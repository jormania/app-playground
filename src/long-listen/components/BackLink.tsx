import type { ReactNode } from 'react'
import { backHref } from '../app/router'
import s from '../styles/editorial.module.css'

/**
 * "← <where you were>": the one way back, on every screen that has one.
 * Set small above the page (or at its foot, under the last action), with the
 * app's fleuron drawn out into a rule between it and what it leads away from —
 * a diamond, then a fine accent line fading to the right.
 *
 * `back` follows the trail: the page just left, by its name, when there is one
 * (a composer reached from the programme goes back to the programme) — `to`
 * and `label` otherwise. `aside` shares the row (the listening view's Focus).
 */
export function BackLink({ to, label, back = false, at = 'top', aside }: {
  to: string
  label: string
  back?: boolean
  at?: 'top' | 'foot'
  aside?: ReactNode
}) {
  const way = back ? backHref({ to, label }) : { to, label }
  const rule = <div className={s.backRule} aria-hidden="true" />
  return (
    <nav className={at === 'top' ? s.backBar : `${s.backBar} ${s.backBarFoot}`} aria-label="Back">
      {at === 'foot' && rule}
      <div className={s.backRow}>
        <p className={`${s.eyebrow} ${s.mb0}`}><a className={`${s.quietLink} ${s.backLink}`} href={way.to}>← {way.label}</a></p>
        {aside}
      </div>
      {at === 'top' && rule}
    </nav>
  )
}
