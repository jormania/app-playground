/**
 * The welcome tour: five short steps, shown the first time InFlow opens.
 * The checkbox on every step decides whether it comes back next time; it
 * starts ticked on first run, and Settings can always bring the tour back.
 */
import { useState } from 'react'
import { BarChart3, Database, PlusCircle, Receipt, Waves } from 'lucide-react'
import { Button, Modal } from '../../ds'
import { useInflow } from '../app/state'
import styles from '../styles/ui.module.css'

interface Step {
  icon: typeof Waves
  title: string
  text: string
}

const STEPS: Step[] = [
  {
    icon: Waves,
    title: 'Welcome to InFlow',
    text: 'A light way to see your freelance income: how much came in, who it came from, where the work happened, and how it moves week to week. Not accounting software — just the picture.',
  },
  {
    icon: PlusCircle,
    title: 'Add a payment in seconds',
    text: 'Tap “Add income”, type the amount, pick the client. InFlow remembers the rest from that client’s last payment — source, venue, currency — and converts foreign currencies to lei for you. New clients, sources and venues can be created right inside the form.',
  },
  {
    icon: BarChart3,
    title: 'See where it comes from',
    text: 'Overview answers the big questions at a glance, for this week, this month or any period you choose. Reports break it down by client, venue and source, compare against the period before, and build a printable report you can save as PDF.',
  },
  {
    icon: Receipt,
    title: 'Tax, only if you want it',
    text: 'InFlow can suggest whether each payment is taxable, whether tax was withheld, the VAT treatment, and how much to set aside under Romanian rules for PFA or SRL. Every suggestion is labelled as one, and you decide. Not interested? Switch tax off below and InFlow shows only the money flow.',
  },
  {
    icon: Database,
    title: 'Your data, your choice',
    text: 'You are looking at demo data: a coaching practice over the last year or so. Explore freely, then clear it in Settings. Keep your own records on this device, or connect your Notion workspace to have them anywhere. Backups and CSV export are in Settings too.',
  },
]

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useInflow()
  const [step, setStep] = useState(0)
  const [again, setAgain] = useState(settings.showTour)
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  const finish = () => {
    updateSettings({ showTour: again })
    setStep(0)
    onClose()
  }

  return (
    <Modal open={open} onClose={finish} title={`${step + 1} of ${STEPS.length}`}>
      <div className={styles.tourStep}>
        <div className={styles.tourIcon}><s.icon size={26} aria-hidden /></div>
        <h3 className={styles.tourTitle}>{s.title}</h3>
        <p className={styles.tourText}>{s.text}</p>
        {step === 3 && (
          <label className={styles.tourCheck}>
            <input type="checkbox" checked={settings.trackTax} onChange={(e) => updateSettings({ trackTax: e.target.checked })} />
            Show tax figures (optional)
          </label>
        )}
      </div>
      <div className={styles.tourDots} aria-hidden>
        {STEPS.map((_, i) => <span key={i} className={`${styles.tourDot} ${i === step ? styles.tourDotOn : ''}`} />)}
      </div>
      <label className={styles.tourCheck}>
        <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} />
        Show this guide next time I open InFlow
      </label>
      <div className={styles.formActions} style={{ position: 'static', marginTop: 'var(--space-md)' }}>
        <div><Button variant="ghost" onClick={finish}>Skip</Button></div>
        <div>
          {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
          <Button onClick={() => (last ? finish() : setStep(step + 1))}>{last ? 'Start' : 'Next'}</Button>
        </div>
      </div>
    </Modal>
  )
}
