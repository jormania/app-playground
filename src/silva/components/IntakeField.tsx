import { useState } from 'react'
import { Button } from '../../ds'
import styles from './IntakeField.module.css'

export interface IntakeFieldProps {
  onSubmit: (body: string) => void
}

/** Type-or-paste intake — one field, no required metadata (SILVA.md
 *  "Intake"). Everything lands in the understory; kind/locus/source are
 *  assigned later, if ever. */
export function IntakeField({ onSubmit }: IntakeFieldProps) {
  const [value, setValue] = useState('')

  function submit() {
    const body = value.trim()
    if (!body) return
    onSubmit(body)
    setValue('')
  }

  return (
    <div className={styles.wrap}>
      <textarea
        className={styles.textarea}
        placeholder="Type or paste something worth keeping…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
        rows={3}
      />
      <Button size="sm" onClick={submit} disabled={!value.trim()}>
        Add to the understory
      </Button>
    </div>
  )
}
