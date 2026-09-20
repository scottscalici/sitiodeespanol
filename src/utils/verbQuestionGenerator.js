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

// --- HELPERS TO CLEAN UP 3RD PERSON SUBJECTS ---
export const formatSubjectAndTranslation = (rawSubject, rawEnglish) => {
  let sp = rawSubject;
  let en = rawEnglish || 'Sin traducción';

  if (rawSubject === 'él_ella_ud') {
    const choices = [
      { subj: 'él', enPrefix: 'he' },
      { subj: 'ella', enPrefix: 'she' },
      { subj: 'Ud.', enPrefix: 'you (formal)' },
    ];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    sp = choice.subj;
    en = en.replace(/he\/she\/you/i, choice.enPrefix);
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
