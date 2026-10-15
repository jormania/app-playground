import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { readJson, readSessionJson, writeJson, writeSessionJson } from '../../shared/storage'
import s from '../styles/editorial.module.css'

const READ_PREFIX = 'long-listen:read:'
const OPEN_KEY = 'long-listen:open-folds'
const OPEN_MAX = 300

/**
 * Which folds the listener opened, page by page, for the tab's life: coming
 * back to a page finds them as they were left (and the remembered scroll
 * position then lands on the same words). A fold is named by the page, the
 * nearest anchored block it sits in (a work's card), its label, and its place
 * among folds of the same label there.
 */
export function foldKey(el: HTMLDetailsElement): string {
  const scope = el.parentElement?.closest<HTMLElement>('[id]')
  const label = el.querySelector(':scope > summary > [data-fold-label]')?.textContent ?? ''
  const root: ParentNode = scope ?? document
  const same = [...root.querySelectorAll<HTMLDetailsElement>('details[data-fold]')]
    .filter((d) => d.parentElement?.closest('[id]') === (scope ?? null) && (d.querySelector(':scope > summary > [data-fold-label]')?.textContent ?? '') === label)
  const page = el.closest<HTMLElement>('[data-page]')?.dataset.page ?? (window.location.hash || '#/')
  return `${page}|${scope?.id ?? ''}|${label}|${same.indexOf(el)}`
}
const openFolds = (): string[] => { const v = readSessionJson<unknown>(OPEN_KEY, []); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] }
function rememberFold(k: string, open: boolean): void {
  const rest = openFolds().filter((x) => x !== k)
  writeSessionJson(OPEN_KEY, open ? [...rest, k].slice(-OPEN_MAX) : rest)
}

/**
 * A twisty: a folded block whose one line says what is inside ("Made with your
 * settings · 4–5 h · Several · A mix"), opened only when wanted. The one way the
 * app folds anything, so every screen folds alike.
 *
 * `readOnce` is for writing that is worth reading once and is in the way after:
 * open the first time it is shown, folded on every visit after. `open` forces it
 * open while something inside is waiting (a mood change not yet asked for).
 * `preview` is for a value that is the opening of what's inside ("Why this
 * recording · Boulez makes every layer…"): shown while folded, gone once open,
 * so the same words are never read twice in a row.
 */
export function Twisty({ label, value, open, readOnce, preview, className, onOpen, remember = true, children }: {
  label: ReactNode
  /** What's inside, in a few words: shown beside the label while folded and open. */
  value?: ReactNode
  open?: boolean
  /** A stable key for this piece of writing ("background:<programme id>"). */
  readOnce?: string
  /** The value is the first words of the body: hidden while open. */
  preview?: boolean
  className?: string
  /** Called each time the listener opens it — by a tap, never as the page reopens it from memory. */
  onOpen?: () => void
  /** False for a fold that stands in for another (a note not yet written): its opening is not kept. */
  remember?: boolean
  children: ReactNode
}) {
  // Read once: open now if never shown before, and remember it was.
  const [firstTime] = useState(() => (readOnce ? !readJson<boolean>(READ_PREFIX + readOnce, false) : false))
  useEffect(() => {
    if (readOnce && firstTime) writeJson(READ_PREFIX + readOnce, true)
  }, [readOnce, firstTime])
  const ref = useRef<HTMLDetailsElement>(null)
  const tapped = useRef(false)
  // Opened before, on this page: open again as it is drawn, before the place on the page is restored.
  useLayoutEffect(() => {
    const el = ref.current
    if (remember && el && !el.open && openFolds().includes(foldKey(el))) el.open = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <details
      ref={ref}
      data-fold=""
      className={[s.twisty, preview ? s.twistyPreview : '', className ?? ''].filter(Boolean).join(' ')}
      open={open || firstTime || undefined}
      onToggle={(e) => {
        const el = e.currentTarget
        // Only what the listener did — a tap or a key on the label. A fold the page opens itself
        // (read once, the first time; held open while something waits) is not their choice.
        const byTap = tapped.current
        tapped.current = false
        if (byTap && remember) rememberFold(foldKey(el), el.open)
        if (byTap && el.open) onOpen?.()
      }}
    >
      <summary onClick={() => { tapped.current = true }}>
        <span className={s.twistyLabel} data-fold-label="">{label}</span>
        {value != null && value !== '' && <span className={s.twistyValue}>{value}</span>}
      </summary>
      <div className={s.twistyBody}>{children}</div>
    </details>
  )
}
