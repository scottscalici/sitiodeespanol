import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// A reusable bank of atomic trivia facts (clue + answer + optional
// distractors), independent of any single curiosidad. Today only the
// multiple_choice question type writes here (one entry per clue, at the
// moment it's created), but the shape deliberately holds just the raw fact —
// a future whole-class board game can read the same entries and ignore
// `distractors` entirely, no need to strip multiple-choice-ness out later.
export const addPoolQuestion = async ({ clue, answer, distractors = [], category = '', sourceCuriosidadId = '' }) => {
  const docRef = await addDoc(collection(db, 'question_pool'), {
    clue,
    answer,
    distractors,
    category,
    sourceCuriosidadId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};
