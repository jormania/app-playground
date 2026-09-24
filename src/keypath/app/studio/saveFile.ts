// Getting a file off the phone. The share sheet when the browser will pass
// the file on; otherwise a download. Chrome's Web Share takes only a fixed
// list of file types (share_service_impl.cc) and MIDI isn't on it, so on
// Android a take's .mid lands in Downloads, from where any app can open it.

export type SaveOutcome = 'shared' | 'cancelled' | 'saved' | 'error'

type ShareNav = Pick<Navigator, 'share' | 'canShare'> | undefined

export async function saveFile(file: File, title: string, nav: ShareNav = typeof navigator === 'undefined' ? undefined : navigator, doc: Document = document): Promise<SaveOutcome> {
  if (typeof nav?.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
      // Anything else: fall through to a download, which still gets it off the phone.
    }
  }
  try {
    const url = URL.createObjectURL(file)
    const a = doc.createElement('a')
    a.href = url
    a.download = file.name
    a.rel = 'noopener'
    doc.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return 'saved'
  } catch {
    return 'error'
  }
}
