/**
 * Reading a kept link's own title out of its Open Graph preview, so a Link
 * thing stops sitting in the forest titled `https://nesslabs.com/jomo`.
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
