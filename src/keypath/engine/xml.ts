// A small XML reader for MusicXML (engine/musicxml.ts). The engine runs where
// there is no DOM (tests, a worker), and a score needs only elements,
// attributes and text: no namespaces, no DTD. Comments, processing
// instructions and the DOCTYPE are skipped; CDATA is text.

export interface XmlElement {
  name: string
  attrs: Record<string, string>
  children: XmlElement[]
  /** The element's own text, entities decoded, whitespace kept. */
  text: string
}

export class XmlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XmlError'
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[e] ?? whole
  })
}

const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

/** The document's root element. Throws XmlError if it isn't well-formed enough to read. */
export function parseXml(src: string): XmlElement {
  const stack: XmlElement[] = []
  let root: XmlElement | null = null
  let i = 0
  const n = src.length
  const skipTo = (end: string) => {
    const at = src.indexOf(end, i)
    if (at < 0) throw new XmlError(`Unclosed ${end}`)
    i = at + end.length
  }
  while (i < n) {
    const lt = src.indexOf('<', i)
    const textEnd = lt < 0 ? n : lt
    if (textEnd > i && stack.length) stack[stack.length - 1].text += decodeEntities(src.slice(i, textEnd))
    if (lt < 0) break
    i = lt
    if (src.startsWith('<!--', i)) skipTo('-->')
    else if (src.startsWith('<?', i)) skipTo('?>')
    else if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i)
      if (end < 0) throw new XmlError('Unclosed CDATA')
      if (stack.length) stack[stack.length - 1].text += src.slice(i + 9, end)
      i = end + 3
    } else if (src.startsWith('<!', i)) {
      // A DOCTYPE, perhaps with an internal subset in brackets.
      let depth = 0
      for (i += 2; i < n; i++) {
        if (src[i] === '[') depth++
        else if (src[i] === ']') depth--
        else if (src[i] === '>' && depth <= 0) break
      }
      i++
    } else if (src[i + 1] === '/') {
      const end = src.indexOf('>', i)
      if (end < 0) throw new XmlError('Unclosed end tag')
      const name = src.slice(i + 2, end).trim()
      const open = stack.pop()
      if (!open || open.name !== name) throw new XmlError(`Unexpected </${name}>`)
      i = end + 1
    } else {
      // A start tag: find its end outside quoted attribute values.
      let j = i + 1
      let quote = ''
      for (; j < n; j++) {
        const c = src[j]
        if (quote) {
          if (c === quote) quote = ''
        } else if (c === '"' || c === "'") quote = c
        else if (c === '>') break
      }
      if (j >= n) throw new XmlError('Unclosed start tag')
      const selfClosing = src[j - 1] === '/'
      const body = src.slice(i + 1, selfClosing ? j - 1 : j)
      const nameEnd = body.search(/[\s/]|$/)
      const el: XmlElement = { name: body.slice(0, nameEnd), attrs: {}, children: [], text: '' }
      if (!el.name) throw new XmlError('A tag without a name')
      for (const m of body.slice(nameEnd).matchAll(ATTR)) el.attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? '')
      if (stack.length) stack[stack.length - 1].children.push(el)
      else if (root) throw new XmlError('More than one root element')
      else root = el
      if (!selfClosing) stack.push(el)
      i = j + 1
    }
  }
  if (!root) throw new XmlError('No root element')
  if (stack.length) throw new XmlError(`Unclosed <${stack[stack.length - 1].name}>`)
  return root
}

/** The first child of this name. */
export const child = (el: XmlElement | undefined, name: string): XmlElement | undefined => el?.children.find((c) => c.name === name)
/** Every child of this name. */
export const childrenOf = (el: XmlElement | undefined, name: string): XmlElement[] => el?.children.filter((c) => c.name === name) ?? []
/** The trimmed text of the first child of this name, or ''. */
export const textOf = (el: XmlElement | undefined, name: string): string => child(el, name)?.text.trim() ?? ''

/** Bytes as text: UTF-8 unless the file says UTF-16 with a byte-order mark. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '')
}
