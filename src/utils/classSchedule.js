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
