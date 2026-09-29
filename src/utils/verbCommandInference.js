// Fills in usted/ustedes command forms from a verb's own stored subjunctive
// data — NOT a heuristic. In Spanish, the usted/ustedes command (affirmative
// AND negative) is, by definition, identical to the present subjunctive for
// that same subject (él_ella_ud / ellos_ellas_uds), with no exceptions —
// even the most irregular verbs (ser -> sea/sean, ir -> vaya/vayan) follow
// this rule exactly. So as long as subjuntivo_presente is filled in, the
// usted/ustedes commands can be derived with total confidence.
//
// Never touches yo (no such command exists), tú, nosotros, or vosotros —
// those aren't simple subjunctive copies and are out of scope here. Never
// overwrites a cell that already has something in it, in case it was
// hand-corrected for some exceptional reason.

const FORMAL_SUBJECTS = ['él_ella_ud', 'ellos_ellas_uds'];

const englishCommand = (infinitivoEnglish) => {
  const base = (infinitivoEnglish || '').trim().replace(/^to\s+/i, '');
  if (!base) return { affirmative: '', negative: '' };
  return { affirmative: `${base}!`, negative: `don't ${base}!` };
};

// Returns a patch shaped like { imperativo_afirmativo: {...}, imperativo_negativo: {...} },
// containing only the subject cells that are currently empty and have a
// subjunctive form to derive from. Returns {} if there's nothing to fill.
export const deriveFormalCommands = (verb) => {
  const subjPresente = verb?.tenses?.subjuntivo_presente || {};
  const { affirmative: affEnglish, negative: negEnglish } = englishCommand(verb?.translations?.infinitivo?.english);
  const patch = {};

  FORMAL_SUBJECTS.forEach((subject) => {
    const subjForm = subjPresente[subject]?.target?.trim();
    if (!subjForm) return;

    const existingAff = verb?.tenses?.imperativo_afirmativo?.[subject]?.target?.trim();
    if (!existingAff) {
      if (!patch.imperativo_afirmativo) patch.imperativo_afirmativo = {};
      patch.imperativo_afirmativo[subject] = { target: subjForm, english: affEnglish };
    }

    const existingNeg = verb?.tenses?.imperativo_negativo?.[subject]?.target?.trim();
    if (!existingNeg) {
      if (!patch.imperativo_negativo) patch.imperativo_negativo = {};
      patch.imperativo_negativo[subject] = { target: `no ${subjForm}`, english: negEnglish };
    }
  });

  return patch;
};
