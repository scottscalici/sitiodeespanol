// Shared verb-question generator, extracted from CalentamientoAdmin.jsx so
// the student engine can re-run the exact same random draw (using a
// warmup's saved configBlocks) to produce a fresh verb set on a redo,
// without any extra admin action.

// --- SMART SUBJECT PICKER (70/30 Singular/Plural, Vosotros Controlled) ---
export const getRandomSubject = (targetPref, includeVosotros = false) => {
  if (targetPref !== 'any') return targetPref;

  const singulars = ['yo', 'tú', 'él_ella_ud'];
  const plurals = includeVosotros
    ? ['nosotros', 'vosotros', 'ellos_ellas_uds']
    : ['nosotros', 'ellos_ellas_uds'];

  // 70% chance for singular, 30% for plural
  const isSingular = Math.random() < 0.7;
  if (isSingular) {
    return singulars[Math.floor(Math.random() * singulars.length)];
  } else {
    return plurals[Math.floor(Math.random() * plurals.length)];
  }
};

// English 3rd-person-singular conjugation (he/she) for the handful of
// irregular verbs plus the standard -s/-es/-ies spelling rules. The stored
// translation template ("he/she/you correct") is written correctly for
// "you" but needs the verb itself conjugated when the pronoun swapped in
// is actually "he" or "she" — e.g. "correct" -> "corrects", "live" -> "lives".
const IRREGULAR_THIRD_PERSON = { be: 'is', have: 'has', do: 'does', go: 'goes' };
const conjugateThirdPersonSingular = (verb) => {
  const lower = verb.toLowerCase();
  if (IRREGULAR_THIRD_PERSON[lower]) return IRREGULAR_THIRD_PERSON[lower];
  if (/(?:[sxz]|[cs]h)$/i.test(verb)) return `${verb}es`;
  if (/[^aeiou]y$/i.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
};

// --- HELPERS TO CLEAN UP 3RD PERSON SUBJECTS ---
export const formatSubjectAndTranslation = (rawSubject, rawEnglish) => {
  let sp = rawSubject;
  let en = rawEnglish || 'Sin traducción';

  if (rawSubject === 'él_ella_ud') {
    const choices = [
      { subj: 'él', enPrefix: 'he', conjugate: true },
      { subj: 'ella', enPrefix: 'she', conjugate: true },
      { subj: 'Ud.', enPrefix: 'you (formal)', conjugate: false },
    ];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    sp = choice.subj;
    // Trailing verb capture is optional so a translation with no clean
    // single word after the placeholder still falls back to a plain swap
    // instead of silently leaving "he/she/you" unreplaced.
    en = en.replace(/he\/she\/you(\s+\S+)?/i, (_match, tail) => {
      if (!tail) return choice.enPrefix;
      const [, space, verb] = tail.match(/^(\s+)(\S+)$/);
      const word = choice.conjugate ? conjugateThirdPersonSingular(verb) : verb;
      return `${choice.enPrefix}${space}${word}`;
    });
  } else if (rawSubject === 'ellos_ellas_uds') {
    const choices = [
      { subj: 'ellos', enPrefix: 'they' },
      { subj: 'ellas', enPrefix: 'they' },
      { subj: 'Uds.', enPrefix: 'you all' },
    ];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    sp = choice.subj;
    en = en.replace(/they\/you all/i, choice.enPrefix);
  }

  return { sp, en };
};

// --- GENERATE A FRESH RANDOM SET OF VERB QUESTIONS FROM configBlocks ---
export const generateVerbQuestions = (configBlocks, masterVerbsMap, { includeVosotros = false } = {}) => {
  let finalizedQuestions = [];

  for (const block of configBlocks || []) {
    let pool = (block.allowedVerbs || []).map((vId) => masterVerbsMap[vId]).filter(Boolean);

    if (block.specificVerb && block.specificVerb !== 'any') {
      pool = pool.filter((v) => v.palabra === block.specificVerb);
    }

    for (let i = 0; i < block.count && pool.length > 0; i++) {
      const randomVerb = pool[Math.floor(Math.random() * pool.length)];
      const chosenTense = block.tense;

      const rawSubject = getRandomSubject(block.targetSubject, includeVosotros);

      const tenseMap = randomVerb.tenses?.[chosenTense] || {};
      const subjectData = tenseMap[rawSubject] || {};

      const formAnswer = subjectData.target || '???';
      const rawEnglish = subjectData.english || randomVerb.translations?.infinitivo?.english || '';

      const { sp: finalSubject, en: finalEnglish } = formatSubjectAndTranslation(rawSubject, rawEnglish);

      finalizedQuestions.push({
        palabra: randomVerb.palabra,
        mostrar: randomVerb.palabra,
        tense: chosenTense,
        rawSubject,
        sujeto: finalSubject,
        traducción: finalEnglish,
        forma: formAnswer,
        allowedVerbs: block.allowedVerbs,
      });
    }
  }
  return finalizedQuestions;
};
