import { Mail } from 'lucide-react'
import { Button } from './Button'
import { useSettings } from '../lib/settingsContext'
import { isValidEmail } from '../lib/settings'
import { buildMailtoUrl, type BuddyMail } from '../lib/buddyMail'

/** One consistent "draft an email to your buddy" affordance, used at every buddy-contact point.
 *  Builds a mailto: from the recorded buddy email and opens the user's own mail client — the app
 *  sends nothing. Disabled (with a Settings nudge) until a valid buddy email is on file. */
export function BuddyEmailButton({
  mail,
  navigate,
}: {
  mail: BuddyMail
  navigate?: (to: string) => void
}) {
  const { settings } = useSettings()
  const email = settings.buddyEmail
  const name = settings.buddyName.trim()
  const ready = isValidEmail(email)

  if (!ready) {
    return (
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

  return (
    <Button
      variant="secondary"
      // mailto via location.href is the reliable hand-off on mobile (no pop-up blocking).
      onClick={() => {
        window.location.href = buildMailtoUrl(email, mail)
      }}
    >
      <Mail size={18} aria-hidden />
      {name ? `Draft email to ${name}` : 'Draft email to your buddy'}
    </Button>
  )
}
