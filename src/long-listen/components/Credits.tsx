import type { ProposedRecording } from '../domain/types'
import s from '../styles/editorial.module.css'

/**
 * Who plays a recording, each named for what they are — Conductor, Orchestra
 * (or Ensemble), Soloist with the instrument — one to a line, rather than one
 * run-on line where a conductor and an orchestra read as a single name.
 */
export function Credits({ r }: { r: Pick<ProposedRecording, 'conductor' | 'orchestra' | 'ensemble' | 'soloists'> }) {
  const rows: [string, string][] = [
    ...r.soloists.map((x): [string, string] => [x.instrument ? `Soloist, ${x.instrument}` : 'Soloist', x.name]),
    ...(r.conductor ? [['Conductor', r.conductor] as [string, string]] : []),
    ...(r.orchestra ? [['Orchestra', r.orchestra] as [string, string]] : []),
    ...(r.ensemble ? [['Ensemble', r.ensemble] as [string, string]] : []),
  ]
  if (!rows.length) return null
  return (
    <dl className={s.credits}>
      {rows.map(([role, name], i) => (
        <div key={i}>
          <dt>{role}</dt>
          <dd>{name}</dd>
        </div>
      ))}
    </dl>
  )
}
