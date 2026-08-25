// Rasterizes the Journal of Delights mark into the PWA icon set + favicon.
// Run with `npm run gen:journal-icons`. Re-run whenever journal-icon.svg changes.
//
// Only one source SVG (unlike apps with a separate transparent favicon
// mark) — the icon's own full-bleed tile art is resized down for the
// favicon too.
//
//   journal-icon.svg              — full-bleed dark tile (launcher art)
//
//   journal-icon-192.png          — PWA any     ← icon.svg (tile)
//   journal-icon-512.png          — PWA any     ← icon.svg (tile)
//   journal-icon-512-maskable.png — PWA maskable ← icon.svg (bg bleeds to edge)
//   journal-favicon-32.png        — favicon      ← icon.svg (tile)
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'journal-icon.svg'))

async function tile(size, name) {
  const png = await sharp(iconSvg, { density: 384 }).resize(size, size).png().toBuffer()
  await writeFile(resolve(pub, name), png)
  console.log('  ✓', name)
}

console.log('Generating Journal of Delights icons …')
await tile(192, 'journal-icon-192.png')
await tile(512, 'journal-icon-512.png')
await tile(512, 'journal-icon-512-maskable.png')
await tile(32, 'journal-favicon-32.png')
console.log('Done.')
