// Wanderlist's photo prep. The implementation was promoted to src/shared/photo.ts
// once a third app needed it (see that file's header); this stays as the import
// path Wanderlist's components already use, so nothing here changed behaviourally.
export { isImageFile, resizePhoto, photoFilename } from '../shared/photo.ts'
