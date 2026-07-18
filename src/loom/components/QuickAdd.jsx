import { useState } from 'react'
import { useLexicon } from '../lib/lexiconContext.jsx'
import styles from './QuickAdd.module.css'

// Frictionless entry — an inline input, never a modal. Enter spins the thread
// (or adds the task, in plain voice) and keeps focus so you can rack up a whole
// day (or skein) in one flow.
export default function QuickAdd({ placeholder, onAdd, compact = false }) {
  const { t } = useLexicon()
  const [value, setValue] = useState('')
  const ph = placeholder ?? t('spinLoose')

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
        placeholder={ph}
        onChange={e => setValue(e.target.value)}
        enterKeyHint="done"
        aria-label={ph}
      />
      {value.trim() && (
        <button type="submit" className={styles.go} aria-label={t('Spin')}>{t('Spin')}</button>
      )}
    </form>
  )
}
