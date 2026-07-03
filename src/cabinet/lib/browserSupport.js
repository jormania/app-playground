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

export function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return ANDROID_UA.test(navigator.userAgent)
}

export function canInstallPwaHere() {
  if (!isAndroid()) return true
  const ua = navigator.userAgent
  return (CHROME_UA.test(ua) || SAMSUNG_UA.test(ua)) && !EDGE_ANDROID_UA.test(ua)
}

// Rewrites an absolute https URL into an Android "open in Chrome" intent URL,
// so tapping Install lands in a browser that can actually install it instead
// of whatever the phone's default browser happens to be.
export function chromeIntentUrl(absoluteUrl) {
  const withoutScheme = absoluteUrl.replace(/^https?:\/\//, '')
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end;`
}

// Rewrites an absolute https URL into a bare Android intent URL — same
// target, no `package=`. A plain <a> click that stays inside an
// already-open Chrome tab is ordinary in-page navigation and never asks
// Android "does an installed app own this URL?"; that OS-level resolution
// only runs on an external ACTION_VIEW intent, which is what this
// constructs instead. Every sub-app here shares one origin
// (coneofcold.vercel.app) with its own exact-file manifest scope
// (public/touch-grass.webmanifest etc.), so a same-origin <a> tap can't
// trigger Chrome's WebAPK hand-off on its own — this forces the same
// OS-level lookup a tap from *outside* the browser (a notification, another
// app) would get for free. If a WebAPK is installed for the URL, Android
// launches it in its own window; if not, S.browser_fallback_url reopens the
// same page in the browser exactly like a plain link would have. That
// makes it safe to use even when install status is unknown or false —
// see installState.js on why that detection can't be trusted either way.
export function pwaLaunchIntentUrl(absoluteUrl) {
  const withoutScheme = absoluteUrl.replace(/^https?:\/\//, '')
  const fallback = encodeURIComponent(absoluteUrl)
  return `intent://${withoutScheme}#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end;`
}
