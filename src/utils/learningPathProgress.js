import { getCachedDoc } from './firestoreCache';

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
  // Cached per unit id — callers (LearningPathTile, TeacherGradebook) were
  // each re-reading this doc fresh on every call even though the SAME
  // handful of units recur across every student and every Dashboard visit.
  const data = await getCachedDoc('learning_paths', unitId);
  if (!data) return { isFlat: true, pods: [], totalPods: 0 };
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

// --- Due dates, archival & progressive late grading (opt-in via task.enforceDueDate) ---
// A legacy/un-enforced task (enforceDueDate falsy — every task that existed
// before this feature shipped) must behave byte-for-byte as it always has:
// no archival, no locking, no penalty, live percent forever. Every function
// below is gated on that flag so adding it to this file never changes
// anything about a task a teacher hasn't explicitly opted in.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 23:59:59 local time on the día's own calendar date — same no-'Z'
// local-time-string convention Dashboard.jsx's formatDueDate already uses.
// Returns null when that día isn't in the calendar yet (nothing to enforce).
export const getDueDateTime = (dayDue, fechaByDia = {}) => {
  const fecha = fechaByDia[Number(dayDue)];
  if (!fecha) return null;
  return new Date(`${fecha}T23:59:59`);
};

// Shifts a due date forward by a teacher-granted extension, if any.
export const getEffectiveDueDateTime = (dueDateTime, teacherOverride) => {
  if (!dueDateTime) return null;
  const extendDays = Number(teacherOverride?.extendDays) || 0;
  return extendDays > 0 ? new Date(dueDateTime.getTime() + extendDays * MS_PER_DAY) : dueDateTime;
};

const dayLateMultiplier = (daysLate, penaltyPerDay, waivePenalty) => {
  if (waivePenalty) return 1;
  const rate = Math.max(0, Number(penaltyPerDay) || 0) / 100;
  return Math.max(0.5, 1 - rate * Math.max(0, daysLate));
};

// Calendar-day difference, not raw elapsed milliseconds — a write made 20
// hours after an 11:59 PM deadline is "1 day late" in the way a teacher
// means it (today's date is the day after the due date), not "0 days late"
// because a full 24h hasn't elapsed since the exact deadline instant.
const startOfLocalDay = (date) => new Date(`${date.toLocaleDateString('en-CA')}T00:00:00`);
const daysLateFor = (effectiveDueDateTime) =>
  Math.round((startOfLocalDay(new Date(Date.now())).getTime() - startOfLocalDay(effectiveDueDateTime).getTime()) / MS_PER_DAY);

// Read-only display helper — the percent to SHOW (gradebook, archived-tile
// label), accounting for a locked on-time baseline plus frozen-per-chunk
// late credit already stored on the student's progress node. Falls back to
// the plain live percent whenever there's nothing to account for yet (task
// not enforced, due date hasn't passed, or no on-time snapshot exists
// because the student hasn't touched the path since the deadline passed).
export const computeGradedPercent = (progressNode, livePercent, task, fechaByDia = {}) => {
  if (!task?.enforceDueDate) return livePercent;
  const snapshot = progressNode?.onTimeSnapshot;
  if (!snapshot) return livePercent;
  const lateCreditPercent = progressNode?.lateCreditPercent || 0;
  return Math.min(100, snapshot.percent + lateCreditPercent);
};

// Is this task's (possibly extended) deadline in the past, right now?
export const isPastEffectiveDueDate = (task, fechaByDia, teacherOverride) => {
  if (!task?.enforceDueDate) return false;
  const dueDateTime = getDueDateTime(task.day_due, fechaByDia);
  const effective = getEffectiveDueDateTime(dueDateTime, teacherOverride);
  return !!effective && Date.now() > effective.getTime();
};

// Write-time helper — called right before saving a student's new
// podIndex/segmentIndex. Returns just the progress-node fields this feature
// owns; the caller merges in path_points etc. For an un-enforced task, or a
// write that still lands on or before the deadline, returns exactly
// { podIndex, segmentIndex } — i.e. today's behavior, unchanged.
export const buildGradedProgressNode = ({
  existingProgressNode,
  newPodIndex,
  newSegmentIndex,
  meta,
  task,
  fechaByDia,
}) => {
  const base = { podIndex: newPodIndex, segmentIndex: newSegmentIndex };
  if (!task?.enforceDueDate) return base;

  const teacherOverride = existingProgressNode?.teacherOverride;
  const dueDateTime = getDueDateTime(task.day_due, fechaByDia);
  const effectiveDueDateTime = getEffectiveDueDateTime(dueDateTime, teacherOverride);
  if (!effectiveDueDateTime || Date.now() <= effectiveDueDateTime.getTime()) return base;

  // Past the deadline — lazily freeze the on-time baseline the first time
  // this fires, then add this write's own increment at its own frozen rate.
  const existingSnapshot = existingProgressNode?.onTimeSnapshot;
  const priorLivePercent = getUnitSummary(
    { _: { podIndex: existingProgressNode?.podIndex || 0, segmentIndex: existingProgressNode?.segmentIndex || 0 } },
    '_',
    meta
  ).percent;
  const onTimeSnapshot = existingSnapshot || {
    percent: priorLivePercent,
    podIndex: existingProgressNode?.podIndex || 0,
    segmentIndex: existingProgressNode?.segmentIndex || 0,
    snapshotAt: new Date().toISOString(),
  };

  const newLivePercent = getUnitSummary(
    { _: { podIndex: newPodIndex, segmentIndex: newSegmentIndex } },
    '_',
    meta
  ).percent;
  const baseline = Math.max(priorLivePercent, onTimeSnapshot.percent);
  const increment = Math.max(0, newLivePercent - baseline);

  const daysLate = daysLateFor(effectiveDueDateTime);
  const multiplier = dayLateMultiplier(daysLate, task.latePenaltyPerDay, teacherOverride?.waivePenalty);
  const lateCreditPercent = (existingProgressNode?.lateCreditPercent || 0) + increment * multiplier;

  return { ...base, onTimeSnapshot, lateCreditPercent };
};
