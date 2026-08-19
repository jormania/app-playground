import { useEffect, useRef, useState } from 'react'
import { Button } from '../../ds'
import styles from './IntakeField.module.css'

export interface IntakeFieldProps {
  onSubmit: (body: string, locator: string, sourceInput: string) => void
  onPhoto: (file: File) => void
  /** A share arriving from elsewhere on the device (lib/sharedIntake.ts) —
   *  pre-fills the field rather than landing silently, so the one moment when
   *  a note is easiest to write isn't thrown away. */
  prefill?: { body: string; locator: string } | null
  /** Set while a photograph is being processed and uploaded. */
  busy?: boolean
}

/** Type-or-paste intake — one required field, no required metadata beyond it
 *  (SILVA.md "Intake"). Kind and locus are still assigned later, if ever.
 *
 *  Source is the one deliberate exception, and still not required: it's the
 *  piece of context most likely to evaporate before curation ever happens —
 *  you'll remember *why* a line stopped you months from now, not which of
 *  four books you were holding. Offered here as a plain typed line
 *  ("Shelby Foote — The Civil War"), never a picker; resolving that text
 *  into a real Source (reuse a match, create otherwise) happens in App.tsx
 *  (lib/sourceCapture.ts), which is the only place that needs the store. */
export function IntakeField({ onSubmit, onPhoto, prefill = null, busy = false }: IntakeFieldProps) {
  const [value, setValue] = useState('')
  const [locator, setLocator] = useState('')
  const [source, setSource] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // A share opens the app straight here, filled in and focused, with the
  // cursor at the end so a note can be added without repositioning first.
  useEffect(() => {
    if (!prefill) return
    setValue(prefill.body)
    setLocator(prefill.locator)
    const field = textareaRef.current
    if (field) {
      field.focus()
      field.setSelectionRange(field.value.length, field.value.length)
    }
  }, [prefill])

  function submit() {
    const body = value.trim()
    if (!body && !locator.trim()) return
    onSubmit(body, locator.trim(), source.trim())
    setValue('')
    setLocator('')
    setSource('')
  }

  return (
    <div className={styles.wrap}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        aria-label="Type or paste something worth keeping"
        placeholder="Type or paste something worth keeping…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
        rows={3}
      />

      <input
        className={styles.source}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
        placeholder="Where did you encounter this? (optional — a book, a person, a place)"
        aria-label="Where did you encounter this"
      />

      {/* Only shown once something arrived carrying one — an empty locator
       *  field on every capture would be exactly the required metadata this
       *  lane is meant not to ask for. */}
      {locator && (
        <input
          className={styles.locator}
          value={locator}
          onChange={(e) => setLocator(e.target.value)}
          aria-label="Where this came from"
        />
      )}

      <div className={styles.actions}>
        <Button size="sm" onClick={submit} disabled={busy || (!value.trim() && !locator.trim())}>
          Add to the nursery
        </Button>
        {/* The photograph lane. `Image` has been a Kind in the vocabulary with
         *  no way to create one; a picture of a page is a legitimate thing,
         *  deliberately not OCR'd (SILVA.md "Intake"). */}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Adding the photo…' : 'Photograph a page'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.fileInput}
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Cleared so photographing the same page twice in a row still fires.
            e.target.value = ''
            if (file) onPhoto(file)
          }}
        />
      </div>
    </div>
  )
}
