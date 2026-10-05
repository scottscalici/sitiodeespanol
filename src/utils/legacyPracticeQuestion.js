// Practice Cards predates the shared question-type registry and saved
// questions as { type: 'mc'|'write'|'listen', correctAnswer }. The shared
// registry's equivalents are { type: 'multiple_choice'|'write'|'listen',
// answer }. Rather than migrating every already-saved Firestore doc, old
// questions are normalized to the new shape at read time — new saves always
// use the registry shape, and old cards keep working untouched.
export const normalizeLegacyPracticeQuestion = (q) => {
  if (q.type === 'mc') {
    return { type: 'multiple_choice', prompt: q.prompt, category: '', options: q.options || [], answer: q.correctAnswer };
  }
  if ((q.type === 'write' || q.type === 'listen') && q.correctAnswer !== undefined) {
    return { type: q.type, prompt: q.prompt, answer: q.correctAnswer };
  }
  return q;
};
