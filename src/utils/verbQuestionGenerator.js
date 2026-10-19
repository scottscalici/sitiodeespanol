// Shared verb-question generator, extracted from CalentamientoAdmin.jsx so
// the student engine can re-run the exact same random draw (using a
// warmup's saved configBlocks) to produce a fresh verb set on a redo,
// without any extra admin action.

// --- SMART SUBJECT PICKER (70/30 Singular/Plural, Vosotros Controlled) ---
// `availableSubjects` is whichever persons this specific verb+tense actually
// has a saved conjugation for (VerbEditor leaves a subject's cell out
// entirely when it doesn't apply — e.g. "tú" for the impersonal "haber" in
// the preterite, which is only ever "hubo"). Picking blind from a fixed
// 6-person roster meant a verb missing a person could still get asked about
// it, with no real answer to show. Returns null when there's nothing valid
// to ask (an explicit subject with no data, or a verb with no data at all
// for this tense) so the caller can skip that draw instead of faking one.
export const getRandomSubject = (targetPref, availableSubjects, includeVosotros = false) => {
  if (targetPref !== 'any') return availableSubjects.includes(targetPref) ? targetPref : null;

  const singulars = ['yo', 'tú', 'él_ella_ud'].filter((s) => availableSubjects.includes(s));
  const plurals = (includeVosotros
    ? ['nosotros', 'vosotros', 'ellos_ellas_uds']
    : ['nosotros', 'ellos_ellas_uds']
  ).filter((s) => availableSubjects.includes(s));

  // 70% chance for singular, 30% for plural — falling back to whichever
  // category actually has data if the preferred one doesn't (e.g. a verb
  // that's only ever conjugated in the singular).
  const preferSingular = Math.random() < 0.7;
  const primary = preferSingular ? singulars : plurals;
  const secondary = preferSingular ? plurals : singulars;
  const chosen = primary.length > 0 ? primary : secondary;
  return chosen.length > 0 ? chosen[Math.floor(Math.random() * chosen.length)] : null;
};

// English 3rd-person-singular present tense conjugation (he/she — never
// "you") for the handful of irregular verbs plus the standard -s/-es/-ies
// spelling rules. Only English's SIMPLE PRESENT actually conjugates for
// person ("he/she speaks" vs "you speak") — every other tense (preterite,
// future, subjunctive...) uses one shared form regardless of subject, which
// is why callers must gate this on tense === 'presente' and never call it
// for any other tense (e.g. "he spoke", not "he spokes").
const IRREGULAR_THIRD_PERSON = { be: 'is', are: 'is', have: 'has', do: 'does', go: 'goes' };
const conjugateThirdPersonSingular = (verb) => {
  const lower = verb.toLowerCase();
  if (IRREGULAR_THIRD_PERSON[lower]) return IRREGULAR_THIRD_PERSON[lower];
  if (/(?:[sxz]|[cs]h)$/i.test(verb)) return `${verb}es`;
  if (/[^aeiou]y$/i.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
};

// --- HELPERS TO CLEAN UP 3RD PERSON SUBJECTS ---
export const formatSubjectAndTranslation = (rawSubject, rawEnglish, tense) => {
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
    // instead of silently leaving "he/she/you" unreplaced. Only the FIRST
    // word after the placeholder is ever touched (e.g. "bring closer" ->
    // "brings closer"), so a multi-word phrasal translation never gets a
    // stray "s" tacked onto its last word.
    en = en.replace(/he\/she\/you(\s+\S+)?/i, (_match, tail) => {
      if (!tail) return choice.enPrefix;
      const [, space, verb] = tail.match(/^(\s+)(\S+)$/);
      const word = choice.conjugate && tense === 'presente' ? conjugateThirdPersonSingular(verb) : verb;
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

      const tenseMap = randomVerb.tenses?.[chosenTense] || {};
      const availableSubjects = Object.keys(tenseMap);
      const rawSubject = getRandomSubject(block.targetSubject, availableSubjects, includeVosotros);

      // No saved conjugation for this verb+tense+subject (either this draw
      // landed on a person that doesn't apply, or the verb has nothing at
      // all for this tense) — skip rather than show an unanswerable "???".
      if (!rawSubject) continue;

      const subjectData = tenseMap[rawSubject];
      const formAnswer = subjectData.target;
      const rawEnglish = subjectData.english || randomVerb.translations?.infinitivo?.english || '';

      const { sp: finalSubject, en: finalEnglish } = formatSubjectAndTranslation(rawSubject, rawEnglish, chosenTense);

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
