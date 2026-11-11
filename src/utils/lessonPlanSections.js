// Shared by LessonPlanPage.jsx (the normal plan page) and
// LessonPlanFormalPage.jsx (the print view) so both always render sections
// in the same order — this used to live only in LessonPlanPage.jsx, which
// is why the formal page's own independently-hardcoded section sequence
// could silently drift out of sync with it (e.g. Evaluación always landing
// near the bottom there regardless of where it's ordered here).
//
// Order matches how the class period actually runs: quizzes/evaluación
// first thing, then the daily-routine trio (calentamiento, curiosidad,
// gramática), then the rest. Anuncios (rendered separately, above this
// list) and tarea (rendered separately, below it) aren't in this array.
export const SECTION_DEFS = [
  { key: 'evaluacion', label: 'Evaluación', icon: '🎯' },
  { key: 'calentamiento', label: 'Calentamiento', icon: '⏱️' },
  { key: 'curiosidad', label: 'Curiosidad', icon: '💡' },
  { key: 'gramatica', label: 'Gramática / Estructuras', icon: '📚' },
  { key: 'practica', label: 'Práctica', icon: '✏️' },
  { key: 'oraciones', label: 'Oraciones de Práctica', icon: '✍️' },
  { key: 'actividades', label: 'Actividades (Video/Lectura/Conversación)', icon: '🎬' },
  { key: 'destacado', label: 'Destacado del Día', icon: '🌟' },
];
