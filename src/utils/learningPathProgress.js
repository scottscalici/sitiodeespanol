import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const LEARNING_PATH_BRANCHES = ['vocab', 'verbs', 'practical'];

// A learning_paths doc is either the new flat shape (data.pods, one progress
// pointer at progress[pathId]) or the legacy branched shape
// (data.branches.{vocab,verbs,practical}.pods, one pointer per branch at
// progress[pathId][branch]) from before the vocab/verb split. Both are
// supported so an old unit built before the split keeps working untouched.
const isFlatPath = (data) => Array.isArray(data?.pods);

// Fetches what getUnitSummary needs to compute segment-based progress: each
// pod's segment count and isBonus flag (a bonus pod — see the Pod Creator's
// "🎁 Bonificación" toggle — never counts toward the grade, so a unit with
// e.g. 6 graded pods + 1 bonus pod hits 100% at the end of pod 6, not pod 7).
// Only the current flat-shape path gets this treatment; a legacy branched
// path (built before the vocab/verb split) can no longer be authored, so it
// can never have a bonus pod marked — `pods` stays empty for it and
// getUnitSummary below falls back to its original pod-count-based math.
export const fetchUnitProgressMeta = async (unitId) => {
  if (!unitId) return { isFlat: true, pods: [], totalPods: 0 };
  const snap = await getDoc(doc(db, 'learning_paths', unitId));
  if (!snap.exists()) return { isFlat: true, pods: [], totalPods: 0 };
  const data = snap.data();
  if (isFlatPath(data)) {
    const pods = data.pods.map((p) => ({ segmentCount: p.segments?.length || 0, isBonus: !!p.isBonus }));
    return { isFlat: true, pods, totalPods: pods.length };
  }
  const branches = data.branches || {};
  const totalPods = LEARNING_PATH_BRANCHES.reduce((sum, branch) => sum + (branches[branch]?.pods?.length || 0), 0);
  return { isFlat: false, pods: [], totalPods };
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

// The single progress number shown for one unit — segment-based (not
// pod-count-based) for a current flat-shape path, so a 6-segment pod
// finishing is worth 6% of a 100-segment path, not a flat 1/10th regardless
// of how many segments it actually held. Bonus pods (meta.pods[].isBonus)
// are excluded from both the total and the completed count entirely, so
// finishing every graded pod is 100% and any bonus pod beyond it is pure
// extra credit that can't push the percent past 100.
export const getUnitSummary = (progress, unitId, meta) => {
  const { isFlat, pods, totalPods } = meta;

  if (!isFlat) {
    const completedPods = Math.min(getUnitCompletedPods(progress, unitId), totalPods);
    const percent = totalPods > 0 ? Math.round((completedPods / totalPods) * 100) : 0;
    return { completedPods, totalPods, percent, letterGrade: getLetterGrade(percent) };
  }

  const unitProgress = progress?.[unitId];
  const podIndex = unitProgress?.podIndex || 0;
  const segmentIndex = unitProgress?.segmentIndex || 0;

  const totalSegments = pods.reduce((sum, p) => (p.isBonus ? sum : sum + p.segmentCount), 0);
  let completedSegments = 0;
  pods.forEach((p, idx) => {
    if (p.isBonus) return;
    if (idx < podIndex) completedSegments += p.segmentCount;
    else if (idx === podIndex) completedSegments += Math.min(segmentIndex, p.segmentCount);
  });
  completedSegments = Math.min(completedSegments, totalSegments);

  const percent = totalSegments > 0 ? Math.round((completedSegments / totalSegments) * 100) : 0;
  const completedPods = Math.min(podIndex, totalPods);
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
