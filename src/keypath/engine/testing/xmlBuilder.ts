// Tiny MusicXML scores for tests, written by hand the way MuseScore writes
// them (partwise, <divisions> per quarter, <backup> between staves). No
// music files in the repo: every score here is a few made-up notes.

export const DIVISIONS = 4

export interface XNote {
  /** 'C4', 'F#4', 'Bb3'; null for a rest. */
  pitch: string | null
  /** In quarter notes. */
  beats: number
  staff?: number
  voice?: number
  chord?: boolean
  tie?: 'start' | 'stop' | 'both'
  finger?: number
  grace?: boolean
  cue?: boolean
}

export function note(n: XNote): string {
  const pitch =
    n.pitch === null
      ? '<rest/>'
      : (() => {
          const m = n.pitch.match(/^([A-G])(#|b)?(-?\d)$/)!
          const alter = m[2] === '#' ? '<alter>1</alter>' : m[2] === 'b' ? '<alter>-1</alter>' : ''
          return `<pitch><step>${m[1]}</step>${alter}<octave>${m[3]}</octave></pitch>`
        })()
  const ties = n.tie === 'both' ? '<tie type="stop"/><tie type="start"/>' : n.tie ? `<tie type="${n.tie}"/>` : ''
  const finger = n.finger ? `<notations><technical><fingering>${n.finger}</fingering></technical></notations>` : ''
  const duration = n.grace ? '' : `<duration>${Math.round(n.beats * DIVISIONS)}</duration>`
  return `<note>${n.grace ? '<grace/>' : ''}${n.cue ? '<cue/>' : ''}${n.chord ? '<chord/>' : ''}${pitch}${duration}${ties}<voice>${n.voice ?? 1}</voice><staff>${n.staff ?? 1}</staff>${finger}</note>`
}

export const backup = (beats: number) => `<backup><duration>${Math.round(beats * DIVISIONS)}</duration></backup>`
export const tempo = (bpm: number) => `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`
export const attributes = (o: { beats?: number; beatType?: number; staves?: number; transpose?: number } = {}) =>
  `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>${o.beats ?? 4}</beats><beat-type>${o.beatType ?? 4}</beat-type></time>${o.staves ? `<staves>${o.staves}</staves>` : ''}${o.transpose ? `<transpose><chromatic>${o.transpose}</chromatic></transpose>` : ''}</attributes>`
export const repeatStart = '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>'
export const repeatEnd = (times?: number) => `<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"${times ? ` times="${times}"` : ''}/></barline>`
export const endingStart = (numbers: string) => `<barline location="left"><ending number="${numbers}" type="start"/></barline>`
export const endingStop = (numbers: string, type: 'stop' | 'discontinue' = 'stop') => `<barline location="right"><ending number="${numbers}" type="${type}"/></barline>`

export const measure = (number: string | number, body: string, implicit = false) => `<measure number="${number}"${implicit ? ' implicit="yes"' : ''}>${body}</measure>`

export function score(o: { title?: string; parts: { name: string; measures: string[] }[] }): string {
  const list = o.parts.map((p, i) => `<score-part id="P${i + 1}"><part-name>${p.name}</part-name></score-part>`).join('')
  const parts = o.parts.map((p, i) => `<part id="P${i + 1}">${p.measures.join('')}</part>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">${o.title ? `<work><work-title>${o.title}</work-title></work>` : ''}<part-list>${list}</part-list>${parts}</score-partwise>`
}

/** A two-staff piano bar: the right hand's notes, then back to the start for the left's. */
export const pianoBar = (right: XNote[], left: XNote[], beats = 4) => right.map(note).join('') + backup(beats) + left.map((n) => note({ ...n, staff: 2 })).join('')

/** A zip holding these files, stored or deflated, the way an .mxl is built. */
export async function zip(files: { name: string; text: string; deflate?: boolean }[]): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const raw = enc.encode(f.text)
    const data = f.deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw
    const name = enc.encode(f.name)
    const local = new Uint8Array(30 + name.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, f.deflate ? 8 : 0, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, f.deflate ? 8 : 0, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const cdSize = centrals.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  const out = new Uint8Array(offset + cdSize + 22)
  let at = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at)
    at += part.length
  }
  return out
}

export const CONTAINER = (path: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="${path}" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>`
