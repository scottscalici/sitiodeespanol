// Every tense the app knows how to store/generate questions for. Single
// source of truth — VerbEditor, CalentamientoAdmin, and VerbVault each used
// to keep their own copy of this list, and they'd drifted out of sync
// (VerbEditor/CalentamientoAdmin were missing 8 tenses VerbVault had),
// silently making those tenses uneditable/unselectable outside VerbVault
// even though the generator itself (verbQuestionGenerator.js) is generic
// and works with any tense ID a verb has conjugation data for.
export const VERB_TENSES = [
  { id: 'presente', label: 'Presente' },
  { id: 'pretérito', label: 'Pretérito' },
  { id: 'imperfecto', label: 'Imperfecto' },
  { id: 'futuro', label: 'Futuro' },
  { id: 'condicional', label: 'Condicional' },
  { id: 'pretérito_perfecto', label: 'Pretérito Perfecto' },
  { id: 'pluscuamperfecto', label: 'Pluscuamperfecto' },
  { id: 'futuro_perfecto', label: 'Futuro Perfecto' },
  { id: 'condicional_perfecto', label: 'Condicional Perfecto' },
  { id: 'presente_progresivo', label: 'Presente Progresivo' },
  { id: 'imperfecto_progresivo', label: 'Imperfecto Progresivo' },
  { id: 'subjuntivo_presente', label: 'Presente de Subjuntivo' },
  { id: 'subjuntivo_imperfecto_ra', label: 'Imperfecto de Subjuntivo (-ra)' },
  { id: 'subjuntivo_imperfecto_se', label: 'Subjuntivo Imperfecto (-se)' },
  { id: 'subjuntivo_perfecto', label: 'Pretérito Perfecto de Subjuntivo' },
  { id: 'pluscuamperfecto_subjuntivo_ra', label: 'Pluscuamperfecto Subjuntivo (hubiera)' },
  { id: 'pluscuamperfecto_subjuntivo_se', label: 'Pluscuamperfecto Subjuntivo (hubiese)' },
  { id: 'imperativo_afirmativo', label: 'Mandatos Afirmativos' },
  { id: 'imperativo_negativo', label: 'Mandatos Negativos' },
];

// The 6 subject cells every tense is conjugated for. él/ella/Ud. and
// ellos/ellas/Uds. are each ONE stored cell — grammatically correct even
// for imperativo, since Ud./Uds. commands use the same form as the
// (subjunctive-derived) él/ella and ellos/ellas forms.
export const VERB_SUBJECTS = [
  { id: 'yo', label: 'yo' },
  { id: 'tú', label: 'tú' },
  { id: 'él_ella_ud', label: 'él / ella / Ud.' },
  { id: 'nosotros', label: 'nosotros' },
  { id: 'vosotros', label: 'vosotros' },
  { id: 'ellos_ellas_uds', label: 'ellos / ellas / Uds.' },
];
