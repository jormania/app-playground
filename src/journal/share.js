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
export async function shareByEmail(entry) {
  const subject = emailSubject(entry)
  const text = entry?.entry || ''
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`

  const file = await photoFile(entry?.photo)
  if (!file) return { ok: true, mailto }

  const photoCopied = await copyPhotoToClipboard(file)
  return { ok: true, mailto, photoCopied }
}

async function copyPhotoToClipboard(file) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })])
      return true
    }
  } catch {
    // best-effort only — email still proceeds via mailto, just without the photo
  }
  return false
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
