import { Button } from '../../ds'
import { TESTS, type TestKind, type TestResult } from '../probe/diagnostics'
import type { ActiveTest } from '../probe/probeSession'
import styles from './probe.module.css'

export interface TestPanelProps {
  test: ActiveTest | null
  results: Partial<Record<TestKind, TestResult>>
  disabled: boolean
  onStart: (kind: TestKind) => void
  onFinish: () => void
  onCancel: () => void
}

const BADGE = { pass: '✓', fail: '✗', waiting: '…' } as const

export function TestPanel({ test, results, disabled, onStart, onFinish, onCancel }: TestPanelProps) {
  const spec = test ? TESTS.find((t) => t.kind === test.kind)! : null
  return (
    <section className={styles.panel} aria-label="Diagnostic tests">
      <h2 className={styles.h2}>Tests</h2>
      <div className={styles.actions}>
        {TESTS.map((t) => {
          const r = results[t.kind]
          return (
            <Button key={t.kind} variant={test?.kind === t.kind ? 'primary' : 'outline'} size="sm" disabled={disabled} onClick={() => onStart(t.kind)}>
              {r ? `${BADGE[r.verdict]} ` : ''}
              {t.title}
            </Button>
          )
        })}
      </div>
      {test && spec && (
        <div className={`${styles.testBox} ${styles[test.result.verdict]}`} aria-live="polite">
          <p className={styles.instruction}>{spec.instruction}</p>
          <p className={styles.verdict}>
            <strong>{test.result.verdict === 'waiting' ? 'Listening' : test.result.verdict === 'pass' ? 'Pass' : 'Fail'}</strong> — {test.result.summary}
          </p>
          {test.result.details.length > 0 && (
            <ul className={styles.details}>
              {test.result.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          <div className={styles.actions}>
            {!test.finished && spec.needsFinish && <Button size="sm" onClick={onFinish}>Finish</Button>}
            {!test.finished && !spec.needsFinish && <Button size="sm" variant="ghost" onClick={onFinish}>Give up</Button>}
            {test.finished && <Button size="sm" variant="outline" onClick={() => onStart(test.kind)}>Run again</Button>}
            <Button size="sm" variant="ghost" onClick={onCancel}>Close</Button>
          </div>
        </div>
      )}
    </section>
  )
}
