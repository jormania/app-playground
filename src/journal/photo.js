// Client-side photo prep, browser-only (canvas). One delight, at most one picture:
// we downscale before it ever reaches Notion — phone photos run several MB, and at
// hundreds of entries that adds up in both upload time and later load time. The
// feeling is what matters here, not resolution, so a bit of JPEG softness is fine.
//
// The decode-and-downscale half came from here originally and now lives in
// src/shared/photo.ts; re-exported rather than kept in duplicate (R-005). The
// shared resizePhoto takes an options argument Journal never passes, and its
// defaults are this file's old MAX_EDGE and JPEG_QUALITY unchanged.
export { isImageFile, resizePhoto } from '../shared/photo.ts'

// A stable filename Notion can show in its own UI, independent of what the phone
// or computer originally called the file.
//
// This one stays local and must NOT be folded into src/shared/photo.ts, despite
// sharing its name: it takes a **date key** and prefixes `delight-`, where the
// shared version slugifies an arbitrary **name**. Swapping them would silently
// rename every photo Journal uploads from `delight-2026-09-22.jpg` to
// `2026-09-22.jpg` — a behaviour change in the Notion file list, not a refactor.
// Pinned by photo.test.js.
export function photoFilename(dateKey) {
  return `delight-${dateKey || 'photo'}.jpg`
}
