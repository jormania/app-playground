import { Button } from '../../ds'
import { adviceFor, type AudioDeviceView, type HeardFrom, type ToneResult } from '../probe/audioRouting'
import styles from './probe.module.css'

export interface AudioPanelProps {
  tone: ToneResult | null
  heard: HeardFrom | null
  devices: AudioDeviceView | null
  deviceChanges: number
  onPlay: () => void
  onHeard: (heard: HeardFrom) => void
}

const ANSWERS: { value: HeardFrom; label: string }[] = [
  { value: 'keyboard', label: 'Keyboard' },
  { value: 'phone', label: 'Phone' },
  { value: 'both', label: 'Both / not sure' },
  { value: 'nowhere', label: 'Nothing' },
]

export function AudioPanel({ tone, heard, devices, deviceChanges, onPlay, onHeard }: AudioPanelProps) {
  const advice = heard ? adviceFor(heard) : null
  return (
    <section className={styles.panel} aria-label="Phone audio">
      <h2 className={styles.h2}>Phone audio</h2>
      <p className={styles.faint}>
        The Yamaha’s USB port is also a sound card, so Android may send the phone’s audio to the keyboard’s speakers. Play the
        tone with the cable connected and say where you heard it.
      </p>
      <div className={styles.actions}>
        <Button variant="outline" onClick={onPlay}>
          Play test tone
        </Button>
      </div>
      {tone && (
        <>
          <p className={styles.instruction}>Where did you hear it?</p>
          <div className={styles.actions} role="radiogroup" aria-label="Where did you hear the tone">
            {ANSWERS.map((a) => (
              <Button key={a.value} size="sm" variant={heard === a.value ? 'primary' : 'outline'} role="radio" aria-checked={heard === a.value} onClick={() => onHeard(a.value)}>
                {a.label}
              </Button>
            ))}
          </div>
        </>
      )}
      {advice && (
        <div className={styles.testBox}>
          <p className={styles.verdict}>
            <strong>{advice.headline}</strong>
          </p>
          <ul className={styles.details}>
            {advice.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <p className={styles.faint}>
        Audio devices seen by Chrome: {devices ? `${devices.outputs} out / ${devices.inputs} in` : 'unknown'}
        {deviceChanges > 0 && ` · changed ${deviceChanges}× since the page opened`}
        {tone?.outputLatencyMs != null && ` · output latency ${tone.outputLatencyMs} ms`}
        {tone?.error && ` · ${tone.error}`}
      </p>
    </section>
  )
}
