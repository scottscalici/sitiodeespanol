// Draws reassessment questions straight from the `vocabulary` collection for
// a vocab-quiz makeup — "translate this English word into Spanish," the same
// drill a student already does in a section's all-escribir practice circle.
// A vocabulary doc is tagged by section via `metadata.secciones` (e.g.
// ["2.1"]), the same field FormLearningPath's own vault picker filters on —
// so a block here is just { section, count }, no new tagging convention.
//
// Question shape reuses the SAME field names generateVerbQuestions and
// generateSentenceRecallQuestions already use — `forma` for the correct
// answer(s), so reassessmentData.js's gradeAnswers needs no changes to grade
// a mix of all three question sources. The accepted-answer join mirrors
// WorkoutEngine's own vocab 'write' format (`[spaWord, ...altAnswers].join(',
// ')`), so alt_answers synonyms are accepted here exactly as they are in
// normal practice.
export const generateVocabRecallQuestions = (blocks, vocabularyItems, { withoutReplacement = true } = {}) => {
  const finalized = [];

  for (const block of blocks || []) {
    let pool = (vocabularyItems || []).filter((v) => (v.metadata?.secciones || []).includes(block.section));

    for (let i = 0; i < block.count && pool.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      const item = pool[randomIndex];
      if (withoutReplacement) pool = pool.filter((_, idx) => idx !== randomIndex);

      const altAnswers = (item.alt_answers || []).map((a) => (a || '').trim()).filter(Boolean);
      finalized.push({
        type: 'vocab_recall',
        prompt: item.traduccion || '',
        forma: [item.palabra, ...altAnswers].join(', '),
        topic: block.label || block.section,
        vocabId: item.id,
      });
    }
  }

  return finalized;
};
