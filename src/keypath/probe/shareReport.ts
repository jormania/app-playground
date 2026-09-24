export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'error'

type ShareNav = Pick<Navigator, 'share'> | undefined

/**
 * Hand the report to the OS share sheet, where the Claude app is one of the
 * targets. Shared as plain text rather than a .json file: every app that
 * accepts text accepts this, whereas which apps take an application/json
 * attachment varies. A few tens of KB of text is well within what Android
 * passes between apps.
 */
export interface ShareLabels {
  title: string
  /** A line before the JSON, so whoever receives it knows what it is. */
  intro: string
}

const PROBE: ShareLabels = { title: 'KeyPath probe report', intro: 'KeyPath probe report (PSR-E383 over USB MIDI). Please read these results.' }

export async function shareReport(json: string, nav: ShareNav = typeof navigator === 'undefined' ? undefined : navigator, labels: ShareLabels = PROBE): Promise<ShareOutcome> {
  if (typeof nav?.share !== 'function') return 'unsupported'
  try {
    await nav.share({
      title: labels.title,
      text: `${labels.intro}\n\n${json}`,
    })
    return 'shared'
  } catch (err) {
    // AbortError is the user closing the sheet — not a failure worth reporting.
    return err instanceof Error && err.name === 'AbortError' ? 'cancelled' : 'error'
  }
}

export function canShareReport(nav: ShareNav = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  return typeof nav?.share === 'function'
}
