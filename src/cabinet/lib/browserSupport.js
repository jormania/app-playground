// Only Chrome for Android reliably supports installing a PWA today — Edge for
// Android (and most other Android browsers) only ever offer a plain bookmark
// shortcut, no real install. Desktop and iOS aren't covered by this check:
// desktop browsers that matter here (Chrome, Edge) both support install, and
// iOS's "Add to Home Screen" isn't gated by which browser you're in the same
// way, so there's nothing useful to redirect there.
const ANDROID_UA = /Android/
const CHROME_UA = /Chrome\//
const EDGE_ANDROID_UA = /EdgA\//
const SAMSUNG_UA = /SamsungBrowser\//

export function canInstallPwaHere() {
  if (typeof navigator === 'undefined') return true
  const ua = navigator.userAgent
  if (!ANDROID_UA.test(ua)) return true
  return (CHROME_UA.test(ua) || SAMSUNG_UA.test(ua)) && !EDGE_ANDROID_UA.test(ua)
}

// Rewrites an absolute https URL into an Android "open in Chrome" intent URL,
// so tapping Install lands in a browser that can actually install it instead
// of whatever the phone's default browser happens to be.
export function chromeIntentUrl(absoluteUrl) {
  const withoutScheme = absoluteUrl.replace(/^https?:\/\//, '')
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end;`
}
