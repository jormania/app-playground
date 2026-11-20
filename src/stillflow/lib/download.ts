/** Saves text as a file through a temporary object URL. Works in an installed Android PWA too. */
export function downloadText(fileName: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function stamp(d = new Date()) {
  return d.toISOString().slice(0, 10)
}
