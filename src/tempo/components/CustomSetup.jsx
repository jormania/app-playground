import { useState } from 'react'
import { Button, Field, NumberStepper, SegmentedControl } from '../../ds'
import { loadModeConfig, saveModeConfig } from '../lib/storage'
import styles from './Setup.module.css'
import rowStyles from './CustomSetup.module.css'

const KIND_OPTIONS = [
  { value: 'prepare', label: 'Prepare' },
  { value: 'active', label: 'Active' },
  { value: 'rest', label: 'Rest' },
  { value: 'inhale', label: 'Breathe' },
]

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function blankRow() {
  return { id: newId(), label: '', seconds: 30, kind: 'active' }
}

export function CustomSetup({ onStart, onBack }) {
  const [rows, setRows] = useState(() => {
    const saved = loadModeConfig('custom', null)
    return saved && saved.length ? saved : [blankRow()]
  })

  function updateRow(id, patch) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()])
  }

  function removeRow(id) {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }

  function moveRow(index, direction) {
    setRows((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (rows.length === 0) return
    const cleaned = rows.map((row, index) => ({
      id: row.id,
      label: row.label.trim() || `Segment ${index + 1}`,
      seconds: Math.max(1, Number(row.seconds) || 0),
      kind: row.kind,
    }))
    saveModeConfig('custom', cleaned)
    onStart(cleaned)
  }

  return (
    <div className={styles.page}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h1 className={styles.title}>Custom</h1>
        </div>

        {rows.length === 0 ? (
          <p className={rowStyles.empty}>Add a step to begin — a label, a length, and what kind it is.</p>
        ) : (
          <div className={rowStyles.rows}>
            {rows.map((row, index) => (
              <div key={row.id} className={rowStyles.row}>
                <div className={rowStyles.fieldsLine}>
                  <div className={rowStyles.labelField}>
                    <Field
                      label="Label"
                      placeholder={`Segment ${index + 1}`}
                      value={row.label}
                      onChange={(e) => updateRow(row.id, { label: e.target.value })}
                    />
                  </div>
                  <NumberStepper
                    label="Seconds"
                    min={1}
                    max={999}
                    value={row.seconds}
                    onChange={(v) => updateRow(row.id, { seconds: v })}
                  />
                </div>
                <div className={rowStyles.controlsLine}>
                  <SegmentedControl
                    size="sm"
                    options={KIND_OPTIONS}
                    value={row.kind}
                    onChange={(kind) => updateRow(row.id, { kind })}
                  />
                  <div className={rowStyles.rowActions}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => moveRow(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Move down"
                      disabled={index === rows.length - 1}
                      onClick={() => moveRow(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Remove"
                      onClick={() => removeRow(row.id)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button type="button" variant="secondary" className={styles.addStep} onClick={addRow}>
          + Add step
        </Button>

        <div className={styles.actions}>
          <Button type="button" variant="secondary" className={styles.back} onClick={onBack}>
            Back
          </Button>
          <Button type="submit" className={styles.submit} disabled={rows.length === 0}>
            Begin
          </Button>
        </div>
      </form>
    </div>
  )
}
