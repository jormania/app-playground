import QRCode from 'qrcode'

// Same hardcoded production domain as cabinet.webmanifest's
// related_applications and src/cabinet/lib/installState.js's PROD_ORIGIN —
// a QR code is meant to be scanned by a phone camera, which has no notion of
// "localhost", so the encoded URL always points at the deployed site even
// when this renders in dev.
const PROD_ORIGIN = 'https://coneofcold.vercel.app'

// Builds the absolute URL a QR code for `file` (an app's registry filename,
// e.g. "touch-grass-react.html") should encode.
export function appQrUrl(file: string): string {
  return new URL(`/${file}`, PROD_ORIGIN).href
}

// Renders a QR code for `file` into `canvas`, in place. Error-correction
// level 'M' (the library's default, ~15% recovery) is enough headroom for a
// short URL without inflating the module count/blowing up the printed size;
// 'H' is overkill here since nothing sits on top of the code. Kept a plain
// wrapper — the caller decides when to render (see index.html and
// AppTile.jsx, both of which render lazily, only once their dialog opens).
export async function renderAppQr(canvas: HTMLCanvasElement | null, file: string): Promise<void> {
  // Handed a null/absent element, qrcode does NOT fail — it quietly falls back
  // to document.createElement('canvas') and draws into that detached node, so
  // the dialog on screen stays an empty square and nothing reaches the console.
  // That silent mode cost a real debugging session (Cabinet's tile dialog, see
  // AppTile.jsx), so refuse it loudly instead.
  if (!canvas) throw new Error(`renderAppQr("${file}"): no canvas element`)
  await QRCode.toCanvas(canvas, appQrUrl(file), {
    errorCorrectionLevel: 'M',
    width: 240,
    margin: 1,
  })
}
