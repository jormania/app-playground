import { Moon } from 'lucide-react'
import s from '../styles/editorial.module.css'

/**
 * The mark of an evening of its own (domain/evenings.ts) wherever it is listed —
 * the Journal's week, Threads, the programme page — so it reads apart from a
 * sitting made beside the week's theme at a glance, as the hall marks a concert.
 */
export function EveningMark() {
  return <Moon size={15} strokeWidth={1.6} aria-hidden="true" className={s.hallMark} />
}

/** "Saturday · an evening of its own", or "Saturday · beside this week's theme". */
export function eveningWords(day: string, own: boolean): string {
  return own ? `${day} · an evening of its own` : `${day} · a sitting beside this week’s theme`
}
