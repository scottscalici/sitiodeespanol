import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

// One doc per student+circle, same id convention as recuperaciones (see
// recuperacionData.js) — a reassessment is the second stage of the same
// makeup-work flow (gate passed -> this), so it's kept in its own
// collection rather than folded into recuperaciones itself: the gate is
// retake-forever/no-points, while a reassessment is intended as a single
// official, auto-graded attempt whose score the gradebook reads.
const docId = (uid, circleId) => `${uid}__${circleId}`;

// Pure, no Firestore — shared between ReassessmentEngine (grading a
// student's own submit) and the teacher's "Finalizar Ahora" glitch action,
// so both grade identically rather than keeping two copies in sync by hand.
export const gradeAnswers = (questions, answerMap) => {
  let correct = 0;
  (questions || []).forEach((q, idx) => {
    const userVal = (answerMap?.[idx] || '').trim().toLowerCase();
    const allowed = (q.forma || '').toLowerCase().split(/[/|;,]/).map((a) => a.trim());
    if (allowed.includes(userVal)) correct += 1;
  });
  const total = (questions || []).length;
  return { correct, total, score: total > 0 ? Math.round((correct / total) * 100) : 0 };
};

export const fetchReassessmentAttempt = async (uid, circleId) => {
  const snap = await getDoc(doc(db, 'reassessment_attempts', docId(uid, circleId)));
  return snap.exists() ? snap.data() : null;
};

// The site-wide lockout flag (checked by ReassessmentLockGuard on every
// route change) lives on the student's OWN user doc, not on the attempt —
// AuthContext already keeps `userData` live via onSnapshot, so a write here
// is visible app-wide (every open tab) the moment it lands, with no extra
// listener needed. A student can write their own (existing users/{uid}
// rules already allow it); an admin can write any student's.
const setActiveReassessmentLock = async (uid, circleId, expiresAt) => {
  await setDoc(doc(db, 'users', uid), { activeReassessment: { circleId, expiresAt } }, { merge: true });
};

export const clearActiveReassessmentLock = async (uid) => {
  await setDoc(doc(db, 'users', uid), { activeReassessment: null }, { merge: true });
};

// meta: { course, studentName, circleId, evalLabel }. `questions` is the
// live-generated set for THIS attempt, saved verbatim so grading later
// checks answers against the exact set the student actually saw — not a
// fresh re-generation that could draw different verbs.
export const startReassessmentAttempt = async (uid, meta, questions, timeLimitSeconds) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeLimitSeconds * 1000).toISOString();
  const payload = {
    uid,
    course: meta.course,
    studentName: meta.studentName,
    circleId: meta.circleId,
    evalLabel: meta.evalLabel,
    status: 'in_progress',
    questions,
    answers: {},
    score: null,
    startedAt: now.toISOString(),
    expiresAt,
    finishedAt: null,
    tabSwitchLog: [],
  };
  // merge: true — a retake after a teacher clear leaves `history` sitting
  // on this same doc (see clearReassessmentAttempt); a plain overwrite here
  // would silently wipe that past-attempts record the moment a new one starts.
  await setDoc(doc(db, 'reassessment_attempts', docId(uid, meta.circleId)), payload, { merge: true });
  await setActiveReassessmentLock(uid, meta.circleId, expiresAt);
  return payload;
};

// Called defensively whenever the engine resumes an already-in-progress
// attempt (e.g. a page refresh) — re-asserts the lock in case it was ever
// lost (a genuine glitch, or a teacher's "Desbloquear" that didn't also
// end the attempt). Harmless no-op if it's already set to the same value.
export const reassertActiveReassessmentLock = async (uid, circleId, expiresAt) => {
  await setActiveReassessmentLock(uid, circleId, expiresAt);
};

// Debounced from the engine on every answer change — keeps an in-progress
// attempt recoverable (tab closed, refresh, device switch) without waiting
// for the final submit.
export const saveReassessmentAnswers = async (uid, circleId, answers) => {
  await setDoc(doc(db, 'reassessment_attempts', docId(uid, circleId)), { answers }, { merge: true });
};

// Appended whenever the student leaves the reassessment tab/window while
// `in_progress` (see ReassessmentEngine's visibilitychange/blur listeners)
// — shown to the teacher next to the score, not hidden from them, but
// never shown back to the student (it's an integrity signal, not feedback).
export const logReassessmentTabSwitch = async (uid, circleId, type) => {
  await setDoc(
    doc(db, 'reassessment_attempts', docId(uid, circleId)),
    { tabSwitchLog: arrayUnion({ type, timestamp: new Date().toISOString() }) },
    { merge: true }
  );
};

