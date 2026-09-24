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
export const buildWarmupBreakdown = (assignedWarmups, studentWarmups = {}) => {
  return assignedWarmups.map((c) => {
    const entry = studentWarmups[c.id];
    return {
      id: c.id,
      title: c.title,
      dia: c.dia,
      course: c.course,
      fecha: c.fecha,
      completed: !!entry?.completed,
      grade: typeof entry?.grade === 'number' ? entry.grade : 0,
      rawScore: entry?.rawScore || null,
      errors: entry?.errors || [],
    };
  });
};

export const averageFromBreakdown = (breakdown) => {
  if (!breakdown || breakdown.length === 0) return null;
  return Math.round(breakdown.reduce((sum, b) => sum + b.grade, 0) / breakdown.length);
};
