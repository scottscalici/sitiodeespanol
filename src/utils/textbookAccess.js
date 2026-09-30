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
