// PROMOTED to src/shared/share.js when Radar-B became the second app to need the
// OS share sheet with a clipboard fallback. Re-exported here so this app's import
// paths — and share.test.js, which is what proves the move preserved behaviour —
// are unchanged.
export { canShare, shareText, shareNative } from '../shared/share.js'
