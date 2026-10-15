import type { Concert } from '../domain/types'
import { displaySurname } from '../domain/identity'
import { unplaced, whoPlays } from '../domain/concertSoloists'
import { venueShort } from '../live/live'
import { href } from '../app/router'
import { Credits } from './Credits'
import s from '../styles/editorial.module.css'

/** "Thu 16 October 2026" */
export const concertDate = (d: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))

/**
 * One concert heard live, as a row — on All concerts and in the Journal's
 * week. The place as the title (the venue's everyday name, and the hall), the
 * date beneath, who played, the works one to a line with each one's soloists,
 * and what was said of it.
 */
export function ConcertEntry({ concert: c, className }: { concert: Concert; className?: string }) {
  const place = venueShort(c.venue)
  return (
    <div className={`${s.journalConcert}${className ? ` ${className}` : ''}`}>
      <a className={`${s.journalConcertTitle} ${s.quietLink}`} href={href({ name: 'concert', id: c.id })}>{place.charAt(0).toUpperCase()}{place.slice(1)}{c.hall ? `, ${c.hall}` : ''}</a>
      <p className={`${s.faint} ${s.flush}`}>{concertDate(c.date)}</p>
      {/* The evening's own soloists here; each work's beside it. */}
      <Credits r={{ conductor: c.conductor, orchestra: c.orchestra, soloists: unplaced(c) }} />
      <ul className={s.concertWorkList}>
        {c.works.map((w, i) => {
          const who = whoPlays(c, w)
          return <li key={i}>{displaySurname(w.composer)}, <em>{w.title}</em>{who.length > 0 && <span className={s.faint}> · {who.map((x) => x.name).join(', ')}</span>}</li>
        })}
      </ul>
      {c.note && <p className={s.said}><q>{c.note}</q></p>}
    </div>
  )
}
