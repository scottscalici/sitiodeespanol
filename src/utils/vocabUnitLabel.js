// Reporteros calls its chapters "Unidad"; every other textbook (Descubre,
// etc.) calls them "Lección" — keyed off the textbook name itself, not the
// course code, so it stays right even if a course ever mixes textbooks.
export const getVocabUnitWord = (textbook) => (/reporteros/i.test(textbook || '') ? 'Unidad' : 'Lección');
