import { collection, addDoc, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const CATEGORY_IMAGES_DOC = doc(db, 'question_pool_categories', '_defaults');

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

// Lists every fact in the pool, newest first, so an admin can reuse one
// instead of retyping it — read fresh on every call (no caching) since the
// admin's own just-saved clues should show up immediately.
export const listPoolQuestions = async () => {
  const snapshot = await getDocs(collection(db, 'question_pool'));
  const entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  entries.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return entries;
};

// Patches one pool entry in place (today: just its own `image` override) —
// each QuestionPoolManager row saves immediately on change rather than
// batching, since the list can grow into the hundreds and holding that many
// pending edits in memory risks losing work if the tab closes early.
export const updatePoolQuestion = async (id, patch) => {
  await updateDoc(doc(db, 'question_pool', id), patch);
};

// A single small doc mapping category name -> default image URL, instead of
// a field on every pool entry — so setting one image for "Cultura" applies
// to every Cultura question automatically, including ones added later,
// without re-stamping each entry.
export const getCategoryImages = async () => {
  const snap = await getDoc(CATEGORY_IMAGES_DOC);
  return snap.exists() ? snap.data() : {};
};

export const setCategoryImage = async (category, imageUrl) => {
  await setDoc(CATEGORY_IMAGES_DOC, { [category]: imageUrl }, { merge: true });
};

// Resolution order for what image to show for one pool question: its own
// override first, then its category's default, then null (caller shows a
// generic placeholder) — the single place this logic lives, read by both
// the admin's live preview and the trivia game's room builder.
export const resolvePoolQuestionImage = (entry, categoryImages) =>
  entry.image || categoryImages[entry.category] || null;
