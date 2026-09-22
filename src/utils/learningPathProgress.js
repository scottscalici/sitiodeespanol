import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const LEARNING_PATH_BRANCHES = ['vocab', 'verbs', 'practical'];

// A learning_paths doc is either the new flat shape (data.pods, one progress
// pointer at progress[pathId]) or the legacy branched shape
// (data.branches.{vocab,verbs,practical}.pods, one pointer per branch at
// progress[pathId][branch]) from before the vocab/verb split. Both are
// supported so an old unit built before the split keeps working untouched.
const isFlatPath = (data) => Array.isArray(data?.pods);

// Fetches one unit's total pod count.
export const fetchUnitTotalPods = async (unitId) => {
  if (!unitId) return 0;
  const snap = await getDoc(doc(db, 'learning_paths', unitId));
  if (!snap.exists()) return 0;
  const data = snap.data();
  if (isFlatPath(data)) return data.pods.length;
  const branches = data.branches || {};
  return LEARNING_PATH_BRANCHES.reduce((sum, branch) => sum + (branches[branch]?.pods?.length || 0), 0);
};

// Pods completed = podIndex (pods fully finished before the one currently in
// progress). Flat paths keep one pointer; legacy branched paths sum across
// their three branch pointers. Since this only has `progress`, not the path
// doc itself, it can't tell which shape a given unitId is — it sums both
// possible locations, which is safe because a doc only ever populates one.
export const getUnitCompletedPods = (progress, unitId) => {
  const unitProgress = progress?.[unitId];
  const flatCount = unitProgress?.podIndex || 0;
  const branchedCount = LEARNING_PATH_BRANCHES.reduce((sum, branch) => sum + (unitProgress?.[branch]?.podIndex || 0), 0);
  return flatCount + branchedCount;
};

export const getLetterGrade = (percent) => {
  if (percent >= 90) return 'A';
  if (percent >= 80) return 'B';
  if (percent >= 70) return 'C';
  if (percent >= 60) return 'D';
  return 'F';
};

// Combines the two helpers above into the single number shown for one unit.
export const getUnitSummary = (progress, unitId, totalPods) => {
  const completedPods = Math.min(getUnitCompletedPods(progress, unitId), totalPods);
  const percent = totalPods > 0 ? Math.round((completedPods / totalPods) * 100) : 0;
  return { completedPods, totalPods, percent, letterGrade: getLetterGrade(percent) };
};

// Every Dominio task assigned so far for a course (day_assigned has arrived), newest first.
// Due date does NOT gate access — a student can always revisit a previously assigned unit.
export const getAssignedDominioTasks = (courseTasks = [], liveDia) => {
  return courseTasks
    .filter((t) => t.tipo === 'Dominio' && t.path_id && Number(t.day_assigned) <= Number(liveDia))
    .sort((a, b) => Number(b.day_assigned) - Number(a.day_assigned));
};

// The unit a student should land on by default: the most recently assigned Dominio task.
export const getCurrentDominioTask = (courseTasks = [], liveDia) => {
  const assigned = getAssignedDominioTasks(courseTasks, liveDia);
  return assigned[0] || null;
};
