import { QUESTION_TYPE_DEFAULTS, sumMix } from './questionTypes';

// Splits `wordCount` items across `segmentCount` segments as evenly as
// possible — remainder words go to the first segments, one each, so e.g. 25
// words / 6 segments = [5,4,4,4,4,4], not a lopsided [9,4,4,4,2,2].
export const distributeEvenly = (wordCount, segmentCount) => {
  const base = Math.floor(wordCount / segmentCount);
  const remainder = wordCount % segmentCount;
  return Array.from({ length: segmentCount }, (_, i) => base + (i < remainder ? 1 : 0));
};

// ~5 words introduced per segment — matches how vocab sections are
// actually sized in practice (low 20s to 30 words), so this rarely needs
// clamping, but never generates zero or a negative segment count for a
// pathologically small or empty section.
export const wordIntroSegmentCount = (wordCount) => Math.max(1, Math.round(wordCount / 5));

// ----------------------------------------------------------------------
// Per-word sentence pinning
// ----------------------------------------------------------------------
// There's no field anywhere linking one specific sentence_bank entry to
// one specific vocab word (sentences are only tagged at the SECTION
// level — see ChapterLearningPathImporter.jsx's findPinnedSentences). The
// one usable signal is that the vocab-sentences-bulk skill always writes
// the target word itself inside the sentence's own blank — so pairing a
// sentence to "its" word means parsing that blank back out and matching
// it against the word list, same words that section's intro segments
// already introduce.

// Pulls every candidate answer string out of a sentence's blank markup —
// [[palabra]], [[forma|infinitivo]] (both sides are candidates, since a
// word's vocab entry might be its infinitive OR a form matching the
// conjugated blank), and {{a}}/{{b}} (a lógico pair; either could be the
// target word, the other is just the contrast word).
const extractBlankAnswers = (text) => {
  const answers = [];
  for (const m of (text || '').matchAll(/\[\[(.*?)\]\]/g)) {
    const inner = m[1];
    if (inner.includes('|')) {
      const [form, infinitive] = inner.split('|');
      if (form?.trim()) answers.push(form.trim());
      if (infinitive?.trim()) answers.push(infinitive.trim());
    } else if (inner.trim()) {
      answers.push(inner.trim());
    }
  }
  for (const m of (text || '').matchAll(/\{\{(.*?)\}\}/g)) {
    if (m[1]?.trim()) answers.push(m[1].trim());
  }
  return answers;
};

// Lowercase, accent-insensitive (NFD strip), punctuation-stripped — same
// normalization idea as the word-order engine's isSyntaxCorrect fix
// elsewhere in this app, since a blank's answer and a vocab word's own
// spelling can differ only by an accent depending on how each was typed.
const normalizeForMatch = (text) =>
  (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9/ ]/g, '')
    .trim();

// A vocab word's own label is always checked whole first (its full
// cleaned phrase, e.g. "idioma oficial") — critical when one word's label
// is a substring of another's ("idioma" vs "idioma oficial"): matching
// "idioma oficial" loosely by its parts would let it steal "idioma"'s own
// exact-matching sentence. Slash variants ("discriminado/a") and a
// multi-word phrase's individual words ("dominar una lengua" -> "dominar")
// are offered too, but only as a fallback once every word has already had
// a chance at an exact match (see distributeSentencesToSegments's two
// passes below).
const wordMatchCandidates = (wordLabel) => {
  const wholePhrase = normalizeForMatch(wordLabel.replace(/\(.*?\)/g, ''));
  const splitForms = wholePhrase.split(/[/ ]/).filter(Boolean);
  return [wholePhrase, ...splitForms];
};

const sentenceMatchesConcept = (sentence, concept, exactOnly = false) => {
  const answers = extractBlankAnswers(sentence.label || sentence.spanish || '').map(normalizeForMatch);
  if (answers.length === 0) return false;
  const [wholePhrase, ...fuzzyForms] = wordMatchCandidates(concept.label);
  if (exactOnly) return answers.includes(wholePhrase);
  const allForms = [wholePhrase, ...fuzzyForms];
  return answers.some((a) => allForms.some((f) => f && (a === f || a.includes(f) || f.includes(a))));
};

