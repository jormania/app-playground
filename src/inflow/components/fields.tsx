import { useId, type ReactNode } from 'react'
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
