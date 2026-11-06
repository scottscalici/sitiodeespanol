import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// A student's section ("1B", "4A"...) names both their class period and
// which A/B cycle it meets on (the trailing letter — see Dashboard.jsx's
// userCiclo derivation). This config maps each exact section string to the
// clock window (24-hour "HH:MM", matching a native <input type="time">) a
// reassessment may be STARTED in — teacher-editable (ClassScheduleManager)
// so a bell-schedule change never needs a code deploy. config/class_schedule
// falls under firestore.rules' wide-open config/** rule, so any logged-in
// (or logged-out) client can already read it — no rules change needed.
export const fetchClassSchedule = async () => {
  try {
    const snap = await getDoc(doc(db, 'config', 'class_schedule'));
    return snap.exists() ? snap.data().blocks || [] : [];
  } catch (err) {
    console.error('Error fetching class schedule:', err);
    return [];
  }
};

// A whole-class-period exception for ONE calendar date (an unusual bell
// schedule day — assembly, delayed start, etc.), keyed by that date's
// YYYY-MM-DD so it only ever affects that one day. Lives in its own
// collection rather than inside config/class_schedule itself so looking
// up "is there an exception today" is a single doc read, not a scan.
export const fetchScheduleOverrideForDate = async (dateStr) => {
  try {
    const snap = await getDoc(doc(db, 'schedule_overrides', dateStr));
    return snap.exists() ? snap.data().blocks || [] : [];
  } catch (err) {
    console.error('Error fetching schedule override:', err);
    return [];
  }
};

// `overrideBlocksForToday` entries replace the regular block for the same
// section (by exact-insensitive match); any regular section not mentioned
// in the override keeps its normal time, and an override section with no
// regular counterpart (e.g. a one-off block added just for today) is still
// included. This is a PARTIAL override by design — a teacher adjusting one
// period's time on an unusual day shouldn't have to re-enter every other
// period's normal time just to avoid wiping it.
export const mergeScheduleBlocks = (regularBlocks, overrideBlocksForToday) => {
  if (!overrideBlocksForToday || overrideBlocksForToday.length === 0) return regularBlocks || [];
  const keyOf = (b) => (b.section || '').trim().toUpperCase();
  const overrideBySection = new Map(overrideBlocksForToday.map((b) => [keyOf(b), b]));
  const merged = (regularBlocks || []).map((b) => overrideBySection.get(keyOf(b)) || b);
  overrideBlocksForToday.forEach((b) => {
    if (!merged.some((m) => keyOf(m) === keyOf(b))) merged.push(b);
  });
  return merged;
};

// Whether `now` falls within `section`'s configured window AND today is
// actually that section's day (its trailing letter must match `todaysCiclo`
// — the calendar's own ciclo for TODAY, not derived from the section string
// itself, which only says which cycle the class MEETS on, not which cycle
// today happens to be).
export const isReassessmentWindowOpen = (section, blocks, todaysCiclo, now = new Date()) => {
  if (!section) return { open: false, reason: 'no_section', block: null };
  if (!todaysCiclo) return { open: false, reason: 'no_ciclo_today', block: null };

  const sectionCiclo = section.trim().slice(-1).toUpperCase();
  if (sectionCiclo !== todaysCiclo.toUpperCase()) {
    return { open: false, reason: 'wrong_day', block: null };
  }

  const block = (blocks || []).find((b) => (b.section || '').trim().toUpperCase() === section.trim().toUpperCase());
  if (!block || !block.start || !block.end) {
    return { open: false, reason: 'no_schedule', block: null };
  }

  const [startH, startM] = block.start.split(':').map(Number);
  const [endH, endM] = block.end.split(':').map(Number);
  const start = new Date(now);
  start.setHours(startH, startM, 0, 0);
  const end = new Date(now);
  end.setHours(endH, endM, 0, 0);

  if (now < start || now > end) return { open: false, reason: 'outside_window', block };
  return { open: true, reason: null, block };
};
