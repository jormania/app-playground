// Share one item via WhatsApp, email, or the OS share sheet. Text-only by request — the
// name, the note, its link and its place; no attachments and no app metadata (dates,
// category, tags, attended/paid state are Wanderlist's own bookkeeping, not part of the
// thing you're telling someone about). Mirrors Journal of Delights' share.js, minus all
// the photo/clipboard machinery it needed for attachments.

export function canShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

// The place + links footer, shared by every channel. `📍`/`🔗` read fine in WhatsApp,
// mail and the OS sheet alike.
function footer(entry) {
  const foot = []
  if (entry?.place) foot.push(`📍 ${entry.place}`)
  if (entry?.placeUrl) foot.push(entry.placeUrl)
  if (entry?.link) foot.push(`🔗 ${entry.link}`)
  return foot
}

// The full blurb (name + note + footer) — used verbatim for WhatsApp and the OS sheet's
// `text`. Email splits the name out into the subject instead (see emailUrl).
export function shareText(entry) {
  const lines = [entry?.name || 'Something to see']
  if (entry?.description) lines.push('', entry.description)
  const foot = footer(entry)
  if (foot.length) lines.push('', ...foot)
  return lines.join('\n')
}

export function whatsappUrl(entry) {
  return `https://wa.me/?text=${encodeURIComponent(shareText(entry))}`
}

export function emailUrl(entry) {
  const subject = entry?.name || 'Something to see'
  const lines = []
  if (entry?.description) lines.push(entry.description)
  const foot = footer(entry)
  if (foot.length) { if (lines.length) lines.push(''); lines.push(...foot) }
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`
}

// The OS share sheet where supported (mobile + modern desktop Chromium — this is what
// surfaces WhatsApp, Telegram, etc.), else a plain-text clipboard copy.
export async function shareNative(entry) {
  const text = shareText(entry)
  if (canShare()) {
    try {
      await navigator.share({ title: entry?.name || 'Wanderlist', text })
      return { ok: true, shared: true }
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: true, cancelled: true }
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return { ok: true, copied: true }
  } catch {
    return { ok: false }
  }
}
