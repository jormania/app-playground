// A persistent reminder shown while you're out on a walk, so you don't forget
// to return and turn the card over. Tapping it (handled in sw.js) reopens the
// app and asks it to return straight to the result.

const TAG = 'tg-walk'

const NOTES = [
  'Your card lies face-down. Tap here when you return, and it will turn.',
  'A find gathers in your absence — tap here the moment you are back.',
  'The reading is held, suspended. Tap when you return to let it settle.',
  'Something is taking shape while you walk. Tap here on your way in.',
  'The threshold stays open behind you. Tap here when you are back.',
  'The oracle is mid-breath, waiting on you. Tap here on your return.',
]

function pick(a) {
  return a[Math.floor(Math.random() * a.length)]
}

// raise the reminder (asks for notification permission if not yet decided)
export async function showWalkNotice() {
  if (typeof Notification === 'undefined' || !navigator.serviceWorker) return
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission() } catch (_) {}
  }
  if (Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification('Touch Grass', {
      body: pick(NOTES),
      tag: TAG,            // one reminder at a time; a new walk replaces the old
      requireInteraction: true, // don't let it auto-dismiss — it's a standing reminder
      silent: true,        // it lingers in the shade; no buzz right after you set out
      badge: '/icon-192.png', // status-bar glyph only; the OS draws the app icon itself
    })
  } catch (_) {}
}

// take the reminder down (on return, or whenever we're no longer out)
export async function clearWalkNotice() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  try {
    const reg = await navigator.serviceWorker.ready
    const ns = await reg.getNotifications({ tag: TAG })
    ns.forEach(n => n.close())
  } catch (_) {}
}