// Teacher-only: "🔓 Abrir Ahora" — bypasses the A/B class-window check for
// ONE student for a limited time (default 20 min), e.g. they're meeting
// the teacher outside class. ReassessmentEngine checks this alongside the
// regular window; it never bypasses the gate-pass check. Works whether or
// not the student has ever opened the reassessment page before (a plain
// merge onto a doc that may not exist yet — see the firestore.rules
// create/update rule, which allows admin either way). No separate "close
// it after they submit" logic is needed: once an attempt exists with a
// status, the engine's own status check runs before the window/override
// check ever does, so the override is moot the moment they start; if they
// never start, openUntil passing is the only other way it stops mattering.
export const grantReassessmentOverride = async (uid, circleId, minutes = 20) => {
  const ref = doc(db, 'reassessment_attempts', docId(uid, circleId));
  await setDoc(
    ref,
    {
      uid,
      circleId,
      override: { openUntil: new Date(Date.now() + minutes * 60000).toISOString(), grantedAt: new Date().toISOString() },
    },
    { merge: true }
  );
};

export const finishReassessmentAttempt = async (uid, circleId, { answers, score }) => {
  await setDoc(
    doc(db, 'reassessment_attempts', docId(uid, circleId)),
    { status: 'finished', answers, score, finishedAt: new Date().toISOString() },
    { merge: true }
  );
  await clearActiveReassessmentLock(uid);
};

// Teacher-only: archives whatever's on the doc (finished OR a stuck
// in_progress session) into `history` and clears the active fields back to
// null, so ReassessmentEngine sees no current attempt and lets the student
// start a brand new one. Also clears the lockout flag, since a cleared
// attempt has nothing left to be locked INTO. A student can never do this
// themselves — retaking requires the teacher to let it happen, not a
// self-service "try again" — so this only ever runs from an admin-only UI
// (TeacherRecuperacionTab's 🔄 Reiniciar and 🛠️ Reiniciar Intento buttons).
export const clearReassessmentAttempt = async (uid, circleId) => {
  const ref = doc(db, 'reassessment_attempts', docId(uid, circleId));
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    if (data.status) {
      const history = [
        ...(data.history || []),
        {
          status: data.status,
          score: data.score ?? null,
          finishedAt: data.finishedAt || null,
          questions: data.questions || [],
          answers: data.answers || {},
          tabSwitchLog: data.tabSwitchLog || [],
        },
      ];
      await setDoc(
        ref,
        {
          status: null,
          questions: [],
          answers: {},
          score: null,
          startedAt: null,
          expiresAt: null,
          finishedAt: null,
          tabSwitchLog: [],
          history,
        },
        { merge: true }
      );
    }
  }
  await clearActiveReassessmentLock(uid);
};

// Teacher-only glitch recovery, for an attempt stuck `in_progress` (a
// crash, a lost connection) — grades it with whatever was last autosaved
// and finishes it right now, same as if the student had submitted.
export const endReassessmentNow = async (uid, circleId) => {
  const ref = doc(db, 'reassessment_attempts', docId(uid, circleId));
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().status !== 'in_progress') return;
  const data = snap.data();
  const graded = gradeAnswers(data.questions, data.answers || {});
  await finishReassessmentAttempt(uid, circleId, { answers: data.answers || {}, score: graded.score });
};

// Teacher-only: clears JUST the lockout flag, leaving the attempt's own
// status untouched — for the narrow case where the attempt data looks
// fine but the redirect-lock itself is stuck. Reopening the reassessment
// page will reassert the lock if the attempt is still genuinely
// in_progress, so this is a temporary unstick, not a real fix on its own.
export const unlockReassessmentAccess = async (uid) => {
  await clearActiveReassessmentLock(uid);
};

// Teacher-only bookkeeping: a finished reassessment's score still has to be
// hand-entered into Schoology, so this just tracks whether Scott has
// already done that for this one — purely a checklist flag, never read by
// grading/gating logic itself.
export const setReassessmentEnteredInGradebook = async (uid, circleId, entered) => {
  await setDoc(
    doc(db, 'reassessment_attempts', docId(uid, circleId)),
    { enteredInGradebook: entered, enteredInGradebookAt: entered ? new Date().toISOString() : null },
    { merge: true }
  );
};
