// Draws reassessment questions from Sentence Bank entries instead of a Verb
// Vault group — for grammar that's really about discernment (does THIS
// context call for pretérito or imperfecto?) rather than raw conjugation
// recall, the cue phrase baked into an authored sentence IS the test, the
// same way it is on a teacher's own printed exam. Reuses the exact
// `[[forma|infinitivo]]` verb-blank marker Sentence Manager's bulk importer
// and hand editor already produce — no new authoring format, and no new
// Firestore collection.
//
// Question shape deliberately reuses the SAME field names
// generateVerbQuestions (verbQuestionGenerator.js) already produces —
// `forma` for the correct answer, `traducción` for the shown translation —
// so reassessmentData.js's gradeAnswers and ReassessmentEngine's
// finished-review grading work on a mixed verb+sentence question set with
// zero changes. Only the "what do we show above the blank" half differs
// (`subject`+`infinitive` here vs. `sujeto`+`palabra`+`tense` there), which
// ReassessmentEngine branches on via `type`.
const VERB_BLANK_RE = /\[\[(.*?)\|(.*?)\]\]/;

// `withoutReplacement` mirrors generateVerbQuestions' own option — scoped
// per block so the same sentence can't repeat within one tag's draw, but
// CAN still appear again under a different block/tag.
export const generateSentenceRecallQuestions = (blocks, sentenceBankItems, { withoutReplacement = true } = {}) => {
  const finalized = [];

  for (const block of blocks || []) {
    let pool = (sentenceBankItems || []).filter(
      (s) => (s.grammarTags || []).includes(block.tag) && VERB_BLANK_RE.test(s.spanish || '')
    );

    for (let i = 0; i < block.count && pool.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      const item = pool[randomIndex];
      if (withoutReplacement) pool = pool.filter((_, idx) => idx !== randomIndex);

      const match = (item.spanish || '').match(VERB_BLANK_RE);
      if (!match) continue; // tag matched but this one isn't actually a verb-blank sentence — skip rather than show an unanswerable blank

      const [full, targetVerb, infinitive] = match;
      finalized.push({
        type: 'sentence_recall',
        subject: item.spanish.replace(full, '________').trim(),
        infinitive: infinitive.trim(),
        traducción: item.english || '',
        forma: targetVerb.trim(),
        topic: block.label || item.grammarTags?.[0] || item.chapterId || '',
        sentenceId: item.id,
      });
    }
  }

  return finalized;
};
