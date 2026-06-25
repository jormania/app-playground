// Builds a self-contained HTML keepsake of completed Odysseys — the *essence* of each, in the
// app's Deep Indigo style: who you became, what you practised, why it mattered, the benefit you
// pictured, and what installed. No run-time mechanics, no metrics, no blame. `buildSynopsisHtml`
// is pure (no DOM) and unit-tested; `downloadSynopsis` is the thin browser wrapper.

import type { OdysseyDetail } from './notion'

export const SYNOPSIS_FILENAME = 'sol-odyssey-synopsis.html'

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function esc(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c])
}

/** A labelled line, omitted entirely when the value is empty. */
function row(label: string, value: string): string {
  const v = (value ?? '').trim()
  if (!v) return ''
  return `<div class="row"><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>`
}

function odysseySection(o: OdysseyDetail): string {
  const tag = o.outcome ? `<span class="pill">${esc(o.outcome)}</span>` : ''
  const identity = o.identity.trim() || o.behaviour.trim()
  const lines = [
    row('Practised', o.tinyVersion || o.behaviour),
    row('Why it mattered', o.whyValue),
    row('Pictured', o.outcomePicture),
    row('What installed', o.notes),
  ].join('')

  return `<section class="odyssey">
      <div class="odyssey-head">
        <span class="eyebrow">${esc(o.title)}</span>
        ${tag}
      </div>
      ${identity ? `<p class="identity">${esc(identity)}</p>` : ''}
      <dl>${lines}</dl>
    </section>`
}

/** Full self-contained HTML keepsake for the given (completed) Odysseys, oldest first. */
export function buildSynopsisHtml(odysseys: OdysseyDetail[]): string {
  const ordered = [...odysseys].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
  const count = ordered.length
  const sections = ordered.map(odysseySection).join('\n')
  const subtitle = count === 1 ? '1 Odyssey' : `${count} Odysseys`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Sol Odyssey — Synopsis</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,ital,wght@9..144,0,400;9..144,0,600;9..144,1,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
  :root {
    --bg: #F7F7FC; --surface: #EEEEF7; --ink: #1F1B4D; --muted: #5C5891;
    --border: #C2BFE3; --hair: #E8E7F5; --accent: #4B45C6; --accent-soft: #E7E5FA;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: "Inter", system-ui, sans-serif; line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 680px; margin: 0 auto; padding: 48px 24px 72px; }
  h1 { font-family: "Fraunces", Georgia, serif; font-weight: 600; line-height: 1.15; font-size: 2rem; margin: 0; }
  .eyebrow { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
  .lede { color: var(--muted); margin: 4px 0 0; }
  .odyssey { background: var(--surface); border: 1px solid var(--hair); border-radius: 18px; padding: 28px; margin-top: 24px; }
  .odyssey-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .identity { font-family: "Fraunces", Georgia, serif; font-size: 1.5rem; font-style: italic; line-height: 1.25; margin: 12px 0 18px; }
  dl { margin: 0; display: flex; flex-direction: column; gap: 12px; }
  .row dt { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
  .row dd { margin: 2px 0 0; }
  .pill { display: inline-block; background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 3px 12px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 0.72rem; }
  footer { margin-top: 44px; color: var(--muted); font-size: 0.8rem; text-align: center; }
  @media print { body { background: #fff; } .odyssey { break-inside: avoid; } }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="eyebrow">Sol Odyssey · Synopsis</p>
      <h1>Who you've become</h1>
      <p class="lede">${subtitle} — what you practised into being, and why it mattered.</p>
    </header>
    ${sections}
    <footer>One behaviour · 42 days · witnessed.</footer>
  </div>
</body>
</html>`
}

/** Build the keepsake and download it as a self-contained file. */
export function downloadSynopsis(odysseys: OdysseyDetail[]): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([buildSynopsisHtml(odysseys)], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = SYNOPSIS_FILENAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