// Assigns each already section-matched sentence to the ONE intro segment
// that introduces its own word — never an earlier segment than the word
// itself, since a segment only ever draws from its own introduced_concepts.
// A word with no matching sentence just gets none (reported, not guessed
// at); a leftover sentence that matched no word is reported too, rather
// than silently dropped or dumped somewhere arbitrary.
//
// Two passes across EVERY word first (not segment by segment): an exact
// whole-phrase match always wins before any word falls back to the looser
// substring check, so a short word ("idioma") can't lose its own
// sentence to a longer phrase that merely contains it ("idioma oficial")
// just because that phrase happened to be matched first.
export const distributeSentencesToSegments = (introSegments, sentences) => {
  const remaining = [...(sentences || [])];
  const allConcepts = introSegments.flatMap((seg) => seg.introduced_concepts);
  const matchedSentenceByConceptId = {};

  const runPass = (exactOnly) => {
    allConcepts.forEach((concept) => {
      if (matchedSentenceByConceptId[concept.id]) return;
      const idx = remaining.findIndex((s) => sentenceMatchesConcept(s, concept, exactOnly));
      if (idx !== -1) {
        matchedSentenceByConceptId[concept.id] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });
  };
  runPass(true);
  runPass(false);

  const matchedConceptIds = new Set(Object.keys(matchedSentenceByConceptId));
  const segments = introSegments.map((seg) => {
    const pinned = seg.introduced_concepts.map((c) => matchedSentenceByConceptId[c.id]).filter(Boolean);
    return { ...seg, pinned_sentences: pinned };
  });
  const unmatchedWordIds = introSegments
    .flatMap((s) => s.introduced_concepts)
    .filter((c) => !matchedConceptIds.has(c.id))
    .map((c) => c.id);
  const unmatchedSentenceIds = remaining.map((s) => s.id);
  return { segments, unmatchedWordIds, unmatchedSentenceIds };
};

const toConcept = (word, sectionLabel) => ({
  id: word.id || word.palabra,
  label: word.palabra,
  translation: word.traduccion,
  tags: sectionLabel,
  fullData: word,
});

const makeGeneratedSegment = ({ concepts, isSpeedRound, questionMix, totalQuestions }) => {
  const mix = questionMix || QUESTION_TYPE_DEFAULTS;
  return {
    id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    total_questions: totalQuestions ?? sumMix(mix),
    questionMix: { ...mix },
    isSpeedRound,
    timeLimit: 60,
    targetTense: 'ALL',
    introduced_concepts: concepts,
    pinned_sentences: [],
  };
};

const makeGeneratedPod = (title, segments) => ({
  id: `pod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  title,
  isExpanded: true,
  badgeAward: null,
  evalLink: null,
  gateConfig: null,
  isBonus: false,
  segments,
});

// One vocab section -> two pods (levels): an odd word-introduction level
// (untimed, ~5 new words per segment) and an even boss-battle level (2
// timed 60s speed-round segments, each covering every word in the
// section). `startingLevelNumber` is the odd level's own number, so the
// pair's titles read "Nivel N" / "Nivel N+1" in sequence regardless of how
// many pods already exist in the path.
// `introQuestionMix`/`bossTotalQuestions` let the caller override the
// generated segments' defaults (see VocabPodGeneratorModal) — otherwise
// every intro segment uses QUESTION_TYPE_DEFAULTS and every boss segment's
// count is that same default's total, exactly as before.
export const generateSectionPods = (sectionLabel, words, startingLevelNumber, options = {}) => {
  const { introQuestionMix, bossTotalQuestions } = options;
  const concepts = words.map((w) => toConcept(w, sectionLabel));
  const segmentSizes = distributeEvenly(concepts.length, wordIntroSegmentCount(concepts.length));

  let cursor = 0;
  const introSegments = segmentSizes.map((size) => {
    const slice = concepts.slice(cursor, cursor + size);
    cursor += size;
    return makeGeneratedSegment({ concepts: slice, isSpeedRound: false, questionMix: introQuestionMix });
  });

  // Boss (speed-round) segments ignore questionMix at runtime (a speed
  // round always drills plain recall regardless — see WorkoutEngine), so
  // only their question COUNT is worth exposing as an override.
  const bossSegments = [
    makeGeneratedSegment({ concepts, isSpeedRound: true, totalQuestions: bossTotalQuestions }),
    makeGeneratedSegment({ concepts, isSpeedRound: true, totalQuestions: bossTotalQuestions }),
  ];

  const introPod = makeGeneratedPod(`Nivel ${startingLevelNumber}: Sección ${sectionLabel} — Palabras Nuevas`, introSegments);
  const bossPod = makeGeneratedPod(`Nivel ${startingLevelNumber + 1}: Sección ${sectionLabel} — Batalla Final`, bossSegments);

  return [introPod, bossPod];
};

// Generates pods for every chosen section, in order, numbering levels
// sequentially starting right after however many pods already exist.
export const generatePodsForSections = (sectionsWithWords, existingPodCount, options = {}) => {
  const pods = [];
  let nextLevel = existingPodCount + 1;
  sectionsWithWords.forEach(({ section, words }) => {
    const [introPod, bossPod] = generateSectionPods(section, words, nextLevel, options);
    pods.push(introPod, bossPod);
    nextLevel += 2;
  });
  return pods;
};
