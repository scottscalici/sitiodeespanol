import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map(); // collectionName -> { data, fetchedAt }

// Fetches an entire collection, reusing an in-memory result from earlier in
// this browser tab's session instead of re-reading it from Firestore every
// time a component mounts. Several admin tools independently read the same
// collections (verbs, vocab_bundles, learning_paths, etc.) — sharing one
// module-level cache means whichever tool loads a collection first pays the
// read cost that session, and every other tool reusing this helper gets it
// for free until the cache expires or is invalidated.
//
// Pass { force: true } to bypass the cache (e.g. a manual refresh button),
// or { ttlMs } to override how long a cached result stays fresh.
export const getCachedCollection = async (collectionName, { force = false, ttlMs = DEFAULT_TTL_MS } = {}) => {
  const cached = cache.get(collectionName);
  const isFresh = cached && (Date.now() - cached.fetchedAt < ttlMs);

  if (!force && isFresh) return cached.data;

  const snap = await getDocs(collection(db, collectionName));
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  cache.set(collectionName, { data, fetchedAt: Date.now() });
  return data;
};

// Call this right after writing to a collection this cache holds (create,
// update, delete) so the next read — in this tool or any other sharing the
// cache — picks up the change instead of serving a stale snapshot.
export const invalidateCollectionCache = (collectionName) => {
  cache.delete(collectionName);
};
