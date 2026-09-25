// Shared "which calentamientos were assigned, and how did this student do
// on each one" logic — used by both the teacher gradebook's per-student
// breakdown popup and the student dashboard's own "Promedio" popup, so the
// two always agree on what counts as assigned and how a missing one grades.

// Every calentamiento assigned to `course`, due on or before `todayStr`,
// not excused, optionally restricted to a date range (a quarter). Sorted
// oldest-first so a breakdown reads chronologically.
export const getAssignedWarmups = (calentamientos, fechaByDia, course, todayStr, dateRange) => {
  return calentamientos
    .filter((c) => c.course === course && !c.excused)
    .map((c) => ({ ...c, fecha: c.dia != null ? fechaByDia[Number(c.dia)] : null }))
    .filter((c) => {
      if (!c.fecha || c.fecha > todayStr) return false;
      if (dateRange && !(c.fecha >= dateRange.startDate && c.fecha <= dateRange.endDate)) return false;
      return true;
    })
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
};

// Merges each assigned calentamiento with the student's own progress —
// a never-completed one grades as 0 (matching the gradebook average), and
// carries along the stored first-attempt errors so a caller can show
// exactly what was missed, not just the score.
//
// `getPossible(assignedItem)` says how many points this ONE item is worth
// toward the pooled classwork total (see weightedAverageFromBreakdown) —
// every calentamiento is intrinsically worth 5 points by its own grading
// formula (4 for verb accuracy + 1 for vocab, regardless of question
// count), so that's the default; a caller assigning practice cards passes
// its own (e.g. `c => c.gradeWeight`, an admin-set value on the card,
// deliberately independent of its question count AND of its ranking/XP
// points rate) so a quick practice card can't swing the pooled total as
// hard as a full calentamiento unless the admin says it should. `points`
// is derived from the stored percentage grade rather than requiring a
// separate stored field, so it works for completions saved before this
// existed too.
export const buildWarmupBreakdown = (assignedWarmups, studentWarmups = {}, getPossible = () => 5) => {
  return assignedWarmups.map((c) => {
    const entry = studentWarmups[c.id];
    const grade = typeof entry?.grade === 'number' ? entry.grade : 0;
    const possible = getPossible(c);
    return {
      id: c.id,
      title: c.title,
      dia: c.dia,
      course: c.course,
      fecha: c.fecha,
      completed: !!entry?.completed,
      grade,
      rawScore: entry?.rawScore || null,
      errors: entry?.errors || [],
      possible,
      points: (grade / 100) * possible,
    };
  });
};

// A pooled points-earned/points-possible average across every assigned item
// (calentamientos and practice cards alike), instead of a flat mean of each
// item's own percentage — so a small 1-question practice card only ever
// contributes its own small weight to the total, not the same weight as a
// full calentamiento.
export const weightedAverageFromBreakdown = (breakdown) => {
  if (!breakdown || breakdown.length === 0) return null;
  const totalPossible = breakdown.reduce((sum, b) => sum + (b.possible || 0), 0);
  if (totalPossible === 0) return null;
  const totalPoints = breakdown.reduce((sum, b) => sum + (b.points || 0), 0);
  return Math.round((totalPoints / totalPossible) * 100);
};
