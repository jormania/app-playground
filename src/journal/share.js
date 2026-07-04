// Share a delight via the OS share sheet where the browser supports it
// (mobile Chrome/Safari, and modern desktop Chrome/Edge on Windows/macOS),
// falling back to copying a plain-text bundle — plus the photo too, when the
// clipboard can carry an image — on anything without navigator.share (mostly
// desktop Linux/older browsers). Deliberately just title + entry text +
// photo: day/tags/people are journal metadata, not part of the delight
// itself. Email (shareByEmail, below) reuses the same navigator.share() but
// with its own subject/body split, rather than folding the title into text
// the way this generic path needs to for WhatsApp's sake.
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

function emailSubject(entry) {
  const title = entry?.title || 'A delight'
  const date = formatMedium(entry?.date)
  return date ? `Gabriel's Delight from ${date}: ${title}` : `Gabriel's Delight: ${title}`
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

// A separate action rather than a "Share" variant: the subject is its own
// custom line ("Gabriel's Delight from <date>: <title>"), the body is the
// entry text alone (never doubled with the title the way the generic Share
// button needs for WhatsApp), and the photo goes along as an attachment
// where the browser can carry files through navigator.share() — this is the
// one path that can actually attach a photo to an email at all, since
// mailto: (and Gmail's own "compose" URL) can never carry an attachment
// from a web page, on any client. Opens the OS share sheet same as Share
// does; the user picks their mail app from it. Falls back to a plain
// mailto: (text only, no photo — a mailto: link truly cannot attach a
// file) when navigator.share isn't available, or fails for a reason other
// than the user cancelling.
export async function shareByEmail(entry) {
  const subject = emailSubject(entry)
  const text = entry?.entry || ''
  const file = await photoFile(entry?.photo)

  if (canShare()) {
    const data = { title: subject, text }
    if (file && navigator.canShare?.({ files: [file] })) data.files = [file]
    try {
      await navigator.share(data)
      return { ok: true, shared: true }
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: true, cancelled: true }
      // fall through to the mailto: fallback below
    }
  }

  return { ok: true, mailto: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` }
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
