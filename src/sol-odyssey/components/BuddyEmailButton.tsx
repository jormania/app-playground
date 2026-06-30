import { useRef, useState, type CSSProperties } from 'react'
import { Mail, Check, ExternalLink } from 'lucide-react'
import { Button } from './Button'
import { useSettings } from '../lib/settingsContext'
import { isValidEmail } from '../lib/settings'
import { gmailComposeUrl, emailToPlainText, PASTE_REMINDER, type BuddyEmail, type EmailSection } from '../lib/buddyMail'

// ── Email-safe inline styles ───────────────────────────────────────────────────────────────────
// Everything here is INLINE (mail clients strip <style>, classes, and SVGs). Visual accents come
// from Unicode emojis + structural CSS only: text/background colours, padding, and a border-left
// rail. These hex values are deliberately literal (not design tokens): the markup is copied OUT of
// the app into a third-party email, where our tokens don't exist.
const FRAME: CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '15px',
  lineHeight: 1.55,
  color: '#1f2333',
  maxWidth: '600px',
}
const HEADING: CSSProperties = { margin: '0 0 14px', fontSize: '18px', fontWeight: 700, color: '#312e81' }
const LEAD: CSSProperties = { margin: '0 0 6px' }
const INTRO: CSSProperties = { margin: '0 0 16px' }
const PANEL: CSSProperties = {
  borderLeft: '4px solid #4f46e5',
  background: '#f4f3fb',
  padding: '12px 16px',
  borderRadius: '0 6px 6px 0',
  margin: '0 0 12px',
}
const SECTION_TITLE: CSSProperties = { margin: '0 0 8px', fontWeight: 700, color: '#312e81' }
const ROW: CSSProperties = { margin: '0 0 6px' }
const ROW_LABEL: CSSProperties = { fontWeight: 700, color: '#312e81' }
const OUTRO: CSSProperties = { margin: '12px 0 0', color: '#5b6170' }
const SIGN: CSSProperties = { margin: '14px 0 0', fontSize: '12px', color: '#9096a3' }

/** The visible-to-the-DOM-but-hidden-to-the-eye rich template. We keep it in the document (not
 *  conditionally rendered) so its node is always available to serialize via `.innerHTML`. */
function RichEmail({ email }: { email: BuddyEmail }) {
  return (
    <div style={FRAME}>
      <p style={HEADING}>{email.heading}</p>
      <p style={LEAD}>{email.greeting}</p>
      <p style={INTRO}>{email.intro}</p>
      {email.sections.map((s: EmailSection, i) => (
        <div key={i} style={PANEL}>
          {s.title && <p style={SECTION_TITLE}>{s.title}</p>}
          {s.rows.map((r, j) => (
            <p key={j} style={ROW}>
              <span style={ROW_LABEL}>
                {r.emoji} {r.label}:
              </span>{' '}
              {r.value}
            </p>
          ))}
        </div>
      ))}
      <p style={OUTRO}>{email.outro}</p>
      <p style={SIGN}>Sent with Sol Odyssey</p>
    </div>
  )
}

/** Copy the rendered HTML (+ a plain-text fallback) to the clipboard. Returns true on any success.
 *  Tries the rich two-MIME ClipboardItem first, then degrades to writeText, then to execCommand. */
async function copyEmail(html: string, text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ])
      return true
    }
  } catch {
    /* fall through to plain-text paths */
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    /* last resort below */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** One consistent "copy this email and open Gmail" affordance, used at every buddy-contact point
 *  (and for the welcome package in Settings). It copies the formatted note to the clipboard, then
 *  opens Gmail's compose window pre-addressed with the recipient + subject; the user pastes the
 *  body. The app sends nothing itself.
 *
 *  Recipient/label default to the saved buddy, but can be overridden (the Settings welcome note
 *  reads the in-progress form). `inSettings` swaps the "go to Settings" nudge for an inline hint. */
export function BuddyEmailButton({
  email,
  navigate,
  to,
  buddyName,
  label,
  inSettings = false,
}: {
  email: BuddyEmail
  navigate?: (to: string) => void
  to?: string
  buddyName?: string
  label?: string
  inSettings?: boolean
}) {
  const { settings } = useSettings()
  const recipient = (to ?? settings.buddyEmail).trim()
  const name = (buddyName ?? settings.buddyName).trim()
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  // If the popup is blocked, we surface a manual link instead of silently failing.
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null)

  const ready = isValidEmail(recipient)

  if (!ready) {
    return inSettings ? (
      <p className="font-sans text-sm text-text-secondary">
        <Mail size={15} className="mr-1.5 inline align-text-bottom" aria-hidden />
        Add a valid <strong>buddy email</strong> above to copy the welcome note.
      </p>
    ) : (
      <p className="font-sans text-sm text-text-secondary">
        <Mail size={15} className="mr-1.5 inline align-text-bottom text-text-secondary" aria-hidden />
        Add your buddy’s email in{' '}
        <button
          type="button"
          className="font-medium text-accent underline"
          onClick={() => navigate?.('/settings')}
        >
          Settings
        </button>{' '}
        to draft messages.
      </p>
    )
  }

  async function copyAndOpen() {
    setBlockedUrl(null)
    const html = ref.current?.innerHTML ?? ''
    await copyEmail(html, emailToPlainText(email))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 8000)

    const url = gmailComposeUrl(recipient, email.subject, PASTE_REMINDER)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) setBlockedUrl(url) // popup blocked — offer a manual link
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" onClick={copyAndOpen}>
          {copied ? <Check size={18} aria-hidden /> : <Mail size={18} aria-hidden />}
          {label ?? (name ? `Email ${name}` : 'Email your buddy')}
        </Button>
      </div>

      {copied && (
        <p className="font-sans text-sm text-text-secondary">
          ✅ Copied. In the Gmail window that opened, <strong>paste</strong> (Ctrl/⌘+V) to drop in the
          formatted note.
        </p>
      )}
      {blockedUrl && (
        <p className="font-sans text-sm text-caution">
          Your browser blocked the new tab —{' '}
          <a href={blockedUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline">
            open Gmail <ExternalLink size={13} className="inline align-text-top" aria-hidden />
          </a>{' '}
          and paste.
        </p>
      )}

      {/* Off-screen rich source for the clipboard's text/html flavour. Kept rendered (not
          display:none) but pulled out of view + flow, and hidden from a11y/tab order. */}
      <div
        ref={ref}
        aria-hidden
        style={{ position: 'absolute', left: '-9999px', top: 0, width: '600px', pointerEvents: 'none' }}
      >
        <RichEmail email={email} />
      </div>
    </div>
  )
}
