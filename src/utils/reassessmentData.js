import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// One doc per student+circle, same id convention as recuperaciones (see
// recuperacionData.js) — a reassessment is the second stage of the same
// makeup-work flow (gate passed -> this), so it's kept in its own
// collection rather than folded into recuperaciones itself: the gate is
// retake-forever/no-points, while a reassessment is intended as a single
// official, auto-graded attempt whose score the gradebook reads.
const docId = (uid, circleId) => `${uid}__${circleId}`;

export const fetchReassessmentAttempt = async (uid, circleId) => {
  const snap = await getDoc(doc(db, 'reassessment_attempts', docId(uid, circleId)));
  return snap.exists() ? snap.data() : null;
};

// meta: { course, studentName, circleId, evalLabel }. `questions` is the
// live-generated set for THIS attempt, saved verbatim so grading later
// checks answers against the exact set the student actually saw — not a
// fresh re-generation that could draw different verbs.
export const startReassessmentAttempt = async (uid, meta, questions, timeLimitSeconds) => {
  const now = new Date();
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
    expiresAt: new Date(now.getTime() + timeLimitSeconds * 1000).toISOString(),
    finishedAt: null,
  };
  // merge: true — a retake after a teacher clear leaves `history` sitting
  // on this same doc (see clearReassessmentAttempt); a plain overwrite here
  // would silently wipe that past-attempts record the moment a new one starts.
  await setDoc(doc(db, 'reassessment_attempts', docId(uid, meta.circleId)), payload, { merge: true });
  return payload;
};

// Debounced from the engine on every answer change — keeps an in-progress
// attempt recoverable (tab closed, refresh, device switch) without waiting
// for the final submit.
export const saveReassessmentAnswers = async (uid, circleId, answers) => {
  await setDoc(doc(db, 'reassessment_attempts', docId(uid, circleId)), { answers }, { merge: true });
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
};

// Teacher-only: archives a finished attempt into `history` and clears the
// active fields back to null, so ReassessmentEngine sees no current
// attempt and lets the student start a brand new one next time their
// window is open. A student can never do this themselves — the whole
// point is that retaking a reassessment requires the teacher to let it
// happen, not a self-service "try again" — so this is only ever called
// from an admin-only UI (TeacherRecuperacionTab's reset button).
export const clearReassessmentAttempt = async (uid, circleId) => {
  const ref = doc(db, 'reassessment_attempts', docId(uid, circleId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const history = [...(data.history || [])];
  if (data.status === 'finished') {
    history.push({ score: data.score, finishedAt: data.finishedAt, questions: data.questions || [], answers: data.answers || {} });
  }
  await setDoc(ref, {
    status: null,
    questions: [],
    answers: {},
    score: null,
    startedAt: null,
    expiresAt: null,
    finishedAt: null,
    history,
  }, { merge: true });
};
