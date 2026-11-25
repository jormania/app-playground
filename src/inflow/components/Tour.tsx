/**
 * The welcome tour: seven short steps, shown the first time InFlow opens.
 * At most three short points each; the five main features carry their switch.
 * The checkbox on every step decides whether it comes back next time; it
 * starts ticked on first run, and Settings can always bring the tour back.
 * Steps that introduce an optional feature carry its switch.
 */
import { useState } from 'react'
import { CalendarClock, Check, Database, DoorOpen, Flame, Receipt, Scale, Waves } from 'lucide-react'
import type { FeatureKey } from '../domain/types'
import { Button, Modal, SegmentedControl } from '../../ds'
import { useInflow } from '../app/state'
import styles from '../styles/ui.module.css'

interface Step {
  icon: typeof Waves
  title: string
  /** Two or three short points, read at a glance. */
  points: string[]
  /** A feature this step introduces, switchable right here. */
  feature?: { key: FeatureKey; label: string }
}

const STEPS: Step[] = [
  {
    icon: Waves,
    title: 'Welcome to InFlow',
    points: ['What came in, from whom, and what you keep', 'Add a payment: amount and client is enough', 'The period at the top drives every screen'],
  },
  {
    icon: Flame,
    title: 'Where the money is good',
    points: ['Clients & work, ranked by what you kept', 'Pain points: only what costs money or needs a decision', '👍 or 👎 to tune them'],
    feature: { key: 'insights', label: 'Insights' },
  },
  {
    icon: CalendarClock,
    title: 'Money on its way',
    points: ['Log a payment before it arrives', 'Overdue ones flagged, with a reminder to send', 'Recurring clients suggested for next month'],
    feature: { key: 'expected', label: 'Expected payments' },
  },
  {
    icon: DoorOpen,
    title: 'Fixed fee or a share?',
    points: ['What each room leaves you a session', 'How many people cover the fee', 'What if: other terms, same sessions'],
    feature: { key: 'deals', label: 'Venue deals' },
  },
  {
    icon: Scale,
    title: 'Costs and profit',
    points: ['Record what you spend', 'Profit, cash flow and break-even for any period'],
    feature: { key: 'costs', label: 'Costs and profit' },
  },
  {
    icon: Receipt,
    title: 'Tax, if you want it',
    points: ['What to set aside, under Romanian rules', 'Withholding and VAT included', 'A suggestion; you decide'],
    feature: { key: 'tax', label: 'Tax suggestions' },
  },
  {
    icon: Database,
    title: 'You start simple',
    points: ['Tick a feature in this guide to add it', 'Or in Settings → Features, “Everything” included', 'Your data stays on this device, or in your Notion'],
  },
]

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, workspace, setWorkspace } = useInflow()
  const [step, setStep] = useState(0)
  const [again, setAgain] = useState(settings.showTour)
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  const [startWith, setStartWith] = useState<'demo' | 'mine'>('demo')

  const finish = () => {
    updateSettings({ showTour: again })
    setStep(0)
    onClose()
  }
  const start = () => {
    if (workspace === 'demo' && startWith === 'mine') setWorkspace('mine')
    finish()
  }

  return (
    <Modal open={open} onClose={finish} title={`${step + 1} of ${STEPS.length}`}>
      <div className={styles.tourStep}>
        <div className={styles.tourIcon}><s.icon size={26} aria-hidden /></div>
        <h3 className={styles.tourTitle}>{s.title}</h3>
        <ul className={styles.tourPoints}>
          {s.points.map((p) => <li key={p}><Check size={14} aria-hidden />{p}</li>)}
        </ul>
        {s.feature && (
          <label className={styles.tourCheck}>
            <input type="checkbox" checked={settings.features[s.feature.key]}
              onChange={(e) => updateSettings({ features: { [s.feature!.key]: e.target.checked }, simpleStartNotice: false })} />
            {s.feature.label}
          </label>
        )}
        {/* The last step's choice sits in the step, so the buttons below never move. */}
        {last && workspace === 'demo' && (
          <div className={styles.tourChoice}>
            <SegmentedControl label="Open with" value={startWith} onChange={(v) => setStartWith(v as 'demo' | 'mine')}
              options={[{ value: 'demo', label: 'The demo' }, { value: 'mine', label: 'My data' }]} />
          </div>
        )}
      </div>
      <div className={styles.tourDots} aria-hidden>
        {STEPS.map((_, i) => <span key={i} className={`${styles.tourDot} ${i === step ? styles.tourDotOn : ''}`} />)}
      </div>
      <label className={styles.tourCheck}>
        <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} />
        Show this guide next time
      </label>
      {/* Same three places on every step, for the thumb: Skip left, Back and the way forward right. */}
      <div className={styles.tourActions}>
        <span className={last ? styles.tourHidden : undefined}>
          <Button variant="ghost" onClick={finish} tabIndex={last ? -1 : undefined} aria-hidden={last || undefined}>Skip</Button>
        </span>
        <div>
          <Button variant="secondary" className={step === 0 ? styles.tourHidden : undefined} disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          <Button className={styles.tourNext} onClick={() => (last ? start() : setStep(step + 1))}>{last ? 'Start' : 'Next'}</Button>
        </div>
      </div>
    </Modal>
  )
}
