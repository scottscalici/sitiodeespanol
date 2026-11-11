import { Fragment } from 'react';

// Lightweight markdown-style formatting for teacher-authored free text
// (Gramática Sequencer's Introducir/Repasar fields, lesson-plan notes,
// etc.) — stored as plain strings with inline markers (**bold**, _italic_,
// ~~tachado~~, __subrayado__) rather than HTML, so there's nothing to
// sanitize and no dangerouslySetInnerHTML anywhere. Double-character
// markers (bold, underline) are tried before the single-character ones
// (italic) in the same alternation so `__text__` is never misread as two
// empty `_..._` matches.
const INLINE_PATTERN = /(?:\*\*(.+?)\*\*)|(?:__(.+?)__)|(?:~~(.+?)~~)|(?:_(.+?)_)/g;

const renderInline = (line, lineKey) => {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let i = 0;
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(line)) !== null) {
    const [full, bold, underline, strike, italic] = match;
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index));
    const key = `${lineKey}-${i++}`;
    if (bold !== undefined) nodes.push(<strong key={key}>{bold}</strong>);
    else if (underline !== undefined) nodes.push(<u key={key}>{underline}</u>);
    else if (strike !== undefined) nodes.push(<s key={key}>{strike}</s>);
    else if (italic !== undefined) nodes.push(<em key={key}>{italic}</em>);
    lastIndex = match.index + full.length;
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes;
};

// Renders a plain string with inline **bold**/_italic_/~~tachado~~/__subrayado__
// markers and real line breaks into safe React nodes — drop this directly
// as a component's children (e.g. `<p>{renderFormattedText(text)}</p>`).
export const renderFormattedText = (text) => {
  if (!text) return null;
  return String(text)
    .split('\n')
    .map((line, idx) => (
      <Fragment key={idx}>
        {idx > 0 && <br />}
        {renderInline(line, idx)}
      </Fragment>
    ));
};

// A short plain-text preview of the first `wordLimit` words — for a
// one-line summary (e.g. a lesson plan's Destacado del Día entry) where
// the full body would be too long. Strips the same inline markers
// renderFormattedText displays, so a snippet never gets cut off mid-marker
// (e.g. a lone trailing "**" from a bold run that continues past the cut).
export const getTextSnippet = (text, wordLimit = 7) => {
  if (!text) return '';
  const plain = String(text)
    .replace(/\n/g, ' ')
    .replace(/(?:\*\*(.+?)\*\*)|(?:__(.+?)__)|(?:~~(.+?)~~)|(?:_(.+?)_)/g, '$1$2$3$4');
  const words = plain.trim().split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) return words.join(' ');
  return `${words.slice(0, wordLimit).join(' ')}…`;
};
