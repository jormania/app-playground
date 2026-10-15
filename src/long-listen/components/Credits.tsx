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

/** Who played, as one line of names in reading order ("Pierre Monteux · London Symphony Orchestra"): `sep` where the line sits among other dots. */
export function performerLine(r: Performers, sep = ' · '): string {
  return creditRows(r).map(([, name]) => name).join(sep)
}

/**
 * Who plays, each name led by a small role mark — conductor, the soloist and
 * their instrument, orchestra — flowing on one line and wrapping only when it
 * must. As tight as the old "A · B" line, but a conductor and an orchestra
 * never read as one long name, and a concerto's soloists are always named.
 * Takes the type size of where it sits (`className`); `after` adds a trailing
 * note, such as a duration.
 */
export function Credits({ r, className, after, empty, programme }: { r: Performers; className?: string; after?: React.ReactNode; empty?: string; programme?: boolean }) {
  if (programme) return <ProgrammeCredits r={r} className={className} empty={empty} />
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

/**
 * The performers as a printed programme sets them: one to a line, name first
 * and the role after it in italic — soloists, then the orchestra or ensemble,
 * then the conductor ("Pierre Boulez *conductor*"). An orchestra needs no role
 * word; it is one. For the two pages that are programmes — a week's works and
 * a concert — while lists elsewhere keep the compact line above.
 */
export function programmeCreditRows(r: Performers): [name: string, role: string][] {
  return [
    ...r.soloists.map((x): [string, string] => [x.name, x.instrument ?? 'soloist']),
    ...(r.orchestra ? [[r.orchestra, ''] as [string, string]] : []),
    ...(r.ensemble ? [[r.ensemble, ''] as [string, string]] : []),
    ...(r.conductor ? [[r.conductor, 'conductor'] as [string, string]] : []),
  ]
}

function ProgrammeCredits({ r, className, empty }: { r: Performers; className?: string; empty?: string }) {
  const rows = programmeCreditRows(r)
  if (!rows.length && !empty) return null
  return (
    <p className={className ? `${s.programmeCredits} ${className}` : s.programmeCredits}>
      {rows.map(([name, role], i) => (
        <span key={i} className={s.programmeCredit}>{name}{role && <> <em className={s.programmeRole}>{role}</em></>}</span>
      ))}
      {!rows.length && empty && <span>{empty}</span>}
    </p>
  )
}
