import { doc, runTransaction, increment, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

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
const archivePeriodIfNeeded = async (period, key, course) => {
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
  const top = snap.docs
    .filter((d) => !d.data().independent)
    .map((d) => {
      const s = d.data();
      const lastInitial = s.lastName ? `${s.lastName.trim().charAt(0).toUpperCase()}.` : '';
      const name = [s.firstName, lastInitial].filter(Boolean).join(' ') || s.email || 'Estudiante';
      return { uid: d.id, name, points: s[pointsField] || 0 };
    })
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

// Awards points to a user's own doc. total_points/daily_points always
// accumulate; weekly_points/monthly_points reset to just this award when
// the stored weekKey/monthKey doesn't match the current one.
export const awardPoints = async (uid, points) => {
  const userRef = doc(db, 'users', uid);
  const weekKey = getWeekKey();
  const monthKey = getMonthKey();

  // Read once outside the transaction to detect a period rollover for this
  // student. If the calendar has moved into a new week/month since they
  // last earned points, archive the outgoing period's top 3 before the
  // transaction below overwrites weekly_points/monthly_points.
  const preSnap = await getDoc(userRef);
  const preData = preSnap.exists() ? preSnap.data() : {};
  if (preData.course && preData.role !== 'admin') {
    if (preData.weekKey && preData.weekKey !== weekKey) {
      await archivePeriodIfNeeded('weekly', preData.weekKey, preData.course);
    }
    if (preData.monthKey && preData.monthKey !== monthKey) {
      await archivePeriodIfNeeded('monthly', preData.monthKey, preData.course);
    }
  }

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.exists() ? snap.data() : {};

    // Admins testing content shouldn't rack up scores meant for students.
    if (data.role === 'admin') return;

    const weeklyPoints = data.weekKey === weekKey ? (data.weekly_points || 0) + points : points;
    const monthlyPoints = data.monthKey === monthKey ? (data.monthly_points || 0) + points : points;

    tx.set(userRef, {
      total_points: increment(points),
      current_path_points: increment(points),
      daily_points: increment(points),
      weekly_points: weeklyPoints,
      monthly_points: monthlyPoints,
      weekKey,
      monthKey,
      ...bumpStreak(data),
    }, { merge: true });
  });
};
