import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Button, SegmentedControl } from '../ds'
import { useWakeLock } from '../shared/useWakeLock'
import { PSR_E383_RANGE } from './midi/noteNames'
import { SimulatedConnection } from './midi/simulatedConnection'
import { WebMidiConnection } from './midi/webMidiConnection'
import { readEnvironment, type EnvironmentFacts } from './probe/environment'
import { ProbeSession } from './probe/probeSession'
import { buildReport } from './probe/report'
import { findYamahaOnUsb, type UsbFinding } from './probe/usb'
import { EventLog } from './components/EventLog'
import { LivePanel } from './components/LivePanel'
import { PianoKeyboard } from './components/PianoKeyboard'
import { StatusPanel } from './components/StatusPanel'
import { TestPanel } from './components/TestPanel'
import styles from './components/probe.module.css'

type Source = 'webmidi' | 'simulated'

// Computer-keyboard piano for the simulator on a laptop: A W S E D F T G Y H U J K → C4…C5.
const KEYMAP: Record<string, number> = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 }

export default function App() {
  const [session] = useState(() => new ProbeSession(new WebMidiConnection()))
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const [env, setEnv] = useState<EnvironmentFacts | null>(null)
  const [usb, setUsb] = useState<UsbFinding | null>(null)
  const [copied, setCopied] = useState(false)
  const simulated = snap.sourceKind === 'simulated'
  const granted = snap.connection.access === 'granted'

  useWakeLock(granted)

  useEffect(() => {
    readEnvironment().then(setEnv)
    findYamahaOnUsb(false).then(setUsb)
    // No dispose on unmount: the session lives as long as the page, and
    // StrictMode's rehearsal unmount would otherwise detach it for good.
  }, [])

  // Re-read the MIDI permission once access settles, so the report says what Chrome now says.
  useEffect(() => {
    if (snap.connection.access === 'granted' || snap.connection.access === 'denied') readEnvironment().then(setEnv)
  }, [snap.connection.access])

  const switchSource = (next: string) => {
    if (next === snap.sourceKind) return
    session.use(next === 'simulated' ? new SimulatedConnection() : new WebMidiConnection())
    if (next === 'simulated') session.open()
  }

  const sim = simulated ? (session.source as SimulatedConnection) : null
  const press = useCallback((n: number) => sim?.press(n), [sim])
  const release = useCallback((n: number) => sim?.release(n), [sim])

  useEffect(() => {
    if (!sim) return
    const down = (e: KeyboardEvent) => {
      const n = KEYMAP[e.key.toLowerCase()]
      if (n !== undefined && !e.repeat && !e.metaKey && !e.ctrlKey) sim.press(n)
    }
    const up = (e: KeyboardEvent) => {
      const n = KEYMAP[e.key.toLowerCase()]
      if (n !== undefined) sim.release(n)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [sim])

  const t = snap.tracker
  const held = useMemo(() => new Map(t.held.map((h) => [h.note, h.velocity])), [t.held])
  const low = Math.min(PSR_E383_RANGE.low, t.lowest ?? Infinity)
  const high = Math.max(PSR_E383_RANGE.high, t.highest ?? -Infinity)

  const report = () => JSON.stringify(buildReport(snap, env, usb), null, 2)
  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      downloadReport()
    }
  }
  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([report()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `keypath-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>KeyPath</h1>
          <p className={styles.sub}>MIDI probe · PSR-E383 → Galaxy S24</p>
        </div>
        <SegmentedControl
          size="sm"
          value={snap.sourceKind}
          onChange={switchSource}
          options={[
            { value: 'webmidi' satisfies Source, label: 'Keyboard' },
            { value: 'simulated' satisfies Source, label: 'Simulator' },
          ]}
        />
      </header>

      <StatusPanel
        simulated={simulated}
        connection={snap.connection}
        env={env}
        usb={usb}
        onConnect={() => session.open()}
        onLookUsb={() => findYamahaOnUsb(true).then(setUsb)}
      />

      <section className={styles.panel} aria-label="Keyboard">
        <PianoKeyboard low={low} high={high} held={held} onPress={sim ? press : undefined} onRelease={sim ? release : undefined} />
        {sim && <p className={styles.faint}>Simulator: tap keys (several fingers for a chord), or type A W S E D F T G Y H U J K for C4–C5.</p>}
      </section>

      <LivePanel snap={snap} />

      <TestPanel
        test={snap.test}
        results={snap.results}
        disabled={!granted}
        onStart={(k) => session.startTest(k)}
        onFinish={() => session.finishTest()}
        onCancel={() => session.cancelTest()}
      />

      <EventLog log={snap.log} origin={snap.origin} />

      <section className={styles.panel} aria-label="Report">
        <h2 className={styles.h2}>Report</h2>
        <p className={styles.faint}>Everything above as one JSON file: environment, device, counters, timing and test results. No content, no personal data beyond the phone model and browser.</p>
        <div className={styles.actions}>
          <Button onClick={copyReport}>{copied ? 'Copied' : 'Copy report'}</Button>
          <Button variant="outline" onClick={downloadReport}>Download</Button>
          <Button variant="ghost" onClick={() => session.resetCounters()}>Reset counters</Button>
        </div>
      </section>
    </main>
  )
}
