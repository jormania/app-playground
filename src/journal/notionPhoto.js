// Shared helper for reading a Notion Photo property's bytes in the browser.
// Notion's signed file URL sends no CORS headers — fine for the <img> tag
// that already renders it in the app, useless for a direct fetch() to read
// the bytes. Routes through /api/notion-photo-proxy instead: a
// server-to-server fetch has no CORS restriction, and same-origin means the
// browser can read what comes back. Used by share.js (attaching to a native
// share/clipboard write) and exportHtml.js (embedding as a data URI in the
// exported file). Any failure (offline, an expired signed URL, the proxy
// itself erroring) resolves to null rather than throwing — callers treat a
// missing photo as "just proceed without it," never an error.
export async function fetchPhotoBlob(url) {
  if (!url) return null
  try {
    const res = await fetch(`/api/notion-photo-proxy?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}
