// Shared logic for the Kahoot-style trivia game (TriviaLobbyPage/TriviaRoomPage)
// — kept separate from those components so the question-set assembly and
// scoring formula can be reasoned about (and tested) on their own.

// Same word-code scheme as Impostor's rooms, kept as its own copy rather than
// a shared import — the two games write to entirely different collections,
// so a code collision between them is impossible, and duplicating a 20-word
// list isn't worth coupling two otherwise-unrelated games' source files.
const CODE_WORDS = [
  'GATO', 'AZUL', 'LUNA', 'PATO', 'MESA', 'LIBRO', 'PLAYA', 'VERDE',
  'RATON', 'FLOR', 'NUBE', 'RIO', 'SOL', 'ARBOL', 'PERRO', 'ROJO',
  'CIELO', 'MONTE', 'TREN', 'PAN',
];

export const generateRoomCode = () => CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];

export const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

// Builds one question's 4(-ish)-option shape from a pool entry: shuffles the
// correct answer in among up to 3 random distractors. Pool entries don't all
// have 3+ distractors (multiple_choice questions can be saved with as few as
// 1), so this gracefully makes a 2- or 3-option question rather than crash
// when a shorter entry gets drawn.
export const buildOptionsForEntry = (entry) => {
  const distractors = shuffle(entry.distractors || []).slice(0, 3);
  const options = shuffle([entry.answer, ...distractors]);
  return { options, correctIndex: options.indexOf(entry.answer) };
};

// Assembles one room's full question list from the host's picks: a set of
// {category, count} rows (each drawing that many RANDOM entries from that
// category) plus any individually hand-picked entries — deduped by id (a
// hand-pick that was also drawn at random doesn't show up twice), then
// shuffled into one final order rather than played in category blocks.
// `categoryImages` resolves each question's image via the same tiered
// lookup (own image -> category default -> none) the admin's own preview
// uses, snapshotted onto the room doc at creation time so a later edit to
// the pool or its category images doesn't retroactively alter a game
// that's already in progress.
export const buildQuestionSet = ({ allEntries, categoryRows, handPicked, categoryImages, resolveImage }) => {
  const picked = new Map();

  (handPicked || []).forEach((entry) => picked.set(entry.id, entry));

  (categoryRows || []).forEach(({ category, count }) => {
    const n = Number(count) || 0;
    if (n <= 0) return;
    const candidates = allEntries.filter((e) => e.category === category && !picked.has(e.id));
    shuffle(candidates)
      .slice(0, n)
      .forEach((entry) => picked.set(entry.id, entry));
  });

  const finalEntries = shuffle([...picked.values()]);

  return finalEntries.map((entry) => {
    const { options, correctIndex } = buildOptionsForEntry(entry);
    return {
      id: entry.id,
      clue: entry.clue,
      category: entry.category || '',
      image: resolveImage(entry, categoryImages),
      options,
      correctIndex,
    };
  });
};

// Kahoot's own formula: full points for an instant correct answer, scaling
// linearly down to half credit at the very edge of the time limit, zero for
// a wrong answer (or no answer at all). `elapsedMs` is server-timestamp
// delta (answer's recorded time minus the question's recorded start time),
// never a client clock, so network lag or an out-of-sync device clock can't
// skew who "answered fastest".
const MAX_POINTS = 1000;
export const computeTriviaPoints = (isCorrect, elapsedMs, timeLimitMs) => {
  if (!isCorrect) return 0;
  const clampedElapsed = Math.max(0, Math.min(elapsedMs, timeLimitMs));
  const fraction = 1 - (clampedElapsed / timeLimitMs) * 0.5;
  return Math.round(MAX_POINTS * fraction);
};
