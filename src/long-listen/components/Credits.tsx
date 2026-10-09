import type { ProposedRecording } from '../domain/types'
import s from '../styles/editorial.module.css'

type Performers = Pick<ProposedRecording, 'conductor' | 'orchestra' | 'ensemble' | 'soloists'>

/** The performers in reading order — conductor, soloists, orchestra or ensemble — each with its role. */
export function creditRows(r: Performers): [role: string, name: string][] {
  return [
    ...(r.conductor ? [['conductor', r.conductor] as [string, string]] : []),
    ...r.soloists.map((x): [string, string] => [x.instrument ? `${x.instrument} soloist` : 'soloist', x.name]),
    ...(r.orchestra ? [['orchestra', r.orchestra] as [string, string]] : []),
    ...(r.ensemble ? [['ensemble', r.ensemble] as [string, string]] : []),
  ]
}

/**
 * Who plays, each name led by a small role mark — conductor, the soloist and
 * their instrument, orchestra — flowing on one line and wrapping only when it
 * must. As tight as the old "A · B" line, but a conductor and an orchestra
 * never read as one long name, and a concerto's soloists are always named.
 * Takes the type size of where it sits (`className`); `after` adds a trailing
 * note, such as a duration.
 */
export function Credits({ r, className, after, empty }: { r: Performers; className?: string; after?: React.ReactNode; empty?: string }) {
  const rows = creditRows(r)
  if (!rows.length && !empty && !after) return null
  return (
    <p className={className ? `${s.credits} ${className}` : s.credits}>
      {rows.map(([role, name], i) => (
        <span key={i} className={s.creditItem}><span className={s.creditRole}>{role}</span> {name}</span>
      ))}
      {!rows.length && empty && <span>{empty}</span>}
      {after && <span className={s.creditAfter}>{after}</span>}
    </p>
  )
}
