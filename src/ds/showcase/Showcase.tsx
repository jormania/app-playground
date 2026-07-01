import { useState } from 'react'
import { Button, Field, Modal } from '../index'
import styles from './Showcase.module.css'

/** The design system's first consumer: a gallery that renders every component in
 *  every state. It proves the API and doubles as a visual workbench. */
export function Showcase() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [modalOpen, setModalOpen] = useState(false)

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
    </div>
  )
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
