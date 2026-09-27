// Suggests tags for a verb by inspecting its OWN stored presente
// conjugations against the mechanically-regular pattern for its
// infinitive ending — not a dictionary of known verbs, so it works for
// anything already conjugated in the data, including custom/rare verbs.
// These are STARTING SUGGESTIONS for a human to review, never applied
// automatically — Spanish has plenty of edge cases (radical-changing verbs
// with additional irregularities, verbs this heuristic can't confidently
// classify, etc.) this won't catch correctly.

const REGULAR_PRESENT_ENDINGS = {
  ar: { yo: 'o', tú: 'as', él_ella_ud: 'a', nosotros: 'amos', vosotros: 'áis', ellos_ellas_uds: 'an' },
  er: { yo: 'o', tú: 'es', él_ella_ud: 'e', nosotros: 'emos', vosotros: 'éis', ellos_ellas_uds: 'en' },
  ir: { yo: 'o', tú: 'es', él_ella_ud: 'e', nosotros: 'imos', vosotros: 'ís', ellos_ellas_uds: 'en' },
};

// Checked in order — e→i before e→ie doesn't matter since they're
// mutually exclusive outcomes for the same stem, but order keeps the
// more common patterns first for readability.
const STEM_CHANGE_PATTERNS = [
  { from: 'e', to: 'ie', tag: 'stem_e_ie' },
  { from: 'e', to: 'i', tag: 'stem_e_i' },
  { from: 'o', to: 'ue', tag: 'stem_o_ue' },
  { from: 'u', to: 'ue', tag: 'stem_u_ue' },
];

const BOOT_SUBJECTS = ['yo', 'tú', 'él_ella_ud', 'ellos_ellas_uds'];
const OTHER_SUBJECTS = ['tú', 'él_ella_ud', 'nosotros', 'vosotros', 'ellos_ellas_uds'];

// A reflexive verb's stored conjugation includes its pronoun as part of
// the phrase (e.g. "me visto", not just "visto") — strip it before
// comparing against the plain stem+ending pattern, or every reflexive
// verb, regular ones included, would look irregular.
const REFLEXIVE_PRONOUNS = { yo: 'me', tú: 'te', él_ella_ud: 'se', nosotros: 'nos', vosotros: 'os', ellos_ellas_uds: 'se' };

const formOf = (presente, subject, isReflexive) => {
  const raw = presente?.[subject]?.target?.trim().toLowerCase() || null;
  if (!raw) return null;
  if (!isReflexive) return raw;
  const pronoun = REFLEXIVE_PRONOUNS[subject];
  return raw.startsWith(`${pronoun} `) ? raw.slice(pronoun.length + 1) : raw;
};

export const inferVerbTags = (verb) => {
  const tags = [];
  let base = (verb?.palabra || '').trim().toLowerCase();
  if (!base) return tags;

  const isReflexive = base.endsWith('se') && base.length > 4;
  if (isReflexive) {
    tags.push('reflexivo');
    base = base.slice(0, -2);
  }

  const ending = ['ar', 'er', 'ir'].find((e) => base.endsWith(e));
  if (!ending) return tags; // unusual infinitive shape — nothing more to infer

  const stem = base.slice(0, -2);
  const endings = REGULAR_PRESENT_ENDINGS[ending];
  const presente = verb.tenses?.presente;
  if (!presente) return tags; // no presente data yet — can't infer a conjugation pattern

  // Does nosotros show the plain, unmodified stem? (Nosotros/vosotros are
  // the two forms that never show a boot-pattern stem change in Spanish,
  // so this is the most reliable anchor for "what's the real stem.")
  const nosotrosForm = formOf(presente, 'nosotros', isReflexive);
  const nosotrosRegular = !nosotrosForm || nosotrosForm === `${stem}${endings.nosotros}`;

  let stemChangeTag = null;
  if (nosotrosRegular) {
    for (const subject of BOOT_SUBJECTS) {
      const form = formOf(presente, subject, isReflexive);
      if (!form || !form.endsWith(endings[subject])) continue;
      const gotStem = form.slice(0, form.length - endings[subject].length);
      if (gotStem === stem) continue; // this boot form is regular, check the next one

      // The changing vowel is the stem's LAST occurrence of it (its
      // stressed syllable), not necessarily the stem's final character —
      // e.g. pensar's stem "pens" changes its 'e' (index 1) to "piens",
      // not a trailing 'e' the stem doesn't even have.
      const pattern = STEM_CHANGE_PATTERNS.find((p) => {
        const idx = stem.lastIndexOf(p.from);
        if (idx === -1) return false;
        const candidate = `${stem.slice(0, idx)}${p.to}${stem.slice(idx + p.from.length)}`;
        return candidate === gotStem;
      });
      if (pattern) {
        stemChangeTag = pattern.tag;
        break;
      }
    }
  }

  if (stemChangeTag) {
    tags.push(stemChangeTag);
    return tags;
  }

  if (!nosotrosRegular) {
    tags.push('irregular');
    return tags;
  }

  // No stem change detected — check whether every OTHER form matches the
  // plain regular pattern too, isolating the yo-form as its own case
  // (g-insertion like tener->tengo, -zco like conocer->conozco, etc.)
  const othersRegular = OTHER_SUBJECTS.every((s) => {
    const f = formOf(presente, s, isReflexive);
    return !f || f === `${stem}${endings[s]}`;
  });
  const yoForm = formOf(presente, 'yo', isReflexive);
  const yoRegular = !yoForm || yoForm === `${stem}${endings.yo}`;

  if (!othersRegular) {
    tags.push('irregular');
  } else if (!yoRegular) {
    tags.push('irregular_yo');
  } else {
    tags.push(`regular_${ending}`);
  }

  return tags;
};
