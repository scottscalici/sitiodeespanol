import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map(); // collectionName -> { data, fetchedAt }
const inFlight = new Map(); // collectionName -> Promise<data>, while a fetch is still running

// Fetches an entire collection, reusing an in-memory result from earlier in
// this browser tab's session instead of re-reading it from Firestore every
// time a component mounts. Several admin tools independently read the same
// collections (verbs, vocab_bundles, learning_paths, etc.) — sharing one
// module-level cache means whichever tool loads a collection first pays the
// read cost that session, and every other tool reusing this helper gets it
// for free until the cache expires or is invalidated.
//
// Concurrent callers for the same collection (e.g. two Dashboard cards
// mounting on the same page load) share the SAME in-flight promise rather
// than each starting its own read — without this, both would see an empty
// cache and both fetch, since only a *completed* result was ever cached.
//
// Pass { force: true } to bypass the cache (e.g. a manual refresh button),
// or { ttlMs } to override how long a cached result stays fresh.
export const getCachedCollection = async (collectionName, opts = {}) =>
  getCachedQuery(collectionName, () => getDocs(collection(db, collectionName)), opts);

// Same cache/in-flight-dedup machinery as getCachedCollection, but for a
// SCOPED query (e.g. only this course's students) instead of a full
// collection scan — use this for any collection that grows across courses
// or school years, so one student's session only pays for their own
// course's docs, not every course a teacher has ever taught. `cacheKey`
// must be unique per distinct query (e.g. `users:course:${course}`).
export const getCachedQuery = async (cacheKey, runQuery, { force = false, ttlMs = DEFAULT_TTL_MS } = {}) => {
  const cached = cache.get(cacheKey);
  const isFresh = cached && (Date.now() - cached.fetchedAt < ttlMs);

  if (!force && isFresh) return cached.data;
  if (!force && inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const promise = (async () => {
    try {
      const snap = await runQuery();
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  if (!force) inFlight.set(cacheKey, promise);
  return promise;
};

// Call this right after writing to a collection this cache holds (create,
// update, delete) so the next read — in this tool or any other sharing the
// cache — picks up the change instead of serving a stale snapshot.
export const invalidateCollectionCache = (collectionName) => {
  cache.delete(collectionName);
};

// Same cache/in-flight machinery as getCachedCollection, but for ONE
// document instead of a whole collection — for a collection that's been
// split into a handful of bucket documents (see getBucketId below), this
// is how a caller looks up just the ONE bucket it needs (e.g. a single
// verb's conjugation data) without pulling every bucket in. Returns null
// if the doc doesn't exist.
export const getCachedDoc = async (collectionName, docId, { force = false, ttlMs = DEFAULT_TTL_MS } = {}) => {
  const cacheKey = `doc:${collectionName}/${docId}`;
  const cached = cache.get(cacheKey);
  const isFresh = cached && (Date.now() - cached.fetchedAt < ttlMs);

  if (!force && isFresh) return cached.data;
  if (!force && inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const promise = (async () => {
    try {
      const snap = await getDoc(doc(db, collectionName, docId));
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      cache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  if (!force) inFlight.set(cacheKey, promise);
  return promise;
};

export const invalidateDocCache = (collectionName, docId) => {
  cache.delete(`doc:${collectionName}/${docId}`);
};

// Deterministic bucket assignment for splitting a collection that was one
// document per item (e.g. one per verb) into a small, fixed number of
// documents instead — a pure function of the item's own (immutable, set
// once at creation) ID, so a caller can always compute where an item lives
// without needing a separate lookup index, and an item never needs to
// "move" between buckets since its ID never changes after creation.
export const getBucketId = (itemId, numBuckets = 64) => {
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) {
    hash = (hash * 31 + itemId.charCodeAt(i)) >>> 0;
  }
  return `bucket_${hash % numBuckets}`;
};

// Reads a bucketed collection (see getBucketId) back into the same flat
// [{id, ...data}] shape callers used before bucketing — tolerant of a
// PARTIALLY migrated collection, where some docs are already bucket
// documents (an `items` map) and others are still one-doc-per-item, so
// this works correctly before, during, and after a migration has run.
//
// An item can genuinely exist in BOTH places at once during that partial
// window — e.g. an editor that always writes through the bucket "promotes"
// an item into its bucket the moment someone edits and saves it, even
// though its stale legacy twin doc hasn't been deleted by the migration
// yet. Bucket docs are processed first and win on id collision, since a
// bucket entry is always at least as recent as a legacy one.
export const getCachedBucketedCollection = async (collectionName, opts) => {
  const docs = await getCachedCollection(collectionName, opts);
  const byId = new Map();
  const legacyDocs = [];
  docs.forEach((d) => {
    if (d.items && typeof d.items === 'object') {
      Object.entries(d.items).forEach(([id, data]) => byId.set(id, { id, ...data }));
    } else {
      legacyDocs.push(d);
    }
  });
  legacyDocs.forEach((d) => {
    if (byId.has(d.id)) return;
    const { id, ...rest } = d;
    byId.set(id, { id, ...rest });
  });
  return [...byId.values()];
};

// Looks up ONE item in a bucketed collection by its own ID — reads only
// the one bucket doc it deterministically lives in (cached, so repeated
// lookups landing in the same bucket within a session cost one real read
// total), falling back to a legacy one-doc-per-item read for an item not
// yet migrated into a bucket. Returns null if the item doesn't exist
// anywhere. Use this instead of getCachedBucketedCollection whenever a
// caller only needs one specific item, not the whole collection.
export const getCachedBucketedItem = async (collectionName, itemId) => {
  const bucketDoc = await getCachedDoc(collectionName, getBucketId(itemId));
  if (bucketDoc?.items?.[itemId]) return bucketDoc.items[itemId];
  const legacy = await getCachedDoc(collectionName, itemId);
  if (!legacy) return null;
  const { id, ...data } = legacy; // strip the wrapper id, matching the bucket branch's plain data shape
  return data;
};
