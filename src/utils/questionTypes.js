// The question-type quota system that replaced the old vocab/verb/grammar
// preset dropdown. A segment's `questionMix` is a count per type; WorkoutEngine
// consumes it directly (src/student/WorkoutEngine.jsx) instead of picking a
// format at random from a set of allowed "modalities". `recall` renders as
// "conjugate" for a verb target or "write" for a vocab target — the engine
// decides that per-question based on what kind of concept got drawn, so one
// key covers both content types.
export const QUESTION_TYPE_DEFAULTS = { recall: 5, mc: 3, matching: 1, listen: 1, speak: 0, sentence: 0 };

export const QUESTION_TYPE_LABELS = {
  vocab: { recall: 'Escribir', mc: 'Opción Múltiple', matching: 'Emparejar', listen: 'Escuchar', speak: 'Hablar', sentence: 'Oraciones' },
  verb: { recall: 'Conjugar', mc: 'Opción Múltiple', matching: 'Emparejar', listen: 'Escuchar', speak: 'Hablar', sentence: 'Oraciones' },
};

export const QUESTION_TYPE_ORDER = ['recall', 'mc', 'matching', 'listen', 'speak', 'sentence'];

export const sumMix = (mix) => Object.values(mix || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
