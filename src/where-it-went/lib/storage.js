/**
 * WhereItWent's safe-storage helpers. The implementation was promoted to
 * src/shared/storage.ts once a second app needed it (see that file's header);
 * this stays as the import path the app's modules already use, so nothing here
 * changed behaviourally.
 */
export {
  readJson,
  writeJson,
  removeJson,
  readSessionJson,
  writeSessionJson,
  removeSessionJson,
} from '../../shared/storage.ts';
