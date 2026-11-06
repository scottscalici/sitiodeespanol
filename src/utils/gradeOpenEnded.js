import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { awardPoints } from './pointsHelper';

// Grades one student's open_ended answer on a reading card. awardPoints is
// purely additive with no source tracking (see pointsHelper.js) and there's
// no other idempotency guard anywhere in the codebase for a teacher-graded
// item, so re-grading an already-graded answer here awards only the DELTA
// between the new and previous point value (which may be negative) rather
// than stacking the new total on top of the old one.
export const gradeOpenEndedResponse = async (uid, cardId, qIdx, { points, comment }) => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? snap.data()?.progress?.readingCards?.[cardId]?.grades?.[qIdx] : null;
  const delta = points - (existing?.points || 0);

  await setDoc(
    userRef,
    {
      progress: {
        readingCards: {
          [cardId]: {
            grades: {
              [qIdx]: { points, comment: comment || '', gradedAt: new Date().toISOString() },
            },
          },
        },
      },
    },
    { merge: true }
  );

  if (delta !== 0) await awardPoints(uid, delta);
};
