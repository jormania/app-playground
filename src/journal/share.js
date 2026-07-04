// Share a delight via the OS share sheet where the browser supports it
// (mobile Chrome/Safari, and modern desktop Chrome/Edge on Windows/macOS),
// falling back to copying a plain-text bundle — plus the photo too, when the
// clipboard can carry an image — on anything without navigator.share (mostly
// desktop Linux/older browsers). Deliberately just title + entry text +
// photo: day/tags/people are journal metadata, not part of the delight
// itself. Email is a dedicated path (emailUrl, below) rather than going
// through here — see its own comment for why.
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

// A dedicated mailto: link, not a navigator.share() call routed to Gmail —
// the generic share sheet hands identical {title, text} fields to whichever
// app the user picks, with no way to format just one of them differently.
// A mailto: URL lets us set the subject deterministically instead, so the
// title only ever appears once (in the subject), never doubled into the
// body the way the generic Share button's WhatsApp workaround needs. Can't
// carry the photo — mailto: has no attachment mechanism, on any client.
export function emailUrl(entry) {
  const title = entry?.title || 'A delight'
  const date = formatMedium(entry?.date)
  const subject = date ? `Gabriel's Delight from ${date}: ${title}` : `Gabriel's Delight: ${title}`
  const body = entry?.entry || ''
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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
  const file = await photoFile(entry?.photo)

  if (canShare()) {
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

  return copyToClipboard(text, file)
}

// Mirrors Sol Odyssey's buddyMail copy pattern: a rich multi-type
// ClipboardItem first (text + image, when there's a photo), degrading to
// plain writeText if that's unsupported or throws.
async function copyToClipboard(text, file) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const parts = { 'text/plain': new Blob([text], { type: 'text/plain' }) }
      if (file) parts[file.type] = file
      await navigator.clipboard.write([new ClipboardItem(parts)])
      return { ok: true, copied: true, withPhoto: Boolean(file) }
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
