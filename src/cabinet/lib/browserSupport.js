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

// iOS has no install API at all — no beforeinstallprompt, no
// getInstalledRelatedApps, and no URL a link can point at to trigger one. The
// only route is Safari's own Share → Add to Home Screen, which the page can't
// open. So the Cabinet must not offer "Install" here: the tap would just open
// the page, which is what "Open" honestly promises. iPadOS reports itself as a
// Mac, hence the touch-point check — a real Mac has no touch points.
const IOS_UA = /iPad|iPhone|iPod/

export function isIos() {
  if (typeof navigator === 'undefined') return false
  if (IOS_UA.test(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1
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
// same page in the browser exactly like a plain link would have.
//
// Reserved for apps confirmed installed (see AppTile). Because this resolves
// at the OS level, Android offers every app that claims the URL — with two
// browsers on the phone that's an "Open with" sheet — so it's only worth
// paying when there's actually a WebAPK to win it. Even then Android asks,
// unless the WebAPK is a *verified* link handler: its intent filter sets
// android:autoVerify, which makes Android look for
// /.well-known/assetlinks.json naming the app's package and signing
// fingerprint. WebAPKs are minted and signed by Google's server, so those
// values aren't ours to publish and no file we host can verify them. The
// per-app "Open by default → Open supported links" toggle in Android
// Settings is the only fix, which is what the Cabinet's hint points at.
export function pwaLaunchIntentUrl(absoluteUrl) {
  const withoutScheme = absoluteUrl.replace(/^https?:\/\//, '')
  const fallback = encodeURIComponent(absoluteUrl)
  return `intent://${withoutScheme}#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end;`
}
