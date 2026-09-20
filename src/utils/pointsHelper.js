import { doc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../firebase';

// Monday of the current week, as YYYY-MM-DD — changes once per week.
export const getWeekKey = (d = new Date()) => {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
};

// YYYY-MM — changes once per month.
export const getMonthKey = (d = new Date()) => new Date(d).toISOString().slice(0, 7);

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

// Awards points to a user's own doc. total_points/daily_points always
// accumulate; weekly_points/monthly_points reset to just this award when
// the stored weekKey/monthKey doesn't match the current one.
export const awardPoints = async (uid, points) => {
  const userRef = doc(db, 'users', uid);
  const weekKey = getWeekKey();
  const monthKey = getMonthKey();

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
