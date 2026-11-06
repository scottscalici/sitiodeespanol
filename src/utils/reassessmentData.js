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
  await setDoc(doc(db, 'reassessment_attempts', docId(uid, meta.circleId)), payload);
  return payload;
};

// Debounced from the engine on every answer change — keeps an in-progress
// attempt recoverable (tab closed, refresh, device switch) without waiting
// for the final submit.
export const saveReassessmentAnswers = async (uid, circleId, answers) => {
  await setDoc(doc(db, 'reassessment_attempts', docId(uid, circleId)), { answers }, { merge: true });
};

export const finishReassessmentAttempt = async (uid, circleId, { answers, score }) => {
  await setDoc(
    doc(db, 'reassessment_attempts', docId(uid, circleId)),
    { status: 'finished', answers, score, finishedAt: new Date().toISOString() },
    { merge: true }
  );
};
