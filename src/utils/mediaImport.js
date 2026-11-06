// Shared "resolve a local filename or a raw-GitHub URL to a final hosted
// URL" logic for any bulk importer that lets an admin reference images/audio
// by filename (matched against picked files) or by a source link instead of
// an already-final hosted URL. Originally built for the Curiosidades bulk
// uploader; factored out here so the Practice Cards uploader (and any future
// one, e.g. Reading Cards) shares the exact same behavior instead of
// re-implementing it.
import { isNonEmptyString } from './validateQuestion';

export const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

// A raw.githubusercontent.com link (e.g. into a teacher's own asset repo) is
// treated as a SOURCE to fetch and re-host, not an already-final URL — these
// links are known to break on some networks' content filters (see
// CuriosidadesManager's own per-item "Reimportar" tool, built for the same
// reason), so everything the app stores long-term goes through Firebase
// Storage instead.
export const isGithubRawUrl = (v) => typeof v === 'string' && /^https:\/\/raw\.githubusercontent\.com\//i.test(v);

// Only a local filename or a raw-GitHub source URL needs resolving (upload
// or fetch+reupload) — any other already-hosted URL (Firebase Storage, an
// old Schoology link, etc.) is left exactly as given.
export const needsResolution = (value) => isNonEmptyString(value) && (!isUrl(value) || isGithubRawUrl(value));

export const basenameFromUrl = (url, fallback) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop()) || fallback;
  } catch {
    return fallback;
  }
};

// A local filename (not a URL at all) must be in the picked-files/cropped-
// files map; a raw-GitHub URL doesn't need one, since it's fetched directly
// instead. `collectRefs` walks one item and returns {obj, key} pairs (see
// validateQuestion.js's collectQuestionImageRefs/collectQuestionAudioRefs
// for the shape), `itemLabel(item, idx)` formats that item's error prefix.
export const validateMediaRefs = (items, fileMap, collectRefs, mediaLabel, itemLabel) => {
  const errs = [];
  // Included in every mismatch error so a near-miss (wrong extension, a
  // phone renaming a photo on save, a typo) is visible without the admin
  // having to go dig through the file picker again.
  const providedNames = fileMap.size > 0 ? [...fileMap.keys()].join(', ') : '(ninguno)';
  items.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    collectRefs(item).forEach(({ obj, key }) => {
      const value = obj[key];
      if (needsResolution(value) && !isGithubRawUrl(value) && !fileMap.has(value)) {
        errs.push(
          `${itemLabel(item, idx)}: ${mediaLabel} "${value}" no fue proporcionado en los archivos seleccionados (archivos disponibles: ${providedNames}).`
        );
      }
    });
  });
  return errs;
};

// Resolves every ref's value to a final Storage URL in place — a local
// filename goes through uploadFn (matched against fileMap), a raw-GitHub
// source URL goes through importFn (fetched and re-hosted); anything else is
// already final and untouched. One pass across every item's refs so the same
// source file/URL referenced from several places only uploads once.
export const resolveMediaRefs = async (items, collectRefs, fileMap, folder, uploadFn, importFn, fallbackName) => {
  const allRefs = items.flatMap((item) => collectRefs(item));
  const urlMap = new Map();
  const neededValues = new Set(allRefs.map(({ obj, key }) => obj[key]).filter(needsResolution));
  for (const value of neededValues) {
    const url = isGithubRawUrl(value)
      ? await importFn(value, folder, basenameFromUrl(value, fallbackName))
      : await uploadFn(fileMap.get(value), folder);
    urlMap.set(value, url);
  }
  allRefs.forEach(({ obj, key }) => {
    if (needsResolution(obj[key])) obj[key] = urlMap.get(obj[key]);
  });
};
