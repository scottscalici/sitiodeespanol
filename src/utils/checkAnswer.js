// Shared lenient Spanish-answer checker — extracted from WorkoutEngine.jsx so
// PracticeCardEngine.jsx (and anything else that grades a typed Spanish
// answer) accepts the same accent/article/variant leniency a student
// already sees everywhere else in the app, instead of a stricter one-off
// comparison that would surprise them.

const normalize = (s, strictAccents = false) => {
  let str = s.toLowerCase().trim();
  str = str.replace(/[()]/g, '');
  str = str.replace(/[.,!?¿¡]/g, '');
  if (!strictAccents) {
    str = str.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  return str.replace(/\s+/g, ' ').trim();
};

const stripArticlesAndPronouns = (s) => {
  let res = s.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '');
  res = res.replace(/^(yo|tu|tú|el|él|ella|usted|ud|nosotros|nosotras|vosotros|vosotras|ellos|ellas|ustedes|uds)\s+/i, '');
  return res.trim();
};

// A correct answer can list several accepted forms ("el/la profesor(a)",
// "unos/unas amigos") — expands article/gender slashes and semicolon/comma
// separated alternatives into every literal string a student could type.
const generateAcceptedVariants = (correctStr) => {
  let variants = new Set();
  const parts = correctStr.split(/[;,]/).map((p) => p.trim());

  parts.forEach((part) => {
    let withParens = part.replace(/[()]/g, '');
    let withoutParens = part.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

    [withParens, withoutParens].forEach((base) => {
      if (!base) return;
      let expandedArticles = [base];
      const articleReplacements = [
        { search: 'el/la ', replace: ['el ', 'la '] },
        { search: 'los/las ', replace: ['los ', 'las '] },
        { search: 'un/una ', replace: ['un ', 'una '] },
        { search: 'unos/unas ', replace: ['unos ', 'unas '] },
      ];

      articleReplacements.forEach(({ search, replace }) => {
        if (base.toLowerCase().includes(search)) {
          expandedArticles = [
            base.replace(new RegExp(search, 'i'), replace[0]),
            base.replace(new RegExp(search, 'i'), replace[1]),
          ];
        }
      });

      expandedArticles.forEach((expBase) => {
        if (expBase.includes('/')) {
          let masc = expBase.replace(/o\/a\b/gi, 'o').replace(/os\/as\b/gi, 'os');
          let fem = expBase.replace(/o\/a\b/gi, 'a').replace(/os\/as\b/gi, 'as');
          masc = masc.replace(/([a-zñáéíóú])\/a\b/gi, '$1');
          fem = fem.replace(/([a-zñáéíóú])\/a\b/gi, '$1a');
          masc = masc.replace(/es\/as\b/gi, 'es');
          fem = fem.replace(/es\/as\b/gi, 'as');

          variants.add(masc);
          variants.add(fem);
          expBase.split('/').forEach((w) => variants.add(w.trim()));
        } else {
          variants.add(expBase);
        }
      });
    });
  });
  return Array.from(variants);
};

// Accepts an exact match, an accent-insensitive match (flagged as
// `missedAccent` when `isVerb` — a conjugation whose accent is the whole
// point), any listed variant, a leading "a " dropped, or an article/subject
// pronoun stripped from both sides (flagged as `missedArticle`).
export const checkAnswerLeniently = (userStr, correctStr, isVerb = false) => {
  if (userStr.trim().toLowerCase() === correctStr.trim().toLowerCase()) return { correct: true, missedArticle: false, missedAccent: false };

  const normUserLenient = normalize(userStr, false);
  const normCorrectLenient = normalize(correctStr, false);
  const normUserStrict = normalize(userStr, true);
  const normCorrectStrict = normalize(correctStr, true);

  if (isVerb && normUserLenient === normCorrectLenient && normUserStrict !== normCorrectStrict) {
    return { correct: false, missedArticle: false, missedAccent: true };
  }

  const validVariants = generateAcceptedVariants(correctStr);
  if (validVariants.some((ans) => normalize(userStr, isVerb) === normalize(ans, isVerb))) return { correct: true, missedArticle: false, missedAccent: false };

  const userStrippedA = userStr.replace(/^a\s+/i, '').trim();
  if (validVariants.some((ans) => normalize(userStrippedA, isVerb) === normalize(ans, isVerb))) return { correct: true, missedArticle: false, missedAccent: false };

  const userStripped = stripArticlesAndPronouns(userStr);
  const lenientMatch = validVariants.some((ans) => {
    const ansStripped = stripArticlesAndPronouns(ans);
    if (ansStripped.length === 0) return false;
    return normalize(userStripped, isVerb) === normalize(ansStripped, isVerb);
  });

  if (lenientMatch) return { correct: true, missedArticle: true, missedAccent: false };
  return { correct: false, missedArticle: false, missedAccent: false };
};
