import { QUESTION_TYPE_DEFAULTS, sumMix } from './questionTypes';

// Splits `wordCount` items across `segmentCount` segments as evenly as
// possible — remainder words go to the first segments, one each, so e.g. 25
// words / 6 segments = [5,4,4,4,4,4], not a lopsided [9,4,4,4,2,2].
export const distributeEvenly = (wordCount, segmentCount) => {
  const base = Math.floor(wordCount / segmentCount);
  const remainder = wordCount % segmentCount;
  return Array.from({ length: segmentCount }, (_, i) => base + (i < remainder ? 1 : 0));
};

// ~4 words introduced per segment — matches how vocab sections are
// actually sized in practice (low 20s to 30 words), so this rarely needs
// clamping, but never generates zero or a negative segment count for a
// pathologically small or empty section.
export const wordIntroSegmentCount = (wordCount) => Math.max(1, Math.round(wordCount / 4));

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
// (untimed, ~4 new words per segment) and an even boss-battle level (2
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
