import { doc, runTransaction, increment, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { computeChestAward } from './chests';

// Monday of the current week, as YYYY-MM-DD — changes once per week. Uses the
// LOCAL calendar date (like getTodayDateKey below), not toISOString(), which
// converts to UTC and can silently roll the date to the next day for anyone
// west of UTC in the evening — that would make a student's weekKey mismatch
// the key computed elsewhere the same evening, wrongly zeroing their weekly
// total on the leaderboard.
export const getWeekKey = (d = new Date()) => {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  return date.toLocaleDateString('en-CA');
};

// YYYY-MM, from the local calendar date — see getWeekKey for why not toISOString().
export const getMonthKey = (d = new Date()) => new Date(d).toLocaleDateString('en-CA').slice(0, 7);

// Real calendar date (local, YYYY-MM-DD) — streaks track actual daily usage,
// not the course's scheduled "liveDia".
export const getTodayDateKey = (d = new Date()) => new Date(d).toLocaleDateString('en-CA');

// Given a user's existing profile data, returns the streak fields to merge
// in for an activity completed right now. A second activity the same day
// doesn't double-count; missing a day resets the streak back to 1.
export const bumpStreak = (data = {}) => {
  const today = getTodayDateKey();
  if (data.last_active_date === today) {
    return { streak_count: data.streak_count || 1, last_active_date: today };
  }
  const yesterday = getTodayDateKey(new Date(Date.now() - 86400000));
  const continuing = data.last_active_date === yesterday;
  return {
    streak_count: continuing ? (data.streak_count || 0) + 1 : 1,
    last_active_date: today,
  };
};

// Snapshots the top 3 scorers of a just-ended week/month into
// leaderboard_history, the first time anyone in that course earns points in
// the following period (see awardPoints below) — otherwise that period's
// standings are lost the moment weekly_points/monthly_points reset. Reads
// straight from users (same equality-only query LeaderboardCard uses, so no
// composite index is needed) rather than orderBy, sorting client-side.
// Idempotent: setDoc on an id keyed by period+key+course, skipped entirely
// if that id already exists, so a second student rolling into the new
// period moments later is a no-op.
//
// `selfEntry` is the triggering student's OWN final score for the outgoing
// period, captured from inside awardPoints' transaction before it moved
// their doc onto the new period — by the time this query below runs, their
// own doc no longer has the old weekKey/monthKey, so the query alone would
// silently miss them (they're the one guaranteed candidate for this
// period's top scores, since they're the one who just triggered it).
const archivePeriodIfNeeded = async (period, key, course, selfEntry) => {
  const historyRef = doc(db, 'leaderboard_history', `${period}-${key}-${course}`);
  const existing = await getDoc(historyRef);
  if (existing.exists()) return;

  const pointsField = period === 'weekly' ? 'weekly_points' : 'monthly_points';
  const keyField = period === 'weekly' ? 'weekKey' : 'monthKey';
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'student'),
    where('course', '==', course),
    where(keyField, '==', key)
  );
  const snap = await getDocs(q);
  const fromQuery = snap.docs
    .filter((d) => !d.data().independent && d.id !== selfEntry?.uid)
    .map((d) => {
      const s = d.data();
      const lastInitial = s.lastName ? `${s.lastName.trim().charAt(0).toUpperCase()}.` : '';
      const name = [s.firstName, lastInitial].filter(Boolean).join(' ') || s.email || 'Estudiante';
      return { uid: d.id, name, points: s[pointsField] || 0 };
    });

  const candidates = selfEntry ? [...fromQuery, { uid: selfEntry.uid, name: selfEntry.name, points: selfEntry.points }] : fromQuery;
  const top = candidates
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  if (top.length === 0) return;

  await setDoc(historyRef, { period, key, course, top, createdAt: new Date().toISOString() });
};

