import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCachedCollection, invalidateCollectionCache } from './firestoreCache';

// One doc per student+circle: curriculum makeup work stays completely
// separate from graded learning-path/practice-hub progress. Never awards
// points (per the teacher: recuperación reflection+practice nets zero) and
// never advances any progress pointer — it only records reflection text
// (private to the student) and a gate-attempt history the teacher's
// eligibility list reads the pass/fail fact from, never the reflection.
const docId = (uid, circleId) => `${uid}__${circleId}`;

export const fetchRecuperacionDoc = async (uid, circleId) => {
  const snap = await getDoc(doc(db, 'recuperaciones', docId(uid, circleId)));
  return snap.exists() ? snap.data() : null;
};

// meta: { course, studentName, circleId, evalLabel } — evalDia is
// deliberately NOT stored here; the teacher/student views resolve it live
// off the practice_pods link the same way Practice Hub does, so a later
// reorder in the Evaluaciones Sequencer doesn't leave this doc stale.
export const submitReflection = async (uid, meta, answers) => {
  const ref = doc(db, 'recuperaciones', docId(uid, meta.circleId));
  await setDoc(ref, {
    uid,
    course: meta.course,
    studentName: meta.studentName,
    circleId: meta.circleId,
    evalLabel: meta.evalLabel,
    reflection: { ...answers, submittedAt: new Date().toISOString() },
    attempts: [],
    bestScore: 0,
    passed: false,
    passedAt: null,
    updated_at: new Date().toISOString(),
  }, { merge: true });
  invalidateCollectionCache('recuperaciones');
};

// Appends one gate attempt and recomputes bestScore/passed. Returns the
// updated doc so the caller can show pass/fail feedback immediately.
export const recordGateAttempt = async (uid, circleId, score, passThreshold) => {
  const ref = doc(db, 'recuperaciones', docId(uid, circleId));
  const existing = await fetchRecuperacionDoc(uid, circleId);
  const passed = score >= passThreshold;
  const attempts = [...(existing?.attempts || []), { score, passed, timestamp: new Date().toISOString() }];
  const bestScore = Math.max(existing?.bestScore || 0, score);
  const alreadyPassed = !!existing?.passed;
  const updated = {
    attempts,
    bestScore,
    passed: alreadyPassed || passed,
    passedAt: alreadyPassed ? existing.passedAt : (passed ? new Date().toISOString() : null),
    updated_at: new Date().toISOString(),
  };
  await setDoc(ref, updated, { merge: true });
  invalidateCollectionCache('recuperaciones');
  return { ...existing, ...updated };
};

// Teacher-side: every recuperación doc for a course, regardless of pass
// status — the eligibility list itself filters to passed:true, but other
// views (e.g. a future "who's stuck" view) can reuse this raw fetch.
export const fetchRecuperacionDocsForCourse = async (course) => {
  const docs = await getCachedCollection('recuperaciones');
  return docs.filter((d) => d.course === course);
};
