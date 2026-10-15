// Which textbooks a student can browse in the vocabulary index, and which
// one they land on by default — S2 defaults to their current book but can
// look back at S1 material; S4 defaults to their current book but can look
// back at every earlier Descubre book too.
export const TEXTBOOK_ORDER = ['Descubre 1', 'Descubre 2', 'Descubre 3', 'Reporteros 4'];

export const DEFAULT_TEXTBOOK_BY_COURSE = { s2: 'Descubre 2', s4: 'Reporteros 4' };

export const ALLOWED_TEXTBOOKS_BY_COURSE = {
  s2: ['Descubre 1', 'Descubre 2'],
  s4: ['Descubre 1', 'Descubre 2', 'Descubre 3', 'Reporteros 4'],
};

export const getAllowedTextbooks = (course) =>
  ALLOWED_TEXTBOOKS_BY_COURSE[course] || ALLOWED_TEXTBOOKS_BY_COURSE.s2;

export const getDefaultTextbook = (course) =>
  DEFAULT_TEXTBOOK_BY_COURSE[course] || DEFAULT_TEXTBOOK_BY_COURSE.s2;

// A vocab_bundles doc's `textbook` field is whatever free-text an admin
// typed into VocabVault when adding those words — not a fixed enum — so an
// exact string match (e.g. "Reporteros 4" vs "Reporteros4" vs a trailing
// space) can silently hide a whole book's chapters from the index. This
// strips ALL whitespace (not just collapsing runs of it) before comparing,
// so a missing/extra space in how a book's name was typed doesn't split it
// into two "different" books — same leniency vocabUnitLabel.js already
// assumes elsewhere for this same field.
export const normalizeTextbookName = (name) => (name || '').trim().toLowerCase().replace(/\s+/g, '');

export const textbookMatches = (a, b) => normalizeTextbookName(a) === normalizeTextbookName(b);

// Student-facing display should always show the canonical "Reporteros 4" /
// "Descubre 1" spelling, never whatever an admin happened to type into
// VocabVault ("Reporteros4", "reporteros 4", etc.) — this maps a raw stored
// textbook name onto its canonical entry in TEXTBOOK_ORDER by the same
// whitespace-insensitive match textbookMatches uses, falling back to the
// raw name unchanged for a textbook that isn't in that list at all.
export const getCanonicalTextbookName = (name) =>
  TEXTBOOK_ORDER.find((canonical) => textbookMatches(canonical, name)) || name;
