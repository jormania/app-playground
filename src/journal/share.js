// Share a delight via the OS share sheet where the browser supports it
// (mobile Chrome/Safari, and modern desktop Chrome/Edge on Windows/macOS),
// falling back to copying a plain-text bundle — plus the photo too, when the
// clipboard can carry an image — on anything without navigator.share (mostly
// desktop Linux/older browsers). Deliberately just title + entry text +
// photo: day/tags/people are journal metadata, not part of the delight
// itself.

export function canShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

// Notion's Photo url is a signed S3 link with no CORS headers — fine for the
// <img> tag that already renders it, but a direct fetch() from the browser
// can't read the bytes (an opaque/failed response), so this always routes
// through our own /api/notion-photo-proxy relay instead: a server-to-server
// fetch has no CORS restriction, and same-origin means the browser can read
// what comes back. Any failure here (offline, an expired signed URL, the
// proxy itself erroring) just means the share/copy goes out as text only,
// never an error.
async function photoFile(photo) {
  if (!photo?.url) return null
  try {
    const res = await fetch(`/api/notion-photo-proxy?url=${encodeURIComponent(photo.url)}`)
    if (!res.ok) return null
    const blob = await res.blob()
    const type = blob.type || 'image/jpeg'
    return new File([blob], photo.name || 'delight.jpg', { type })
  } catch {
    return null
  }
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
