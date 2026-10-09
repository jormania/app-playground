import type { ProposedRecording } from '../domain/types'
import s from '../styles/editorial.module.css'

/**
 * Who plays a recording, each name led by a small role mark — conductor,
 * orchestra (or ensemble), and the soloist's instrument — flowing on one line
 * and wrapping only when it must. As tight as the old "A · B" line, but a
 * conductor and an orchestra never read as one long name.
 */
export function Credits({ r }: { r: Pick<ProposedRecording, 'conductor' | 'orchestra' | 'ensemble' | 'soloists'> }) {
  const rows: [string, string][] = [
    ...r.soloists.map((x): [string, string] => [x.instrument ?? 'soloist', x.name]),
    ...(r.conductor ? [['conductor', r.conductor] as [string, string]] : []),
    ...(r.orchestra ? [['orchestra', r.orchestra] as [string, string]] : []),
    ...(r.ensemble ? [['ensemble', r.ensemble] as [string, string]] : []),
  ]
  if (!rows.length) return null
  return (
    <p className={s.credits}>
      {rows.map(([role, name], i) => (
        <span key={i} className={s.credit}><span className={s.creditRole}>{role}</span> {name}</span>
      ))}
    </p>
  )
}
