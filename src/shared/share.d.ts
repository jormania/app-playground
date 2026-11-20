// Types for share.js, so the strict-TS apps can use it (same pattern as models.d.ts).
export interface ShareEntry {
  name?: string
  description?: string
  place?: string
  placeUrl?: string
  link?: string
}
export interface ShareResult { ok: boolean; shared?: boolean; copied?: boolean; cancelled?: boolean }
export function canShare(): boolean
export function shareText(entry: ShareEntry): string
export function shareNative(entry: ShareEntry, appName?: string): Promise<ShareResult>
