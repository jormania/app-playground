import { Button } from '../../ds'
import { adviceFor, type AudioDeviceView, type HeardFrom, type ToneResult } from '../probe/audioRouting'
import type { OutputLevel } from '../probe/outputLevel'
import styles from './probe.module.css'

export interface AudioPanelProps {
  tone: ToneResult | null
  heard: HeardFrom | null
  devices: AudioDeviceView | null
  deviceChanges: number
  onPlay: () => void
  onHeard: (heard: HeardFrom) => void
  output: OutputLevel
  onToggleOutput: () => void
  onOutputLevel: (level: number) => void
  onPreviewOutput: () => void
}

const ANSWERS: { value: HeardFrom; label: string }[] = [
  { value: 'keyboard', label: 'Keyboard' },
  { value: 'phone', label: 'Phone' },
  { value: 'both', label: 'Both / not sure' },
  { value: 'nowhere', label: 'Nothing' },
]

export function AudioPanel({ tone, heard, devices, deviceChanges, onPlay, onHeard, output, onToggleOutput, onOutputLevel, onPreviewOutput }: AudioPanelProps) {
  const advice = heard ? adviceFor(heard) : null
  return (
    <section className={styles.panel} aria-label="Phone audio">
      <h2 className={styles.h2}>Phone audio</h2>
      <div className={styles.outputBox}>
        <div className={styles.outputHead}>
          <span className={styles.instruction}>KeyPath sound through the keyboard</span>
          <Button size="sm" variant={output.level > 0 ? 'primary' : 'outline'} aria-pressed={output.level > 0} onClick={onToggleOutput}>
            {output.level > 0 ? 'On' : 'Off'}
          </Button>
        </div>
        <div className={styles.sliderRow}>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={output.level}
            onChange={(e) => onOutputLevel(Number(e.target.value))}
            aria-label="KeyPath sound volume"
            className={styles.slider}
          />
          <span className={styles.statValue}>{output.level}</span>
          <Button size="sm" variant="ghost" onClick={onPreviewOutput} disabled={output.level === 0}>
            Preview
          </Button>
        </div>
        <p className={styles.faint}>
          Everything KeyPath plays with the keyboard connected (a metronome, later a backing track) goes through this level. It
          starts at 0, so nothing reaches the Yamaha until you turn it up. It can’t silence other apps or notifications:
          only the keyboard’s own FUNCTION 045 can, and the PSR-E383 accepts no MIDI message to change that from here.
        </p>
      </div>
      <p className={styles.faint}>
        Where does the phone’s audio go? The Yamaha’s USB port is also a sound card, so Android may send it to the keyboard’s
        speakers. Play the test tone (fixed volume, ignores the slider) with the cable connected and say where you heard it.
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
