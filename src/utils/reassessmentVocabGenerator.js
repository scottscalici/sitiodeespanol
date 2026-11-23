// Draws reassessment questions straight from the `vocabulary` collection for
// a vocab-quiz makeup — "translate this English word into Spanish," the same
// drill a student already does in a section's all-escribir practice circle.
// A vocabulary doc is tagged by section via `metadata.secciones` (e.g.
// ["2.1"]), the same field FormLearningPath's own vault picker filters on —
// so a block here is just { section, count }, no new tagging convention.
//
// BUT section labels are free-text per textbook and NOT course-unique — S2's
// Descubre book and S4's Reporteros 4 book can each independently use "2.1"
// in their own numbering. A section-only filter (the original bug here) lets
// an S2 vocab reassessment silently pull in S4 words tagged with the same
// section string. `block.textbook` (the specific book a gated circle is
// actually about, when known) and `block.allowedTextbooks` (the course-level
// fallback from textbookAccess.js's getAllowedTextbooks, always known at
// quiz time via config.course) both narrow the pool — see
// ChapterLearningPathImporter.jsx's `sectionWords` filter for the same
// section+textbook pairing done correctly elsewhere.
//
// Question shape reuses the SAME field names generateVerbQuestions and
// generateSentenceRecallQuestions already use — `forma` for the correct
// answer(s), so reassessmentData.js's gradeAnswers needs no changes to grade
// a mix of all three question sources. The accepted-answer join mirrors
// WorkoutEngine's own vocab 'write' format (`[spaWord, ...altAnswers].join(',
// ')`), so alt_answers synonyms are accepted here exactly as they are in
// normal practice.
import { textbookMatches } from './textbookAccess';

export const generateVocabRecallQuestions = (blocks, vocabularyItems, { withoutReplacement = true } = {}) => {
  const finalized = [];

  for (const block of blocks || []) {
    let pool = (vocabularyItems || []).filter((v) => {
      if (!(v.metadata?.secciones || []).includes(block.section)) return false;
      if (block.textbook) return textbookMatches(v.metadata?.textbook, block.textbook);
      if (block.allowedTextbooks?.length) {
        return block.allowedTextbooks.some((t) => textbookMatches(v.metadata?.textbook, t));
      }
      return true;
    });

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
