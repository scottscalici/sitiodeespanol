// Daily-points-driven chest awards. Every full 100 points a student earns
// on a single calendar day grants one chest (so a 350-point day earns 3,
// not 1) — each chest's rarity is rolled at the moment it's earned, not
// when it's opened. Rare chance is `streak_count × 1%`, capped at 50% so
// even a very long streak still has a real chance of common chests.
//
// Deliberately NOT built on the existing `daily_points` field — that field
// has never actually reset daily anywhere in this codebase (every writer
// just accumulates it forever, same as total_points; see every call site
// below), so reusing it here would mean a long-tenured student instantly
// "crosses" hundreds of 100-point thresholds the moment this ships. A
// separate `chestPoints`/`chestDayKey` pair, reset correctly from day one,
// avoids inheriting that bug rather than silently fixing daily_points
// (which nobody asked for and which several engines read as a lifetime
// "Hoy" stat today, however misleadingly).
import { arrayUnion } from 'firebase/firestore';

// Duplicated from pointsHelper.js's own getTodayDateKey (not imported, to
// avoid a circular import — pointsHelper.js itself calls into this file).
// Same local-calendar-date logic, see pointsHelper.js for why not toISOString().
const getTodayDateKey = (d = new Date()) => new Date(d).toLocaleDateString('en-CA');

export const CHEST_POINTS_THRESHOLD = 100;
export const RARE_CHANCE_PER_STREAK_DAY = 0.01;
export const RARE_CHANCE_CAP = 0.5;

export function rollChestRarity(streakCount) {
  const rareChance = Math.min(RARE_CHANCE_CAP, Math.max(0, streakCount || 0) * RARE_CHANCE_PER_STREAK_DAY);
  return Math.random() < rareChance ? 'rare' : 'common';
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
export function computeChestAward(existingData = {}, pointsEarned, streakCount) {
  const today = getTodayDateKey();
  const priorToday = existingData.chestDayKey === today ? (existingData.chestPoints || 0) : 0;
  const newToday = priorToday + Math.max(0, pointsEarned || 0);

  const chestsBefore = Math.floor(priorToday / CHEST_POINTS_THRESHOLD);
  const chestsAfter = Math.floor(newToday / CHEST_POINTS_THRESHOLD);
  const chestsToGrant = chestsAfter - chestsBefore;

  const fields = { chestPoints: newToday, chestDayKey: today };
  if (chestsToGrant > 0) {
    const newChests = Array.from({ length: chestsToGrant }, (_, i) => ({
      id: `chest_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      rarity: rollChestRarity(streakCount),
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

// A dupe pull (the rolled accessory is already owned) converts to bonus
// points instead of nothing happening — rare dupes pay out more, so a rare
// pull always feels like the better outcome even on a repeat.
export const DUPE_BONUS_POINTS = { common: 50, rare: 150 };
