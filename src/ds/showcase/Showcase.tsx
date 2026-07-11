import { useState } from 'react'
import { Button, Field, Modal, NumberStepper, Card, SegmentedControl, IconButton, StreakCounter, SettingsToggle } from '../index'
import styles from './Showcase.module.css'

const ArrowUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 5v14M6 11l6-6 6 6" />
  </svg>
)
const ArrowDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
)

/** The design system's first consumer: a gallery that renders every component in
 *  every state. It proves the API and doubles as a visual workbench. */
export function Showcase() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [modalOpen, setModalOpen] = useState(false)
  const [count, setCount] = useState(8)
  const [segment, setSegment] = useState('work')
  const [selectedCard, setSelectedCard] = useState('a')

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Design System</h1>
          <p className={styles.lede}>Component gallery — every primitive, every state.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={toggleTheme}>
          {theme === 'light' ? 'Dark theme' : 'Light theme'}
        </Button>
      </header>

      <Section title="Button" note="variants × sizes, plus disabled">
        <Row label="Primary">
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="md">Medium</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </Row>
        <Row label="Secondary">
          <Button variant="secondary" size="sm">Small</Button>
          <Button variant="secondary" size="md">Medium</Button>
          <Button variant="secondary" disabled>Disabled</Button>
        </Row>
        <Row label="Ghost">
          <Button variant="ghost" size="sm">Small</Button>
          <Button variant="ghost" size="md">Medium</Button>
          <Button variant="ghost" disabled>Disabled</Button>
        </Row>
      </Section>

      <Section title="Field" note="label, hint, error, required, disabled">
        <div className={styles.fields}>
          <Field label="Name" placeholder="Ada Lovelace" />
          <Field label="Email" hint="We'll never share it." placeholder="you@example.com" />
          <Field label="API key" required placeholder="sk-…" />
          <Field label="Handle" error="That handle is already taken." defaultValue="ada" />
          <Field label="Locked" disabled defaultValue="Read only" />
        </div>
      </Section>

      <Section title="Modal" note="open/close, focus trap, Escape + backdrop dismiss">
        <Row label="Trigger">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        </Row>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirm action">
          <p className={styles.modalText}>
            This dialog traps focus. Tab cycles through the controls below; Escape,
            the × button, or a click on the backdrop all close it.
          </p>
          <div className={styles.fields}>
            <Field label="Reason" placeholder="Optional note" />
          </div>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => setModalOpen(false)}>Confirm</Button>
          </div>
        </Modal>
      </Section>

      <Section title="NumberStepper" note="±, direct typing, min/max clamping">
        <Row label="Default">
          <NumberStepper label="Rounds" value={count} min={1} max={12} onChange={setCount} />
        </Row>
        <Row label="At bounds">
          <NumberStepper label="Min" value={1} min={1} max={10} onChange={() => {}} />
          <NumberStepper label="Max" value={10} min={1} max={10} onChange={() => {}} />
        </Row>
      </Section>

      <Section title="Card" note="pressable surface — hover lift, focus ring, selected state">
        <Row label="Pick one">
          <Card selected={selectedCard === 'a'} onClick={() => setSelectedCard('a')}>
            <strong>Rounds</strong>
            <span className={styles.note}>Work/rest × N</span>
          </Card>
          <Card selected={selectedCard === 'b'} onClick={() => setSelectedCard('b')}>
            <strong>Cycles</strong>
            <span className={styles.note}>Focus/break blocks</span>
          </Card>
        </Row>
      </Section>

      <Section title="IconButton" note="solid icon-only control — sizes, selected, disabled">
        <Row label="Medium">
          <IconButton aria-label="Move up"><ArrowUp /></IconButton>
          <IconButton aria-label="Move down"><ArrowDown /></IconButton>
          <IconButton aria-label="Toggle" selected>◐</IconButton>
          <IconButton aria-label="Disabled" disabled><ArrowUp /></IconButton>
        </Row>
        <Row label="Small">
          <IconButton size="sm" aria-label="Move up"><ArrowUp /></IconButton>
          <IconButton size="sm" aria-label="Move down"><ArrowDown /></IconButton>
        </Row>
      </Section>

      <Section title="SegmentedControl" note="compact multi-option toggle">
        <Row label="Size md">
          <SegmentedControl
            options={[
              { value: 'prepare', label: 'Prep' },
              { value: 'work', label: 'Work' },
              { value: 'rest', label: 'Rest' },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </Row>
        <Row label="Size sm">
          <SegmentedControl
            size="sm"
            options={[
              { value: 'prepare', label: 'Prep' },
              { value: 'work', label: 'Work' },
              { value: 'rest', label: 'Rest' },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </Row>
        <Row label="Disabled">
          <SegmentedControl
            size="sm"
            disabled
            options={[
              { value: 'prepare', label: 'Prep' },
              { value: 'work', label: 'Work' },
              { value: 'rest', label: 'Rest' },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </Row>
      </Section>

      <Section title="StreakCounter" note="Reflection habit streak badge">
        <Row label="Count 0">
          <StreakCounter count={0} />
        </Row>
        <Row label="Count 5">
          <StreakCounter count={5} />
        </Row>
      </Section>

      <Section title="SettingsToggle" note="Switch slider toggle with custom label & description">
        <div className={styles.fields}>
          <SettingsToggle label="Morning Reminder" hint="Receive a local push notification daily." checked={true} onChange={() => {}} />
          <SettingsToggle label="Weekly Sync" checked={false} onChange={() => {}} />
        </div>
      </Section>

      <Section title="Amor Fati Elements" note="Fate Badge, Acceptance Tags, and Fate Graph">
        <Row label="Fate Badge">
          <span style={{
            fontSize: 'var(--text-xs)',
            backgroundColor: 'var(--color-glow)',
            color: 'var(--color-accent)',
            padding: 'var(--space-2xs) var(--space-xs)',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 'var(--weight-bold)',
            fontFamily: 'var(--font-mono)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)'
          }}>
            ▲ Fate Reframed
          </span>
        </Row>
        <Row label="Acceptance Tags">
          <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
            <button style={{
              padding: 'var(--space-2xs) var(--space-sm)',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-accent)',
              backgroundColor: 'var(--color-glow)',
              color: 'var(--color-accent)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-medium)',
              cursor: 'pointer'
            }}>Situation</button>
            <button style={{
              padding: 'var(--space-2xs) var(--space-sm)',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-ink)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-medium)',
              cursor: 'pointer'
            }}>Outcome</button>
          </div>
        </Row>
        <Row label="Fate Graph">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
            width: '100%',
            maxWidth: '400px',
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-md)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--text-xs)' }}>
              <span style={{ width: '80px', fontWeight: 'var(--weight-medium)' }}>Situation</span>
              <div style={{ flex: 1, backgroundColor: 'var(--color-bg-sunken)', height: '16px', borderRadius: 'var(--radius-sm)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'var(--color-accent)', height: '100%', width: '80%' }} />
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)' }}>4</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--text-xs)' }}>
              <span style={{ width: '80px', fontWeight: 'var(--weight-medium)' }}>Outcome</span>
              <div style={{ flex: 1, backgroundColor: 'var(--color-bg-sunken)', height: '16px', borderRadius: 'var(--radius-sm)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'var(--color-accent)', height: '100%', width: '40%' }} />
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)' }}>2</span>
            </div>
          </div>
        </Row>
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.h2}>{title}</h2>
        <span className={styles.note}>{note}</span>
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowItems}>{children}</div>
    </div>
  )
}
