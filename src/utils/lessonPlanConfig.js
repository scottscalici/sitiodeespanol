// Static bell-schedule config for the Lesson Plan page's timed agenda — the
// only two blocks Spanish is actually taught in. Add more here if the
// schedule changes; nothing else in the app depends on this.
export const TIME_BLOCKS = [
  { label: '1B', start: '7:15', end: '8:45' },
  { label: '4A/4B', start: '12:38', end: '2:09' },
];

// Default estimated minutes per agenda section — just a starting point,
// each is editable per day right on the page before printing (not saved,
// since the actual pacing varies day to day).
export const DEFAULT_DURATIONS = {
  calentamiento: 10,
  oraciones: 10,
  curiosidad: 15,
  gramatica: 15,
  evaluacion: 20,
  practica: 15,
};

const parseClock = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const formatClock = (totalMinutes) => {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')}`;
};

// Given the ordered list of agenda items actually showing today (each
// { key, minutes }), returns, per time block, a parallel list of
// "H:MM–H:MM" strings — one per agenda item — so the printed row for an
// item can show every block's clock time for it side by side.
export const computeBlockTimes = (agendaItems) => {
  const perBlock = TIME_BLOCKS.map((block) => {
    let cursor = parseClock(block.start);
    return agendaItems.map((item) => {
      const startM = cursor;
      cursor += item.minutes;
      return `${formatClock(startM)}–${formatClock(cursor)}`;
    });
  });
  // Transpose: per-item array of per-block time strings, e.g.
  // itemTimes[i] = ["7:15–7:25", "12:38–12:48"]
  return agendaItems.map((_, i) => perBlock.map((blockTimes) => blockTimes[i]));
};
