// Rasterizes the KeyPath launcher tile into the PWA icon set.
// Run with `npm run gen:keypath-icons`. Re-run whenever keypath-icon.svg changes.
//
//   keypath-icon-192.png          — PWA any
//   keypath-icon-512.png          — PWA any
//   keypath-icon-512-maskable.png — PWA maskable (the ground bleeds to the edge)
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'keypath-icon.svg'))

async function tile(size, name) {
  const png = await sharp(iconSvg, { density: 384 }).resize(size, size).png().toBuffer()
  await writeFile(resolve(pub, name), png)
  console.log('  ✓', name)
}

console.log('Generating KeyPath icons …')
await tile(192, 'keypath-icon-192.png')
await tile(512, 'keypath-icon-512.png')
await tile(512, 'keypath-icon-512-maskable.png')
console.log('Done.')
