/**
 * What a kept link can read off its own page: the article's title, its
 * byline and year, and the publication that ran it — so a Link thing stops
 * sitting in the forest titled `https://nesslabs.com/jomo` with every other
 * field blank.
 *
 * This is the same judgment call as `isBareUrl` in `kindInference.ts`, and
 * it is deliberately *not* the one SILVA.md forbids: nothing is being
 * classified, scored or tagged here. A body that is nothing but a URL is a
 * placeholder the paste left behind — the page's own `<title>`/`og:title` is
 * a fact already on the page, not an inference about what the thing means to
 * you. The note you write afterwards is still entirely yours.
 *
 * The guard rails are all in `linkTitlePatch`, and they are the point:
 *
 * - it only ever replaces a body that is *nothing but* a bare URL, so a
 *   passage you typed — or a link you already retitled by hand — is never
 *   overwritten, no matter how often the preview refreshes;
 * - a title that is itself a URL is no improvement, and is refused;
 * - so is one long enough to be a page dump rather than a headline (some
 *   sites put a whole standfirst in `og:title`).
 *
 * Applied at Keep (App.tsx `handleKeep`) rather than at intake: the preview
 * is usually already cached by then — the Nursery row fetched it for its
 * thumbnail — and Keep is the moment the thing acquires a permanent place,
 * which is the moment a real title starts to matter.
 */
import type { Thing } from './notion'
import type { LinkPreview } from './linkPreviewCache'
import { isBareUrl } from './kindInference'

/** Past this, it isn't a headline. */
const MAX_TITLE_LENGTH = 200

/**
 * The body patch that gives a link its article's title, or null when there
 * is nothing safe to do — which is the common case and must stay silent.
 *
 * `handle` is left out on purpose: `SilvaStore.updateThing` re-derives it
 * from a changed body, so the Notion row's title follows along on its own.
 */
export function linkTitlePatch(thing: Thing, preview: LinkPreview | null): Partial<Thing> | null {
  if (!preview || !thing.link) return null
  // Only a placeholder body is replaceable — never your own words.
  if (!isBareUrl(thing.body)) return null

  const title = String(preview.title || '').replace(/\s+/g, ' ').trim()
  if (!title) return null
  if (title.length > MAX_TITLE_LENGTH) return null
  // A title that is just the URL again, which some pages do report.
  if (isBareUrl(title)) return null
  if (title === thing.body.trim()) return null

  return { body: title }
}

/**
 * The specimen label's locator for a link — "Anne-Laure Le Cunff · 2021" —
 * from the byline and publication year the page prints on itself.
 *
 * `Locator` is documented as "chapter, page, timestamp": where in a work
 * this came from. For an article, the byline and the year are the closest
 * true equivalent, and they were the fields most likely to be lost — nobody
 * types a byline into a capture field.
 *
 * Only ever fills an *empty* locator. Anything you wrote there ("overheard
 * on the 32 tram") outranks anything a meta tag has to say.
 */
export function linkLocatorPatch(thing: Thing, preview: LinkPreview | null): Partial<Thing> | null {
  if (!preview || !thing.link) return null
  if (thing.locator.trim()) return null

  const parts = [preview.author, preview.publishedYear]
    .map((part) => String(part || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (parts.length === 0) return null

  return { locator: parts.join(' · ') }
}

/**
 * Everything a kept link takes from its own page, in one patch — or null
 * when the page had nothing to offer that this thing didn't already have.
 */
export function linkFactsPatch(thing: Thing, preview: LinkPreview | null): Partial<Thing> | null {
  const patch = { ...linkTitlePatch(thing, preview), ...linkLocatorPatch(thing, preview) }
  return Object.keys(patch).length > 0 ? patch : null
}

/**
 * The publication to file a kept link under — its site name, which is the
 * one thing on the page that answers "where did you encounter this?".
 *
 * Returned as plain text rather than a `sourceId`, because turning it into a
 * real Sources row means reusing an existing match or creating one, and only
 * App.tsx has the store to do that (`resolveSourceDraft`, threshold 0.9 — so
 * a forest ends up with one "Ness Labs", not four).
 *
 * Never overrides a source you set: a piece you found through someone else,
 * filed under them, stays filed under them.
 */
export function linkSourceTitle(thing: Thing, preview: LinkPreview | null): string | null {
  if (!preview || !thing.link || thing.sourceId) return null

  const siteName = String(preview.siteName || '').replace(/\s+/g, ' ').trim()
  if (!siteName || siteName.length > MAX_TITLE_LENGTH) return null
  // `siteName` falls back to the bare hostname when a page declares no
  // `og:site_name` — "nesslabs.com" is a plainer answer than "Ness Labs",
  // but it is still the true one, and still better than no provenance.
  if (isBareUrl(siteName)) return null

  return siteName
}
