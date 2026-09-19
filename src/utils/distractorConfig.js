// Shared config for the Sentence Bank's live distractor engine.
// SentenceManager.jsx (admin) and WorkoutEngine.jsx (student) both read from this
// single source so a tag always means the same thing in both places.

export const AVAILABLE_TENSES = [
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
    { id: 'imperativo_afirmativo', label: 'Mandatos (+)' },
    { id: 'imperativo_negativo', label: 'Mandatos (-)' },
  ];
  
  export const SUBJECTS = [
    { id: 'yo', label: 'yo' },
    { id: 'tú', label: 'tú' },
    { id: 'él_ella_ud', label: 'él / ella / Ud.' },
    { id: 'nosotros', label: 'nosotros' },
    { id: 'vosotros', label: 'vosotros' },
    { id: 'ellos_ellas_uds', label: 'ellos / ellas / Uds.' },
  ];
  
  // Binary-contrast pairs: swapping the tense (same lemma + subject) produces
  // the hardest possible distractor. Add more pairs here as needed.
  export const PAIR_MAP = {
    preterito_imperfecto: { a: 'pretérito', b: 'imperfecto', label: 'Pretérito ↔ Imperfecto' },
    subjuntivo_presente_indicativo: { a: 'subjuntivo_presente', b: 'presente', label: 'Subjuntivo Presente ↔ Indicativo Presente' },
    subjuntivo_presente_futuro: { a: 'subjuntivo_presente', b: 'futuro', label: 'Subjuntivo Presente ↔ Futuro' },
    pluscuamperfecto_subj_ra_indicativo: { a: 'pluscuamperfecto_subjuntivo_ra', b: 'pluscuamperfecto', label: 'Pluscuamperfecto Subjuntivo ↔ Indicativo' },
    perfecto_subj_indicativo: { a: 'subjuntivo_perfecto', b: 'pretérito_perfecto', label: 'Subjuntivo Perfecto ↔ Indicativo Perfecto' },
  };
  
  // Fixed word pools for non-verb (or non-conjugation) topics. The correct
  // answer should be one of the words in the matching pool.
  export const POOL_MAP = {
    por_para: { words: ['por', 'para'], label: 'Por vs. Para' },
    preposiciones: { words: ['por', 'para', 'a', 'de', 'en', 'con', 'sobre'], label: 'Preposiciones Generales' },
    saber_conocer: { words: ['sé', 'sabes', 'sabe', 'conozco', 'conoces', 'conoce'], label: 'Saber vs. Conocer' },
    ser_estar: { words: ['es', 'está', 'son', 'están'], label: 'Ser vs. Estar' },
  };
  
  export const DISTRACTOR_MODES = [
    { id: 'none', label: 'Ninguno (aleatorio genérico)' },
    { id: 'binary_verb', label: 'Contraste Binario (2 opciones, par de tiempos)' },
    { id: 'quad_verb', label: 'Verbo (4 opciones, par de tiempos + relleno)' },
    { id: 'fixed_pool', label: 'Banco de Palabras Fijo (4 opciones)' },
  ];