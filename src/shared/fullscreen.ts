// Full screen for an app running in a browser tab or a home-screen shortcut.
//
// The screen space is what an installed PWA gives: no Chrome toolbar, no Android
// button bar. Two apps can't be installed properly on the owner's phone: Chrome there
// installs KeyPath and Radar-B without reading their manifests, scoped to the whole
// origin, so they intercept every other app's launch (CABINET.md, "Update
// (2026-09-24)"). They run from a Chrome shortcut instead, and this gets the space
// back. A page may only enter full screen from a user gesture, so it happens on the
// first tap, and again on the next tap whenever something has taken it out:
// switching apps, or the back gesture, which in Chrome leaves full screen before it
// navigates.
//
// It does nothing when the app is already installed and standalone, on a pointer
// that isn't touch (a desktop has the room and Escape would fight it), or where
// the Fullscreen API is missing (iPhone Safari only has it for video).

type FullscreenDoc = Pick<Document, 'addEventListener' | 'removeEventListener' | 'fullscreenElement' | 'fullscreenEnabled'> & {
  documentElement: Pick<HTMLElement, 'requestFullscreen'>
}

export interface FullscreenEnv {
  doc: FullscreenDoc
  matchMedia: (query: string) => { matches: boolean }
}

const defaultEnv = (): FullscreenEnv | null =>
  typeof document === 'undefined' || typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? null
    : { doc: document, matchMedia: (q) => window.matchMedia(q) }

/** True where the first-tap full screen applies: a touch device, a browser tab or shortcut, and the API present. */
export function wantsFullscreen(env: FullscreenEnv): boolean {
  if (!env.doc.fullscreenEnabled || typeof env.doc.documentElement.requestFullscreen !== 'function') return false
  if (!env.matchMedia('(pointer: coarse)').matches) return false
  // An installed app already has the screen. minimal-ui is left in on purpose:
  // it is exactly what Chrome's manifest-less installs run as, toolbar included.
  return !env.matchMedia('(display-mode: standalone)').matches && !env.matchMedia('(display-mode: fullscreen)').matches
}

/** Enter full screen on each tap that finds the page out of it. Returns a function that stops listening. */
export function fullscreenOnTap(env: FullscreenEnv | null = defaultEnv()): () => void {
  if (!env || !wantsFullscreen(env)) return () => {}
  const { doc } = env
  const onTap = () => {
    if (doc.fullscreenElement) return
    doc.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
  }
  // Capture, so a handler that stops propagation can't swallow the tap first.
  doc.addEventListener('click', onTap, true)
  return () => doc.removeEventListener('click', onTap, true)
}
