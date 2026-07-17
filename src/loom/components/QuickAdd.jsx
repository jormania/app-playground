import { useState } from 'react'
import styles from './QuickAdd.module.css'

// Frictionless entry — an inline input, never a modal. Enter spins the thread
// and keeps focus so you can rack up a whole day (or skein) in one flow.
export default function QuickAdd({ placeholder = 'Spin a thread…', onAdd, compact = false }) {
  const [value, setValue] = useState('')

  function submit(e) {
    e.preventDefault()
    const title = value.trim()
    if (!title) return
    onAdd(title)
    setValue('')
  }

  return (
    <form className={`${styles.form} ${compact ? styles.compact : ''}`} onSubmit={submit}>
      <span className={styles.spindle} aria-hidden="true">✚</span>
      <input
        className={styles.input}
        value={value}
        placeholder={placeholder}
        onChange={e => setValue(e.target.value)}
        enterKeyHint="done"
        aria-label={placeholder}
      />
      {value.trim() && (
        <button type="submit" className={styles.go} aria-label="Spin thread">spin</button>
      )}
    </form>
  )
}
