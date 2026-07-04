// Share a delight via the OS share sheet where the browser supports it
// (mobile Chrome/Safari, and modern desktop Chrome/Edge on Windows/macOS),
// falling back to copying a plain-text bundle — plus the photo too, when the
// clipboard can carry an image — on anything without navigator.share (mostly
// desktop Linux/older browsers). Deliberately just title + entry text +
// photo: day/tags/people are journal metadata, not part of the delight
// itself. Email (shareByEmail, below) is a separate, mailto:-based path —
// see its own comment for why it doesn't reuse navigator.share() the way
// this one does.
import { fetchPhotoBlob } from './notionPhoto.js'
import { formatMedium } from './dates.js'

export function canShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

async function photoFile(photo) {
  if (!photo?.url) return null
  const blob = await fetchPhotoBlob(photo.url)
  if (!blob) return null
  return new File([blob], photo.name || 'delight.jpg', { type: blob.type || 'image/jpeg' })
}

// Generic, not personalized — Journal of Delights is BYO-Notion, so anyone
// can run their own copy against their own database; the subject shouldn't
// name a specific person.
function emailSubject(entry) {
  const title = entry?.title || 'A delight'
  const date = formatMedium(entry?.date)
  return date ? `A Delight from ${date}: ${title}` : `A Delight: ${title}`
}

export async function shareEntry(entry) {
  const title = entry?.title || 'A delight'
  const entryText = entry?.entry || ''
  // The title also gets folded into `text`, not just passed as its own
  // field: some share targets (WhatsApp's Android handler, notably) only
  // ever read `text`, silently dropping `title` — putting it in both means
  // it survives everywhere, at the cost of Gmail-style subject-line targets
  // seeing it twice (subject + first line of the body), which reads fine.
  const text = entryText ? `${title}\n\n${entryText}` : title

  if (canShare()) {
    const file = await photoFile(entry?.photo)
    const data = { title, text }
    if (file && navigator.canShare?.({ files: [file] })) data.files = [file]
    try {
      await navigator.share(data)
      return { ok: true, shared: true }
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: true, cancelled: true }
      // fall through to the clipboard fallback below
    }
  }

  return copyToClipboard(text, entry?.photo)
}

// Always a mailto: link for the subject/body — never routed through
// navigator.share(), unlike Share above. That was tried first, and Gmail
// (tested on a real phone) turned out to silently drop the entry text
// whenever a file was attached alongside it: Android's share intent can
// only carry one MIME type, so once a photo is involved the intent becomes
// an image share with the text along for the ride, and different mail
// apps read that differently — Gmail's read of it was an empty body. A
// mailto: link has no such ambiguity: subject and body land correctly on
// every mail client, every time. The tradeoff is the one thing mailto:
// truly cannot do on any client — carry an attachment — so the photo is
// copied to the clipboard instead, ready to paste into the compose window
// that opens (Gmail's own compose accepts a pasted image directly).
//
// Deliberately NOT an async function: navigator.clipboard.write() has to be
// *called* within the click's transient user activation, which an `await`
// before it (even just for the photo's network fetch) can spend — after
// which the write silently no-ops, leaving whatever was already on the
// clipboard in place. So the write is kicked off synchronously, right here,
// passing it a promise for the photo bytes rather than waiting for them
// first; the caller awaits the returned `ready` promise to know whether it
// actually landed, and should hold off opening the mailto: link until then
// (see EntryView.jsx) so the user isn't pasting before it's ready.
export function shareByEmail(entry) {
  const subject = emailSubject(entry)
  const text = entry?.entry || ''
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`

  if (!entry?.photo?.url) return { mailto, ready: Promise.resolve(false) }
  return { mailto, ready: withTimeout(copyPhotoToClipboard(entry.photo.url), 5000) }
}

// A hung fetch (dead network, proxy down) shouldn't leave the Email button
// stuck forever — after this, it proceeds to mailto: without the photo.
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(false), ms))])
}

function copyPhotoToClipboard(url) {
  if (!(navigator.clipboard?.write && typeof ClipboardItem !== 'undefined')) return Promise.resolve(false)
  try {
    // Our own upload pipeline (photo.js) always resizes to JPEG before it
    // ever reaches Notion, so the eventual blob's real type is known ahead
    // of the fetch that will produce it.
    const blobPromise = fetchPhotoBlob(url).then((blob) => {
      if (!blob) throw new Error('photo unavailable')
      return blob
    })
    return navigator.clipboard.write([new ClipboardItem({ 'image/jpeg': blobPromise })])
      .then(() => true)
      .catch(() => false)
  } catch {
    return Promise.resolve(false)
  }
}

// Mirrors Sol Odyssey's buddyMail copy pattern: a rich multi-type
// ClipboardItem first (text + image, when there's a photo), degrading to
// plain writeText if that's unsupported or throws. Same activation
// constraint as copyPhotoToClipboard above — the photo (when there is one)
// is passed to ClipboardItem as a pending promise, and write() is called
// before anything is awaited, not after.
async function copyToClipboard(text, photo) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const parts = { 'text/plain': new Blob([text], { type: 'text/plain' }) }
      if (photo?.url) {
        parts['image/jpeg'] = fetchPhotoBlob(photo.url).then((blob) => {
          if (!blob) throw new Error('photo unavailable')
          return blob
        })
      }
      await navigator.clipboard.write([new ClipboardItem(parts)])
      return { ok: true, copied: true, withPhoto: Boolean(photo?.url) }
    }
  } catch {
    // fall through to text-only
  }
  try {
    await navigator.clipboard.writeText(text)
    return { ok: true, copied: true, withPhoto: false }
  } catch {
    return { ok: false }
  }
}
