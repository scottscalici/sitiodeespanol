import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const LEARNING_PATH_BASE_ID = 's2_descubre2_preliminar';
export const LEARNING_PATH_BRANCHES = ['vocab', 'verbs', 'practical'];

// Fetches the 3 branch path documents and returns the total pod count across all of them.
export const fetchLearningPathTotalPods = async () => {
  const branchDocs = await Promise.all(
    LEARNING_PATH_BRANCHES.map((branch) =>
      getDoc(doc(db, 'learning_paths', `${LEARNING_PATH_BASE_ID}_${branch}`))
    )
  );
  return branchDocs.reduce((sum, snap) => sum + (snap.exists() ? (snap.data().pods?.length || 0) : 0), 0);
};

// Pods completed = podIndex (pods fully finished before the one currently in progress), summed across branches.
export const getLearningPathCompletedPods = (progress) => {
  return LEARNING_PATH_BRANCHES.reduce((sum, branch) => {
    const pathId = `${LEARNING_PATH_BASE_ID}_${branch}`;
    return sum + (progress?.[pathId]?.podIndex || 0);
  }, 0);
};

export const getLetterGrade = (percent) => {
  if (percent >= 90) return 'A';
  if (percent >= 80) return 'B';
  if (percent >= 70) return 'C';
  if (percent >= 60) return 'D';
  return 'F';
};

// Combines the two helpers above into the single number shown on the student tile and in the gradebook.
export const getLearningPathSummary = (progress, totalPods) => {
  const completedPods = Math.min(getLearningPathCompletedPods(progress), totalPods);
  const percent = totalPods > 0 ? Math.round((completedPods / totalPods) * 100) : 0;
  return { completedPods, totalPods, percent, letterGrade: getLetterGrade(percent) };
};
