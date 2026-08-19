/**
 * SILVA.md: "Light and dark, syncing to the device." No manual toggle
 * exists (or was asked for) — this only ever mirrors the OS-level
 * `prefers-color-scheme`, setting the `data-theme` attribute DS's
 * tokens.css already reads (`:root[data-theme="dark"]`). Exported as a
 * plain function (not a hook) so it's trivial to unit test without
 * rendering a component.
 */
export function syncSystemTheme(doc: Document = document, win: Window = window): () => void {
  const media = win.matchMedia('(prefers-color-scheme: dark)')

  function apply(matches: boolean) {
    doc.documentElement.dataset.theme = matches ? 'dark' : 'light'
  }

  apply(media.matches)
  const listener = (e: MediaQueryListEvent) => apply(e.matches)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
