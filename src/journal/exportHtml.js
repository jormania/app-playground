// Builds a single self-contained HTML file of the whole journal — Tokyo Night
// styles and the field SVGs baked inline, no external dependencies, so it reads
// the same offline forever. `buildExportHtml` stays pure and sync (returns a
// string from entries that already carry a resolved `photo.dataUrl`, so it's
// still simple to unit-test) — `downloadJournal` does the async photo-fetching
// (via the same CORS-workaround proxy share.js uses) before calling it, then
// wraps the result in a Blob download.
import { sortByDateDesc, formatHuman, todayKey } from './dates.js'
import { fetchPhotoBlob } from './notionPhoto.js'

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Inline SVGs (mirrors icons.jsx) so the export needs no scripts or fonts to show them.
const SVG = {
  people: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 14.7c2.2.6 3.5 2.6 3.5 5.3"/></svg>',
  tags: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11.5l8-8 9 1 1 9-8 8z"/><circle cx="15.5" cy="8.5" r="1.4"/></svg>',
}

function renderEntry(e) {
  const people = (e.people || []).length
    ? `<span class="grp"><span class="lbl">${SVG.people} people</span>${e.people.map(p => `<span class="chip person">${esc(p)}</span>`).join('')}</span>`
    : ''
  const tags = (e.tags || []).length
    ? `<span class="grp"><span class="lbl">${SVG.tags} tags</span>${e.tags.map(t => `<span class="chip tag">${esc(t)}</span>`).join('')}</span>`
    : ''
  const meta = people || tags ? `<div class="meta">${people}${tags}</div>` : ''
  const wc = e.wordCount != null ? `<div class="wc">${e.wordCount} ${e.wordCount === 1 ? 'word' : 'words'}</div>` : ''
  // The data URI is baked straight into the file (not a live Notion URL,
  // which is signed and expires) — that's the whole point of a
  // self-contained export. Missing only when the fetch in downloadJournal
  // failed (offline, expired signed URL) — the entry still exports, just
  // without its picture, same as everywhere else this photo is optional.
  const photo = e.photo?.dataUrl ? `<div class="photo"><img src="${esc(e.photo.dataUrl)}" alt=""/></div>` : ''
  return `<article class="entry">
    <div class="date">${esc(formatHuman(e.date))}</div>
    <h2>${esc(e.title || 'untitled')}</h2>
    ${photo}
    <div class="body">${esc(e.entry)}</div>
    ${meta}${wc}
  </article>`
}

export function buildExportHtml(entries, exportedOn = new Date()) {
  const list = sortByDateDesc(entries || [])
  const count = list.length
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Journal of Delights — export</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1a1b26;color:#c0caf5;font-family:'Inter',system-ui,sans-serif;line-height:1.6;padding:48px 20px;-webkit-font-smoothing:antialiased}
.wrap{max-width:680px;margin:0 auto}
header{text-align:center;margin-bottom:40px}
header .eyebrow{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#bb9af7;margin-bottom:12px}
header h1{font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:2.4rem}
header h1 em{font-style:italic;color:#f0c987}
header .sub{color:#a9b1d6;font-size:14px;margin-top:10px;font-weight:300}
.entry{border-top:1px solid #292e42;padding:28px 0}
.entry .date{font-family:ui-monospace,monospace;font-size:12px;color:#bb9af7}
.entry h2{font-weight:500;font-size:1.4rem;color:#c0caf5;margin:6px 0 14px}
.entry .photo{margin:0 0 16px}
.entry .photo img{max-width:100%;max-height:420px;border-radius:8px;display:block}
.entry .body{font-weight:300;font-size:1.0625rem;line-height:1.75;white-space:pre-wrap;color:#c0caf5}
.meta{display:flex;flex-wrap:wrap;gap:7px 18px;align-items:center;margin-top:16px}
.grp{display:inline-flex;flex-wrap:wrap;gap:7px;align-items:center}
.lbl{display:inline-flex;align-items:center;gap:6px;font-family:ui-monospace,monospace;font-size:11px;color:#565f89}
.chip{font-family:ui-monospace,monospace;font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid #3b4261;color:#a9b1d6}
.chip.person{color:#7dcfff;border-color:rgba(125,207,255,.3)}
.chip.tag{color:#9ece6a;border-color:rgba(158,206,106,.3)}
.wc{font-family:ui-monospace,monospace;font-size:11px;color:#565f89;margin-top:12px}
footer{text-align:center;font-family:ui-monospace,monospace;font-size:11px;color:#565f89;margin-top:40px;border-top:1px solid #292e42;padding-top:24px}
</style></head>
<body><div class="wrap">
<header>
  <div class="eyebrow">a daily practice of attention</div>
  <h1>Journal of <em>Delights</em></h1>
  <div class="sub">${count} ${count === 1 ? 'delight' : 'delights'} · exported ${esc(formatHuman(todayKey(exportedOn)))}</div>
</header>
${list.map(renderEntry).join('\n')}
<footer>based on Ross Gay’s The Book of Delights</footer>
</div></body></html>`
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// Resolves every entry's photo (if any) to a data: URI up front, via the same
// CORS-workaround proxy share.js uses (Notion's signed file URL can't be
// fetch()'d directly from the browser). A failure on any one entry just
// leaves that entry's photo out — never blocks the rest of the export.
// Exported for testing; downloadJournal is its only real caller.
export async function withEmbeddedPhotos(entries) {
  return Promise.all(
    (entries || []).map(async (e) => {
      if (!e.photo?.url) return e
      const blob = await fetchPhotoBlob(e.photo.url)
      if (!blob) return e
      const dataUrl = await blobToDataUrl(blob)
      return { ...e, photo: { ...e.photo, dataUrl } }
    })
  )
}

export async function downloadJournal(entries) {
  const withPhotos = await withEmbeddedPhotos(entries)
  const html = buildExportHtml(withPhotos)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `journal-of-delights-${todayKey()}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
