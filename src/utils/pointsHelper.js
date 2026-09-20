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
    }, { merge: true });
  });
};
