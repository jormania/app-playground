import { useId, useState, type ReactNode } from 'react'
import styles from '../styles/ui.module.css'

interface Base {
  label: string
  right?: ReactNode
  hint?: ReactNode
}

export function SelectInput({ label, right, hint, value, onChange, children, name }: Base & {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  name?: string
}) {
  const id = useId()
  return (
    <div className={styles.fieldPlain}>
      <label htmlFor={id} className={styles.fieldLabel}><span>{label}</span>{right}</label>
      <select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  )
}

export function TextInput({ label, right, hint, value, onChange, type = 'text', inputMode, placeholder, step, min, name, autoFocus }: Base & {
  value: string | number
  onChange: (v: string) => void
  type?: string
  inputMode?: 'decimal' | 'numeric' | 'text' | 'email' | 'url'
  placeholder?: string
  step?: string
  min?: string
  name?: string
  autoFocus?: boolean
}) {
  const id = useId()
  return (
    <div className={styles.fieldPlain}>
      <label htmlFor={id} className={styles.fieldLabel}><span>{label}</span>{right}</label>
      <input id={id} name={name} type={type} inputMode={inputMode} value={value} placeholder={placeholder} step={step} min={min}
        autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  )
}

export function TextArea({ label, value, onChange, placeholder }: Base & { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId()
  return (
    <div className={styles.fieldPlain}>
      <label htmlFor={id} className={styles.fieldLabel}><span>{label}</span></label>
      <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** Parse a typed amount: accepts "1 250,50", "1,250.50" and "1250.5". */
export function parseAmount(s: string): number {
  const t = String(s).trim().replace(/\s/g, '')
  if (!t) return 0
  const lastComma = t.lastIndexOf(',')
  const lastDot = t.lastIndexOf('.')
  let norm = t
  if (lastComma > lastDot) norm = t.replace(/\./g, '').replace(',', '.')
  else norm = t.replace(/,/g, '')
  const n = Number(norm)
  return Number.isFinite(n) ? n : NaN
}

/**
 * A number field that keeps what you type ("12." on the way to "12.5") and
 * reports the parsed number. A plain controlled input rebuilt from the number
 * on every keystroke swallows the decimal point.
 */
export function NumberInput({ label, value, onCommit, hint, placeholder, scale = 1, emptyIsZero = true }: {
  label: string
  value: number | null
  onCommit: (n: number | null) => void
  hint?: ReactNode
  placeholder?: string
  /** Shown × scale: a stored 0.2 shows as 20 with scale 100. */
  scale?: number
  emptyIsZero?: boolean
}) {
  const show = (v: number | null) => (v === null || (v === 0 && emptyIsZero && placeholder) ? '' : String(Math.round(v * scale * 100) / 100))
  const [text, setText] = useState(() => show(value))
  const [seen, setSeen] = useState(value)
  // Follow changes made elsewhere (a restore, a preset) without fighting the typist.
  if (value !== seen) {
    setSeen(value)
    const parsed = text.trim() === '' ? (emptyIsZero ? 0 : null) : parseAmount(text) / scale
    if (parsed !== value) setText(show(value))
  }
  return (
    <TextInput label={label} value={text} inputMode="decimal" placeholder={placeholder} hint={hint}
      onChange={(t) => {
        setText(t)
        if (t.trim() === '') { onCommit(emptyIsZero ? 0 : null); return }
        const n = parseAmount(t)
        if (Number.isFinite(n) && n >= 0) onCommit(n / scale)
      }} />
  )
}
