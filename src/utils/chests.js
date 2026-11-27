// Daily-points-driven chest awards. Every full 100 points a student earns
// on a single calendar day grants one chest (so a 350-point day earns 3,
// not 1) — each chest's tier is rolled at the moment it's earned, not when
// it's opened.
//
// Deliberately NOT built on `daily_points` (shown to students as "📅 Hoy" in
// StudentLearningPath.jsx) even though that field also resets daily now —
// it did NOT when this was first written (every writer just accumulated it
// forever, same as total_points; fixed afterward, see pointsHelper.js's own
// comment on awardPoints). Keeping a separate chestPoints/chestDayKey pair
// means the chest threshold stays decoupled from a field whose job is
// purely display — if daily_points' reset logic or purpose ever changes
// again, chests aren't along for the ride.
import { arrayUnion } from 'firebase/firestore';
import { getCachedDoc } from './firestoreCache';

// Duplicated from pointsHelper.js's own getTodayDateKey (not imported, to
// avoid a circular import — pointsHelper.js itself calls into this file).
// Same local-calendar-date logic, see pointsHelper.js for why not toISOString().
const getTodayDateKey = (d = new Date()) => new Date(d).toLocaleDateString('en-CA');

export const CHEST_POINTS_THRESHOLD = 100;

// Falls back to this if `config/chests` is missing entirely (not yet
// configured, or someone deleted it) — same "still works, just at a
// sensible default" posture as ThemeUnlockToggle's DEFAULT_CALMA_UNLOCK_POINTS.
// Order matters: rolled rarest-first (see rollChestTier below), so this
// array is sorted epic → rare → common. The LAST tier is the guaranteed
// fallback and doesn't need `ratePerStreakDay`/`cap` — it's just whatever's
// left once nothing rarer hit.
export const DEFAULT_CHEST_CONFIG = {
  tiers: [
    { id: 'epic', label: 'Épico', ratePerStreakDay: 0.001, cap: 0.1, points: 250 },
    { id: 'rare', label: 'Rara', ratePerStreakDay: 0.01, cap: 0.5, points: 75 },
    { id: 'common', label: 'Común', points: 25 },
  ],
  dupeMultiplier: 2,
};

// Admin-editable via UnlockablesManager.jsx's "Configuración de Cofres"
// section — a teacher can add/remove/reorder tiers (e.g. a future
// "legendary") with zero code changes, since every reader of this config
// (chest rolling here, the accessory-rarity dropdown, MisCofresPage's
// reveal UI) treats the tier list as fully dynamic, not a fixed enum.
export async function getChestConfig() {
  const stored = await getCachedDoc('config', 'chests');
  if (!stored?.tiers?.length) return DEFAULT_CHEST_CONFIG;
  return { tiers: stored.tiers, dupeMultiplier: stored.dupeMultiplier ?? DEFAULT_CHEST_CONFIG.dupeMultiplier };
}

// Cascades through `tiers` rarest-first: each tier's chance is
// `min(cap, streak × ratePerStreakDay)`, independently rolled (not a single
// cumulative draw) — the first one that hits wins. The LAST tier in the
// array is the guaranteed fallback if nothing rarer hit, so it's returned
// even with no chance fields of its own (a tier list of length 1 always
// just returns that one tier).
export function rollChestTier(tiers, streakCount) {
  const streak = Math.max(0, streakCount || 0);
  for (let i = 0; i < tiers.length - 1; i++) {
    const tier = tiers[i];
    const chance = Math.min(tier.cap ?? 1, streak * (tier.ratePerStreakDay || 0));
    if (Math.random() < chance) return tier.id;
  }
  return tiers[tiers.length - 1].id;
}

// `existingData` is the user doc as read just before this save (same `data`
// every one of this helper's 4 call sites already has in scope for
// weekKey/monthKey/bumpStreak). `pointsEarned` is the points this single
// save is awarding. `streakCount` should be the ALREADY-BUMPED streak (i.e.
// `bumpStreak(existingData).streak_count`), so a chest earned on the save
// that extends a streak rolls its odds against the new streak length, not
// the stale one. Returns an object meant to be spread/merged into the same
// payload every caller already builds for weekly/monthly/daily points —
// `pendingChests` is only present at all when at least one new chest was
// actually earned, since `arrayUnion()` with zero items isn't valid.
//
// Async (reads `config/chests`, cached) — every one of the 4 call sites is
// already inside an async function, so this just needs an `await` added at
// each one.
export async function computeChestAward(existingData = {}, pointsEarned, streakCount) {
  const today = getTodayDateKey();
  const priorToday = existingData.chestDayKey === today ? (existingData.chestPoints || 0) : 0;
  const newToday = priorToday + Math.max(0, pointsEarned || 0);

  const chestsBefore = Math.floor(priorToday / CHEST_POINTS_THRESHOLD);
  const chestsAfter = Math.floor(newToday / CHEST_POINTS_THRESHOLD);
  const chestsToGrant = chestsAfter - chestsBefore;

  const fields = { chestPoints: newToday, chestDayKey: today };
  if (chestsToGrant > 0) {
    const { tiers } = await getChestConfig();
    const newChests = Array.from({ length: chestsToGrant }, (_, i) => ({
      id: `chest_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      rarity: rollChestTier(tiers, streakCount),
      earnedAt: new Date().toISOString(),
    }));
    fields.pendingChests = arrayUnion(...newChests);
  }
  return fields;
}

// Pulled out to a plain top-level function (same pattern as
// ConectoresEngine.jsx's `shuffle`) rather than inlining `Math.random()`
// inside a component's event handler — the newer eslint-react-hooks
// "purity" rule flags a bare Math.random() call lexically inside a
// component function body, even one that's actually only ever reached from
// an onClick handler, not render itself.
export function pickRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}
