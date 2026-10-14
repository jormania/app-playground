import { useState } from 'react'
import { useServices } from '../app/services'
import { glossPieces, sentenceAround } from '../domain/glossary'
import { messageOf } from './common'
import s from '../styles/editorial.module.css'

/**
 * Words on tap: a passage of the curator's notes with its terms (passacaglia,
 * col legno, sonata form) under a faint dotted line. A tap opens two lines
 * from the curator just under the passage — asked once per term, kept, shown
 * at once on every later tap; a second tap folds it. Without a key, the
 * passage is plain text.
 */
export function Gloss({ text }: { text: string }) {
  const { journey, curatorReady, say } = useServices()
  const [open, setOpen] = useState<{ term: string; text?: string } | null>(null)
  if (!curatorReady) return <>{text}</>
  const pieces = glossPieces(text)

  async function tap(term: string) {
    if (open?.term === term) { setOpen(null); return }
    setOpen({ term })
    try {
      const definition = (await journey.definition(term)) ?? (await journey.define(term, sentenceAround(text, term)))
      setOpen((o) => (o?.term === term ? { term, text: definition } : o))
    } catch (e) {
      setOpen((o) => (o?.term === term ? null : o))
      say(messageOf(e), 'danger')
    }
  }

  return (
    <>
      {pieces.map((p, i) => (typeof p === 'string' ? p : (
        // A span acting as a button, not a <button>: a button is an inline block, which a drop cap
        // (::first-letter) and a small-caps first line (::first-line) can't reach into.
        <span
          key={i} role="button" tabIndex={0}
          className={`${s.term} ${open?.term === p.term ? s.termOn : ''}`} aria-expanded={open?.term === p.term}
          onClick={() => void tap(p.term)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void tap(p.term) } }}
        >{p.text}</span>
      )))}
      {open && (
        <span className={s.termNote} role="note" aria-live="polite">
          <span className={s.termWord}>{open.term}</span> {open.text ?? '…'}
        </span>
      )}
    </>
  )
}
