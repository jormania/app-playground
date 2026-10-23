import type { ReactNode } from 'react'
import type { ListeningKind, ListeningState } from '../domain/types'
import { STATE_WORDS } from '../domain/listening'
import { Twisty } from './Twisty'
import { Paragraphs, Waiting } from './common'
import s from '../styles/editorial.module.css'

/**
 * The rows a work closes on, the same on the programme and in the listening
 * view: "Your listening · Heard ›" and "More context · <heading> ›". One
 * shape, one weight, each folded to a word until it is wanted.
 */

// The words are the domain's (STATE_WORDS), so every screen that says where you stand says it alike.
// "Started": the state means begun and not yet called heard, and "Listening" read as "playing now" (a
// single-track work stays here until the listener says otherwise — Spotify can't tell 30 s from the whole).
export const STATES: { value: ListeningState; label: string; kind: ListeningKind }[] = [
  { value: 'not-started', label: STATE_WORDS['not-started'], kind: 'reset' },
  { value: 'listening', label: STATE_WORDS.listening, kind: 'listening' },
  { value: 'heard', label: STATE_WORDS.heard, kind: 'heard' },
  { value: 'skipped', label: STATE_WORDS.skipped, kind: 'skipped' },
]

export type StateChoice = (typeof STATES)[number]

const stateLabel = (state: ListeningState) => STATE_WORDS[state]

/**
 * Where you stand with a work is coloured by what it says, not by being
 * chosen: only "Heard" takes the accent; not started and started stay in the
 * page's ink, and skipped steps back. A work not yet begun is the usual state
 * of most of a week, and was the loudest thing on the page while it wore the
 * accent too. The folded word and the open choices follow one rule.
 */
const SEGMENT_ON: Record<ListeningState, string> = {
  'not-started': s.segmentOn,
  listening: s.segmentOn,
  heard: `${s.segmentOn} ${s.segmentHeard}`,
  skipped: `${s.segmentOn} ${s.segmentSkipped}`,
}
const STATE_WORD_CLASS: Partial<Record<ListeningState, string>> = { heard: s.stateHeard, skipped: s.stateSkipped }

const TAG_FOR: Partial<Record<ListeningState, string>> = { heard: s.tagOn, skipped: s.tagSkipped }

/**
 * Where you stand with a recording, as a tag in a list (the Library, the
 * Journal): by the same rule as the folded word — heard in the accent, skipped
 * stepping back — and nothing at all while it is not yet begun.
 */
export function StateTag({ state }: { state: ListeningState }) {
  if (state === 'not-started') return null
  return <span className={`${s.tag} ${TAG_FOR[state] ?? ''}`}>{STATE_WORDS[state]}</span>
}

/** "Your listening": the state folded to a word; open, the four choices and whatever follows them. */
export function ListeningRow({ work, state, open, onPick, children }: {
  work: string
  state: ListeningState
  /** Held open while something inside waits for the listener (how a hearing landed). */
  open?: boolean
  onPick: (to: StateChoice) => void
  children?: ReactNode
}) {
  return (
    <section aria-label={`Your listening: ${work}`}>
      <Twisty label="Your listening" value={<span className={STATE_WORD_CLASS[state]}>{stateLabel(state)}</span>} open={open}>
        <div className={s.segmented} role="radiogroup" aria-label={`Where you are with ${work}`}>
          {STATES.map((st) => (
            <button key={st.value} role="radio" aria-checked={state === st.value} className={`${s.segment} ${state === st.value ? SEGMENT_ON[st.value] : ''}`} onClick={() => onPick(st)}>
              {st.label}
            </button>
          ))}
        </div>
        {children}
      </Twisty>
    </section>
  )
}

/**
 * "More context": the curator's note folded to its heading, read once (open
 * the first time it is shown). Not written yet, the same row says so, and
 * opening it is the asking.
 */
export function MoreContextRow({ explanation, readKey, writing, canAsk, onAsk }: {
  explanation?: { heading: string; body: string }
  /** The Twisty's read-once key: shared by every screen the note is read on. */
  readKey: string
  writing: boolean
  canAsk: boolean
  onAsk: () => void
}) {
  if (explanation) {
    return (
      <Twisty label="More context" value={explanation.heading} readOnce={readKey}>
        <Paragraphs text={explanation.body} className={s.prose} glossed />
      </Twisty>
    )
  }
  if (!canAsk) return null
  return (
    <Twisty label="More context" value={writing ? 'being written…' : 'the curator writes it when you open it'} open={writing} remember={false} onOpen={() => { if (!writing) onAsk() }}>
      {/* Open and not writing: the asking failed (offline, the curator busy) — one tap asks again. */}
      {writing
        ? <Waiting inline>The curator is writing…</Waiting>
        : <button className={`${s.textButton} ${s.quietButton}`} onClick={onAsk}>Ask again</button>}
    </Twisty>
  )
}
