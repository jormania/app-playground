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

// Notion's Photo url is a signed, cross-origin file link — fetchable as a
// blob when Notion's hosting allows it, but there's no guarantee (an expired
// signed URL, offline, no CORS). Any failure here just means the share/copy
// goes out as text only, never an error.
async function photoFile(photo) {
  if (!photo?.url) return null
  try {
    const res = await fetch(photo.url)
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
  const text = entry?.entry || ''
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

  return copyToClipboard(title, text, file)
}

// Mirrors Sol Odyssey's buddyMail copy pattern: a rich multi-type
// ClipboardItem first (text + image, when there's a photo), degrading to
// plain writeText if that's unsupported or throws.
async function copyToClipboard(title, text, file) {
  const combined = text ? `${title}\n\n${text}` : title
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const parts = { 'text/plain': new Blob([combined], { type: 'text/plain' }) }
      if (file) parts[file.type] = file
      await navigator.clipboard.write([new ClipboardItem(parts)])
      return { ok: true, copied: true, withPhoto: Boolean(file) }
    }
  } catch {
    // fall through to text-only
  }
  try {
    await navigator.clipboard.writeText(combined)
    return { ok: true, copied: true, withPhoto: false }
  } catch {
    return { ok: false }
  }
}
