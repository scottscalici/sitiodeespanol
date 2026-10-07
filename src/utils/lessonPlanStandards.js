// ACTFL World-Readiness Standards (the 5 Cs) mapped onto each Lesson Plan
// section — a static lookup, not a per-item Firestore mapping, since the
// mapping is really "what kind of task is this section" rather than
// anything that varies day to day. Used only by the Formal lesson plan view.
export const COURSE_TITLES = {
  s2: 'Spanish III/IV',
  s4: 'IB Spanish B II',
};

export const SECTION_STANDARDS = {
  calentamiento: 'Comparaciones',
  oraciones: 'Conexiones',
  gramatica: 'Conexiones',
  practica: 'Conexiones',
  curiosidad: 'Culturas · Interpretativa',
  destacado: 'Culturas',
  tarea: 'Comparaciones · Conexiones',
};

export const ACTIVITY_STANDARDS = {
  video: 'Comunicación Interpretativa',
  lectura: 'Comunicación Interpretativa',
  conversacion: 'Comunicación Interpersonal',
  musica: 'Comunicación Interpretativa · Culturas',
  cultura: 'Culturas',
};

// Evaluación labels are free text ("Vocabulario 8.1", "Presente 1",
// "Examen final", "Presente 2 y Vocabulario 1.1"). The only exception to
// the default Conexiones standard is a SENIOR (s4) evaluation that is
// purely a vocab assessment — those are spoken/descriptive, not recall, so
// they map to Interpersonal instead. An exam label or a label combining a
// vocab unit with a tense ("... y ...") stays Conexiones, since it's also
// testing more than vocab recall.
export const getEvaluacionStandard = (label, course) => {
  const text = label || '';
  const isExamen = /examen/i.test(text);
  const isCombined = /\sy\s/i.test(text);
  const isPureVocab = /vocabulario/i.test(text) && !isExamen && !isCombined;
  if (course === 's4' && isPureVocab) return 'Comunicación Interpersonal';
  return 'Conexiones';
};
