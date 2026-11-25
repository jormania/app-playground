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
/**
 * An exchange rate: a single separator is always the decimal point ("4.976", "4,976"),
 * never a thousands one. Lei per euro is never in the thousands.
 */
export function parseRate(s: string): number {
  const t = String(s).trim().replace(/[\s\u00a0\u202f]/g, '')
  if (!t) return 0
  const n = Number(t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

export function parseAmount(s: string): number {
  // Spaces (also non-breaking) group thousands too: "1 500".
  const t = String(s).trim().replace(/[\s\u00a0\u202f]/g, '')
  if (!t) return 0
  const lastComma = t.lastIndexOf(',')
  const lastDot = t.lastIndexOf('.')
  let norm: string
  if (lastComma !== -1 && lastDot !== -1) {
    // Both: the last one is the decimal point ("1.234,56", "1,234.56").
    norm = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else {
    const sep = lastComma !== -1 ? ',' : lastDot !== -1 ? '.' : ''
    const parts = sep ? t.split(sep) : [t]
    // One separator before exactly three digits, after one to three that don't start with 0, groups
    // thousands: "1.500" and "2,500" are 1500 and 2500 (in Romania the dot groups thousands). So does
    // more than one: "1.234.567". Otherwise it is the decimal point: "1,5", "12.50", "0.125".
    const thousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && /^[1-9]\d{0,2}$/.test(parts[0].replace('-', '')))
    norm = !sep ? t : thousands ? parts.join('') : parts.join('.')
  }
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
