/**
 * The fields a capture can fill from the capture itself — nothing more.
 *
 * Everything here is *reading*, never inferring: a URL is a URL wherever it
 * arrived, and a thing carrying one is a Link. The fields that say what
 * something meant to you — `note`, the Nursery's "+ Why", `loci` — are never
 * touched from here, and `kept` is yours by definition.
 *
 * ── Why the locator is promoted ─────────────────────────────────────────
 * `lib/sharedIntake.ts` puts a shared URL in the **locator** ("a share whose
 * `text` is nothing but a URL is a link, so it becomes the locator"), which
 * was right when a URL had nowhere better to go. It no longer is: `link` is
 * the field that draws the preview card, earns the `Link` kind and, since
 * `lib/linkTitle.ts`, gives the thing the article's own title. Left in the
 * locator, a link shared from the phone's share sheet — the lane most likely
 * to be used at all — got none of that, and printed the raw URL on the
 * specimen label instead.
 *
 * So a locator that is *nothing but* a URL moves into `link`. A locator that
 * merely contains one ("overheard on the 32 tram, https://…") is prose you
 * wrote and stays exactly where you put it.
 */
import { isBareUrl, intakeKind } from './kindInference'
import type { ThingKind } from './notion'

export interface IntakeFields {
  body: string
  locator: string
  link: string | null
  kind: ThingKind | null
}

/** What a typed, pasted or shared capture already knows about itself. */
export function intakeFields(body: string, locator = ''): IntakeFields {
  const trimmedBody = body.trim()
  const trimmedLocator = locator.trim()

  // A pasted body that is nothing but a URL already *is* the link. Failing
  // that, a locator that is nothing but a URL is one too — and is moved
  // rather than copied, so the URL isn't printed twice on the plate (once
  // as a label, once as its own preview card).
  if (isBareUrl(trimmedBody)) {
    return { body, locator, link: trimmedBody, kind: intakeKind(trimmedBody) }
  }
  if (isBareUrl(trimmedLocator)) {
    return { body, locator: '', link: trimmedLocator, kind: 'Link' }
  }
  return { body, locator, link: null, kind: null }
}