// Monday–Sunday label for a weekKey, e.g. "22 sep – 28 sep".
export const formatWeekLabel = (weekKey) => {
  const monday = new Date(`${weekKey}T00:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
};

// Capitalized month + year label for a monthKey, e.g. "Septiembre 2026".
export const formatMonthLabel = (monthKey) => {
  const label = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Awards points to a user's own doc. total_points always accumulates;
// weekly_points/monthly_points/daily_points all reset to just this award
// when their stored weekKey/monthKey/dayKey doesn't match the current one.
//
// `daily_points` used to just accumulate forever like total_points, despite
// being shown to students as "📅 Hoy" (today) in StudentLearningPath.jsx —
// the dayKey gate below is the fix, mirroring the exact weekKey/monthKey
// pattern already used for the other two periods. Fixed here and in the 2
// other inline writers (CalentamientoEngine.jsx, CuriosidadQuizEngine.jsx,
// StudentLearningPath.jsx's own direct-write path) — see chests.js for why
// a 4th writer (the chest system) deliberately does NOT read/write this
// field at all, instead keeping its own always-correct chestPoints/
// chestDayKey pair.
//
// `options.countsTowardChest` (default true) — pass false when the points
// being awarded ARE a chest's own payout (MisCofresPage.jsx's handleOpen).
// Without this, opening a chest worth e.g. 250 points would immediately
// re-run computeChestAward with those same 250 points, which could grant
// 2 more chests on the spot (with 50 points left over carrying toward a
// 3rd) — a student could cascade into an open-ended chain of chests just
// from opening one. Setting it false still lets the payout count toward
// total/weekly/monthly/daily points and the leaderboard, it just never
// feeds the chestPoints/chestDayKey counter, so "100 points of schoolwork
// = 1 chest" stays literally true and chest-opening can't earn more chests.
//
// This is one of the most frequently-called functions in the app (every
// point-earning action, across every activity type, for every student), so
// it deliberately does exactly ONE Firestore read per call — reusing the
// transaction's own tx.get(userRef) to ALSO detect a period rollover,
// rather than a separate getDoc up front. The archive write for an
// outgoing period (see archivePeriodIfNeeded) happens after the
// transaction commits, using the rollover info captured during it — it
// doesn't need to be atomic with the point award itself.
export const awardPoints = async (uid, points, options = {}) => {
  const { countsTowardChest = true } = options;
  const userRef = doc(db, 'users', uid);
  const weekKey = getWeekKey();
  const monthKey = getMonthKey();
  const dayKey = getTodayDateKey();

  let rollover = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.exists() ? snap.data() : {};

    // Admins testing content shouldn't rack up scores meant for students.
    if (data.role === 'admin') return;

    if (data.course) {
      const lastInitial = data.lastName ? `${data.lastName.trim().charAt(0).toUpperCase()}.` : '';
      const name = [data.firstName, lastInitial].filter(Boolean).join(' ') || data.email || 'Estudiante';
      rollover = {
        course: data.course,
        weekly: data.weekKey && data.weekKey !== weekKey
          ? { uid, name, key: data.weekKey, points: data.weekly_points || 0 }
          : null,
        monthly: data.monthKey && data.monthKey !== monthKey
          ? { uid, name, key: data.monthKey, points: data.monthly_points || 0 }
          : null,
      };
    }

    const weeklyPoints = data.weekKey === weekKey ? (data.weekly_points || 0) + points : points;
    const monthlyPoints = data.monthKey === monthKey ? (data.monthly_points || 0) + points : points;
    const dailyPoints = data.dayKey === dayKey ? (data.daily_points || 0) + points : points;
    const streakFields = bumpStreak(data);
    const chestFields = await computeChestAward(data, countsTowardChest ? points : 0, streakFields.streak_count);

    tx.set(userRef, {
      total_points: increment(points),
      current_path_points: increment(points),
      daily_points: dailyPoints,
      weekly_points: weeklyPoints,
      monthly_points: monthlyPoints,
      weekKey,
      monthKey,
      dayKey,
      ...streakFields,
      ...chestFields,
    }, { merge: true });
  });

  if (rollover?.weekly) await archivePeriodIfNeeded('weekly', rollover.weekly.key, rollover.course, rollover.weekly);
  if (rollover?.monthly) await archivePeriodIfNeeded('monthly', rollover.monthly.key, rollover.course, rollover.monthly);
};
