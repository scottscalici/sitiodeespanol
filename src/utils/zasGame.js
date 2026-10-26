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
// vocabulary collection and filtered to one textbook + section. The
// teacher supplies the actual clue live, out loud — `hint` is only a
// private on-screen nudge for her, reusing whichever tiered definition the
// word already has in Vocab Vault rather than writing new clue text from
// scratch. Preferring nivel2 (a plain-Spanish definition, one notch above
// the simplest tier) over nivel1 (English-leaning) or nivel3 (the densest,
// most literal phrasing) — nivel1 risks just handing her the translation,
// and nivel3 is dictionary-style, which, read as a nudge, often struggles
// to be an interesting starting point for an ad-libbed description.
export const buildZasWordSet = (vocabEntries, { textbook, section, count = 20 }) => {
  const filtered = vocabEntries.filter((e) => {
    if (!e.palabra) return false;
    if (textbook && e.metadata?.textbook !== textbook) return false;
    if (!section || section === 'all') return true;
    return getSectionsArray(e.metadata).some((sec) => sectionMatchesTarget(sec, section));
  });

  return shuffle(filtered)
    .slice(0, count)
    .map((e) => ({
      id: e.id,
      palabra: e.palabra,
      traduccion: e.traduccion || '',
      hint: e.definiciones?.nivel2?.[0] || e.definiciones?.nivel1?.[0] || e.definiciones?.nivel3?.[0] || '',
    }));
};

const FONT_VARIANTS = ['font-sans', 'font-serif', 'font-mono'];

// Computes a fresh scattered layout for whichever words are still in play —
// called once at round start and again every time a word is found, so "the
// board changes every round" (the whole point of the original paper game)
// carries over here. Positions are percentages, not pixels, so every
// device renders the identical layout the host computed, regardless of
// screen size — no per-client randomizer to keep in sync.
//
// Each word gets its own cell in a shuffled grid (sized to roughly match
// the board's landscape aspect ratio) with only a small jitter and a
// moderate rotation inside that cell, rather than a fully free-floating
// random position — a free-for-all randomizer packed words on top of each
// other badly enough that one could fully cover another and make it
// unclickable. Longer words get less rotation and a smaller scale, since a
// long word rotated far has a much bigger diagonal footprint and is the
// most likely to spill out of its own cell into a neighbor's.
export const layoutBoard = (words) => {
  const count = words.length;
  if (count === 0) return [];

  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.6)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push({ r, c });
  }
  const assignedCells = shuffle(cells).slice(0, count);

  return words.map((w, i) => {
    const { r, c } = assignedCells[i];
    const jitterX = (Math.random() - 0.5) * cellW * 0.3;
    const jitterY = (Math.random() - 0.5) * cellH * 0.3;
    const lengthFactor = Math.max(0.4, 1 - Math.max(0, (w.palabra?.length || 0) - 6) * 0.05);

    return {
      ...w,
      top: Math.min(95, Math.max(5, r * cellH + cellH / 2 + jitterY)),
      left: Math.min(93, Math.max(7, c * cellW + cellW / 2 + jitterX)),
      rotation: Math.round((Math.random() * 30 - 15) * lengthFactor),
      fontVariant: FONT_VARIANTS[Math.floor(Math.random() * FONT_VARIANTS.length)],
      scale: (0.85 + Math.random() * 0.3) * lengthFactor,
    };
  });
};

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
