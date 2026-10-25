// Shared logic for ¡Zas! (ZasLobbyPage room creation + ZasRoomPage gameplay)
// — kept separate from those components so word-set assembly, board layout,
// and round tallying can be reasoned about (and tested) on their own.

// Same word-code scheme as Impostor/Trivia's rooms, kept as its own copy
// rather than a shared import — see triviaGame.js's note on why (different
// collection, so a cross-game code collision can't happen; not worth
// coupling three otherwise-unrelated games' source files over one list).
const CODE_WORDS = [
  'GATO', 'AZUL', 'LUNA', 'PATO', 'MESA', 'LIBRO', 'PLAYA', 'VERDE',
  'RATON', 'FLOR', 'NUBE', 'RIO', 'SOL', 'ARBOL', 'PERRO', 'ROJO',
  'CIELO', 'MONTE', 'TREN', 'PAN',
];

export const generateRoomCode = () => CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];

export const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

// Same section-matching rule VocabVault.jsx's own chapter filter uses, so a
// host picking "Chapter 3" here pulls the same words the teacher sees
// grouped as Chapter 3 there.
const sectionMatchesTarget = (sec, targetSection) => {
  if (!targetSection || targetSection === 'all') return true;
  if (targetSection.startsWith('chapter_')) {
    const chap = targetSection.replace('chapter_', '');
    return sec === chap || sec.startsWith(`${chap}.`);
  }
  return sec === targetSection;
};

const getSectionsArray = (metadata) => {
  if (!metadata) return [];
  if (Array.isArray(metadata.secciones) && metadata.secciones.length > 0) return metadata.secciones;
  if (typeof metadata.secciones === 'string' && metadata.secciones.trim() !== '') {
    return metadata.secciones.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

// Builds a ~`count`-word target set for one session's board, drawn from the
// vocabulary collection and filtered to one textbook + section. Only the
// Spanish word itself is kept — the teacher supplies the clue live, out
// loud, so no clue/translation text needs to live on the room doc.
export const buildZasWordSet = (vocabEntries, { textbook, section, count = 20 }) => {
  const filtered = vocabEntries.filter((e) => {
    if (!e.palabra) return false;
    if (textbook && e.metadata?.textbook !== textbook) return false;
    if (!section || section === 'all') return true;
    return getSectionsArray(e.metadata).some((sec) => sectionMatchesTarget(sec, section));
  });

  return shuffle(filtered)
    .slice(0, count)
    .map((e) => ({ id: e.id, palabra: e.palabra }));
};

const FONT_VARIANTS = ['font-sans', 'font-serif', 'font-mono'];

// Computes a fresh scattered layout for whichever words are still in play —
// called once at round start and again every time a word is found, so "the
// board changes every round" (the whole point of the original paper game)
// carries over here. Positions are percentages, not pixels, so every
// device renders the identical layout the host computed, regardless of
// screen size — no per-client randomizer to keep in sync. A margin is kept
// clear of the edges so a rotated word's bounding box doesn't run off
// screen on a narrow device.
export const layoutBoard = (words) => words.map((w) => ({
  ...w,
  top: 8 + Math.random() * 78,
  left: 6 + Math.random() * 74,
  rotation: Math.round(Math.random() * 50 - 25),
  fontVariant: FONT_VARIANTS[Math.floor(Math.random() * FONT_VARIANTS.length)],
  scale: 0.85 + Math.random() * 0.4,
}));

// Tallies one round's clicks (each a {uid, name, groupId, correct, atMs}
// record from the room's rounds/{round}/clicks subcollection, `atMs`
// already resolved from a Firestore server timestamp — never a client
// clock, so no device's clock skew or network lag can change who "got
// there first") into two independent results: the fastest correct click
// WITHIN each group (that pair/trio's own round winner, blind to every
// other group) and the single fastest correct click across the whole
// room (the class-wide race). A group with no correct click yet simply
// has no entry, rather than this being forced to manufacture one — the
// host can wait and reveal again once more come in.
export const tallyRoundClicks = (clicks) => {
  const correct = (clicks || []).filter((c) => c.correct && typeof c.atMs === 'number');

  const groupWinners = {};
  let classWinner = null;
  correct.forEach((c) => {
    const currentGroupBest = groupWinners[c.groupId];
    if (!currentGroupBest || c.atMs < currentGroupBest.atMs) groupWinners[c.groupId] = c;
    if (!classWinner || c.atMs < classWinner.atMs) classWinner = c;
  });

  return { groupWinners, classWinner };
};
