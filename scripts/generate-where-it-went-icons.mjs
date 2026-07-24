import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'where-it-went-icon.svg'))
const logoSvg = await readFile(resolve(pub, 'where-it-went-logo.svg'))

async function tile(size, name) {
  const png = await sharp(iconSvg, { density: 384 }).resize(size, size).png().toBuffer()
  await writeFile(resolve(pub, name), png)
  console.log('  ✓', name)
}

async function favicon(size, name) {
  const png = await sharp(logoSvg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await writeFile(resolve(pub, name), png)
  console.log('  ✓', name)
}

console.log('Generating Where It Went icons …')
await tile(192, 'where-it-went-icon-192.png')
await tile(512, 'where-it-went-icon-512.png')
await tile(512, 'where-it-went-icon-512-maskable.png')
await favicon(32, 'where-it-went-favicon-32.png')
console.log('Done.')
