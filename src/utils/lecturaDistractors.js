// Picks distractor sentences for a cultural reading's word-bank exercise,
// pulled straight from that reading's own passage so they're on-topic and
// grammatical (rather than synthesizing fake text). Excludes anything that
// overlaps with a real answer so a distractor can't accidentally double as
// a correct one.
export function extractDistractors(paragraphs, realAnswers, count = 3) {
  const fullText = (paragraphs || []).join(' ');
  const rawSentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 160);

  const normalizedAnswers = (realAnswers || []).map((a) => a.trim().toLowerCase());
  const candidates = rawSentences.filter((s) => {
    const norm = s.toLowerCase();
    return !normalizedAnswers.some((a) => norm.includes(a) || a.includes(norm));
  });

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
