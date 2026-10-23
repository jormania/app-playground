import type { ProposedRecording } from '../domain/types'
import { href } from '../app/router'
import { keepAhead } from '../app/kept'
import s from '../styles/editorial.module.css'

/** The Library's search, kept for the tab (screens/Library.tsx). */
const LIBRARY_SEARCH = 'library-search'
/** Told to the Library when a name is tapped on the Library itself: no route change there to read the search afresh. */
export const SEARCH_EVENT = 'long-listen:library-search'

/**
 * A performer's name that leads somewhere: the Library, searched for them — the
 * recordings of theirs met so far, and the concerts they played. Names used to
 * be plain text everywhere, though "a performer's week" is one of the curator's forms.
 */
export function PerformerName({ name }: { name: string }) {
  return <a href={href({ name: 'library' })} className={s.performerLink} onClick={() => { keepAhead(LIBRARY_SEARCH, 'tab', name); window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: name })) }}>{name}</a>
}

/** The performers on one line, each name a way to the Library ("Pierre Boulez · Gil Shaham · Chicago Symphony Orchestra"). */
export function PerformerLine({ r, className }: { r: Performers; className?: string }) {
  const rows = creditRows(r)
  if (!rows.length) return null
  return <p className={className}>{rows.map(([, name], i) => <span key={i}>{i > 0 && ' · '}<PerformerName name={name} /></span>)}</p>
}

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
        <span key={i} className={s.creditItem}><span className={s.creditRole}>{role}</span> <PerformerName name={name} /></span>
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
        <span key={i} className={s.programmeCredit}><PerformerName name={name} />{role && <> <em className={s.programmeRole}>{role}</em></>}</span>
      ))}
      {!rows.length && empty && <span>{empty}</span>}
    </p>
  )
}
