// Share one item via the OS share sheet (which itself offers WhatsApp, email, and
// whatever else the device has — no need for Wanderlist to build its own per-channel
// buttons). Text-only by request — the name, the note, its link and its place; no
// attachments and no app metadata (dates, category, tags, attended state are
// Wanderlist's own bookkeeping, not part of the thing you're telling someone about).

export function canShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

// The place + links footer. `📍`/`🔗` read fine wherever the OS sheet lands the text.
function footer(entry) {
  const foot = []
  if (entry?.place) foot.push(`📍 ${entry.place}`)
  if (entry?.placeUrl) foot.push(entry.placeUrl)
  if (entry?.link) foot.push(`🔗 ${entry.link}`)
  return foot
}

// The full blurb (name + note + footer) — the OS sheet's `text`, and the clipboard
// fallback's copied text.
export function shareText(entry) {
  const lines = [entry?.name || 'Something to see']
  if (entry?.description) lines.push('', entry.description)
  const foot = footer(entry)
  if (foot.length) lines.push('', ...foot)
  return lines.join('\n')
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
