import { Button } from '../../ds'
import type { Heard, MidiOutFindings, OutCheck, VoiceHeard } from '../probe/midiOut'
import styles from './probe.module.css'

export interface MidiOutPanelProps {
  /** An output port to send to; null disables the checks. */
  port: string | null
  findings: MidiOutFindings
  running: OutCheck | null
  onRun: (check: OutCheck) => void
  onNotes: (heard: Heard) => void
  onVoice: (heard: VoiceHeard) => void
  onStyle: (heard: Heard) => void
}

function Answers<T extends string>({ label, value, options, onPick }: { label: string; value: T | null; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <div className={styles.actions} role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <Button key={v} size="sm" variant={value === v ? 'primary' : 'outline'} role="radio" aria-checked={value === v} onClick={() => onPick(v)}>
          {text}
        </Button>
      ))}
    </div>
  )
}

/**
 * Phone → keyboard. Three checks by ear; the echo check answers itself. The
 * answers go into the report, and decide how Studio plays a take back.
 */
export function MidiOutPanel({ port, findings, running, onRun, onNotes, onVoice, onStyle }: MidiOutPanelProps) {
  const disabled = !port || running !== null
  return (
    <section className={styles.panel} aria-label="Phone to keyboard">
      <h2 className={styles.h2}>Phone → keyboard (MIDI out)</h2>
      <p className={styles.faint}>
        {port
          ? `Sending to: ${port}. Keep the keyboard’s volume at a normal level.`
          : 'No MIDI output yet. Connect the keyboard above first.'}
      </p>

      <div className={styles.testBox}>
        <p className={styles.instruction}>1. Four notes on channel 1</p>
        <div className={styles.actions}>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onRun('notes')}>
            {running === 'notes' ? 'Playing…' : 'Play C E G C'}
          </Button>
        </div>
        <p className={styles.faint}>Did the keyboard play four rising notes?</p>
        <Answers label="Did the keyboard play four notes" value={findings.notes.heard} options={[['yes', 'Yes'], ['no', 'No']]} onPick={onNotes} />
        {findings.notes.echoed !== null && (
          <p className={styles.verdict}>
            {findings.notes.echoed
              ? 'Echo: the keyboard sent the notes straight back. The tutor must ignore its own playback.'
              : 'No echo: nothing came back from the keyboard.'}
          </p>
        )}
      </div>

      <div className={styles.testBox}>
        <p className={styles.instruction}>2. Another instrument, on channel 2</p>
        <div className={styles.actions}>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onRun('voice')}>
            {running === 'voice' ? 'Playing…' : 'Play as strings'}
          </Button>
        </div>
        <p className={styles.faint}>Did it sound like a different instrument from the piano?</p>
        <Answers
          label="Did it sound like another instrument"
          value={findings.voice}
          options={[
            ['different', 'Different'],
            ['same', 'Same piano'],
            ['nothing', 'Nothing'],
          ]}
          onPick={onVoice}
        />
      </div>

      <div className={styles.testBox}>
        <p className={styles.instruction}>3. Start and stop a Style from the phone</p>
        <p className={styles.faint}>Choose a Style on the keyboard (STYLE button), but don’t press START/STOP. The phone sends Start, then Stop four seconds later.</p>
        <div className={styles.actions}>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onRun('style')}>
            {running === 'style' ? 'Running… (4 s)' : 'Start the Style'}
          </Button>
        </div>
        <p className={styles.faint}>Did the Style start and then stop by itself?</p>
        <Answers label="Did the Style start and stop" value={findings.style} options={[['yes', 'Yes'], ['no', 'No']]} onPick={onStyle} />
      </div>
    </section>
  )
}
