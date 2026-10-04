// Turns a raw, freely-typed textarea value into a clean list — one entry per
// non-empty line, trimmed. Used at save time, never while typing: a textarea
// whose `value` is always re-derived from an already-filtered array (e.g.
// re-joining with '\n' after stripping blank lines on every keystroke) can't
// let you press Enter to start a new blank line, since the empty line you
// just created gets silently stripped right back out before the next
// render — the cursor appears stuck. Keeping the raw text as its own field
// and only parsing it into a real list on save avoids that entirely.
export const parseLines = (text) => (text || '').split('\n').map((s) => s.trim()).filter(Boolean);

// Extracts "{{word}}" tokens from a raw authored passage, returning the
// blank-tokenized text the student engine renders plus the answers in order.
const ANSWER_TOKEN_REGEX = /\{\{([^{}]+)\}\}/g;
export const parseAnswerTokens = (rawText) => {
  const answers = [];
  const text = (rawText || '').replace(ANSWER_TOKEN_REGEX, (match, word) => {
    answers.push(word.trim());
    return '{{blank}}';
  });
  return { text, answers };
};
