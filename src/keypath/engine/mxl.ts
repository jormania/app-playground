import { child, decodeText, parseXml } from './xml'

// Compressed MusicXML (.mxl, what MuseScore offers as "MusicXML") and
// MuseScore's own files (.mscz): each a zip holding the score and
// META-INF/container.xml, which names it. Read with the
// platform's own inflater (DecompressionStream, in Chrome and Node alike),
// so no zip library joins the bundle. Stored and deflated entries only; no
// ZIP64, which a score never needs.

export class MxlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MxlError'
  }
}

/** A zip starts with a local file header. */
export const isZip = (bytes: Uint8Array) => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04

interface Entry {
  name: string
  method: number
  size: number
  offset: number
}

function entriesOf(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The end-of-central-directory record, searched for from the end (a comment may follow it).
  let eocd = -1
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--) {
    if (view.getUint32(at, true) === 0x06054b50) {
      eocd = at
      break
    }
  }
  if (eocd < 0) throw new MxlError('Not a zip file')
  const count = view.getUint16(eocd + 10, true)
  let at = view.getUint32(eocd + 16, true)
  const names = new TextDecoder()
  const out: Entry[] = []
  for (let k = 0; k < count; k++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new MxlError('A broken zip directory')
    const nameLength = view.getUint16(at + 28, true)
    out.push({
      method: view.getUint16(at + 10, true),
      size: view.getUint32(at + 20, true),
      offset: view.getUint32(at + 42, true),
      name: names.decode(bytes.subarray(at + 46, at + 46 + nameLength)),
    })
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
  }
  return out
}

async function read(bytes: Uint8Array, e: Entry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(e.offset, true) !== 0x04034b50) throw new MxlError(`A broken zip entry: ${e.name}`)
  const start = e.offset + 30 + view.getUint16(e.offset + 26, true) + view.getUint16(e.offset + 28, true)
  const data = bytes.subarray(start, start + e.size)
  if (e.method === 0) return data
  if (e.method !== 8) throw new MxlError(`Unsupported compression in ${e.name}`)
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The score inside an .mxl or .mscz file, as XML text: MusicXML, or MuseScore's .mscx. */
export async function unzipScore(bytes: Uint8Array): Promise<string> {
  const entries = entriesOf(bytes)
  const container = entries.find((e) => e.name === 'META-INF/container.xml')
  let path = ''
  if (container) {
    try {
      path = child(child(parseXml(decodeText(await read(bytes, container))), 'rootfiles'), 'rootfile')?.attrs['full-path'] ?? ''
    } catch {
      path = ''
    }
  }
  // Without a container: MuseScore's own score first (not a part in Excerpts/), then MusicXML.
  const inside = entries.filter((e) => !e.name.startsWith('META-INF/') && !e.name.startsWith('Excerpts/'))
  const score = entries.find((e) => e.name === path) ?? inside.find((e) => /\.mscx$/i.test(e.name)) ?? inside.find((e) => /\.(musicxml|xml)$/i.test(e.name))
  if (!score) throw new MxlError('No score in this file')
  return decodeText(await read(bytes, score))
}
