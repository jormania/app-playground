/**
 * A cover for a Source, from the ISBN Kobo already knows.
 *
 * `Cover` is the one field in the Sources schema that nothing ever filled —
 * read by Roots, written by hand or not at all. Kobo's `content` table
 * carries the book's ISBN, which makes this an exact lookup rather than a
 * fuzzy title guess: the wrong cover on the wrong book is worse than none,
 * and a title match ("Meditations", of which there are dozens of editions
 * and several unrelated books) would produce exactly that.
 *
 * ── Why no serverless function ──────────────────────────────────────────
 * Open Library serves covers as plain images at a URL derived from the
 * ISBN, so there is nothing to query: the URL *is* the answer. The only
 * open question is whether an image exists there, and a browser can settle
 * that by trying to load it — no proxy, no API key, and nothing against the
 * repo's serverless budget, which is full (CLAUDE.md).
 *
 * The probe matters: `?default=false` makes Open Library 404 rather than
 * hand back a blank placeholder, and storing a URL that 404s would put a
 * permanently broken image in Roots. Better no cover than a broken one.
 */

/** Strips the punctuation ISBNs are printed with; null if what's left
 *  isn't one. Accepts both ISBN-10 (trailing X allowed) and ISBN-13. */
export function normalizeIsbn(raw: unknown): string | null {
  const cleaned = String(raw ?? '').replace(/[^0-9Xx]/g, '').toUpperCase()
  if (/^\d{9}[\dX]$/.test(cleaned)) return cleaned
  if (/^\d{13}$/.test(cleaned)) return cleaned
  return null
}

/** Where a cover for this ISBN would live, or null if it isn't an ISBN. */
export function coverUrlForIsbn(raw: unknown): string | null {
  const isbn = normalizeIsbn(raw)
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null
}

/** How long to wait for the probe before giving up. An import must never
 *  hang on decoration. */
const PROBE_TIMEOUT_MS = 6000

/**
 * Whether an image actually loads from a URL — the browser's own `<img>`,
 * so no CORS negotiation and no fetch. Resolves false rather than throwing,
 * always, including where there is no DOM at all (tests, SSR).
 */
export function imageLoads(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(false)
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), timeoutMs)
    const img = new Image()
    img.onload = () => {
      clearTimeout(timer)
      // Open Library can still answer with a 1×1 placeholder; a cover it
      // isn't.
      done(img.naturalWidth > 1)
    }
    img.onerror = () => {
      clearTimeout(timer)
      done(false)
    }
    img.src = url
  })
}

/**
 * The cover URL to store for a book, or null when there is no ISBN, no
 * cover behind it, or anything at all goes wrong. Never throws: a missing
 * cover is exactly how every Source looked before this existed.
 */
export async function findBookCover(
  isbn: unknown,
  probe: (url: string) => Promise<boolean> = imageLoads,
): Promise<string | null> {
  const url = coverUrlForIsbn(isbn)
  if (!url) return null
  try {
    return (await probe(url)) ? url : null
  } catch {
    return null
  }
}
