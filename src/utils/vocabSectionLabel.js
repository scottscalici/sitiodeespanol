// Shared "is this the unit's reference-only section?" + display-label logic
// for metadata.secciones values. A reference section is identified by NAME
// ("<unit>.referencias", e.g. "1.referencias", "2.referencias") rather than
// by being the highest-numbered or last section — units can have a
// different number of quiz sections, so position/count is never reliable.
export const isReferenceSection = (sec) => typeof sec === 'string' && /\.referencias$/i.test(sec);

// Used everywhere a raw section string would otherwise be shown to a
// teacher or student (dropdown options, checkboxes, card badges) — renders
// a reference section as just "Referencias" instead of the raw "1.referencias".
export const formatVocabSectionLabel = (sec) => {
  if (!sec || sec === 'all') return 'All Sections';
  if (sec.startsWith('chapter_')) return `Chapter ${sec.replace('chapter_', '')}`;
  if (isReferenceSection(sec)) return 'Referencias';
  return `Section ${sec}`;
};
