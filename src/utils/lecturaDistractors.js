// Picks distractor sentences for a cultural reading's word-bank exercise,
// pulled straight from that reading's own passage so they're on-topic and
// grammatical (rather than synthesizing fake text). Excludes anything that
// overlaps with a real answer so a distractor can't accidentally double as
// a correct one.

// Accent/case/punctuation-insensitive comparison key — two strings that
// differ only in accents, case, a trailing period, or extra whitespace
// should still be treated as "the same answer" when checking for overlap.
export function normalizeForCompare(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.!?¡¿,;:"'“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractDistractors(paragraphs, realAnswers, count = 3) {
  const fullText = (paragraphs || []).join(' ');
  const rawSentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 160);

  const normalizedAnswers = (realAnswers || []).map(normalizeForCompare);
  const seen = new Set();
  const candidates = rawSentences.filter((s) => {
    const norm = normalizeForCompare(s);
    if (seen.has(norm)) return false; // drop duplicate sentences within the passage itself
    if (normalizedAnswers.some((a) => norm.includes(a) || a.includes(norm))) return false;
    seen.add(norm);
    return true;
  });

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
