// The one fixed classroom layout (door/boards/screen/windows/teacher's desk
// positions, and each table's size) — matches Scott's actual room exactly.
// Students are assigned to a TABLE (a "pod"), not an individual seat within
// it, so a pod only tracks a capacity and an unordered list of student ids.
// `enLabel` is used by the student-facing seat-pick prompt (English, per
// Scott's request) — the admin builder always uses `label` (Spanish).
export const ROOM_PODS = [
  { id: 'pod_a', label: 'Mesa A', enLabel: 'Table A', capacity: 6, area: 'podA' },
  { id: 'pod_b', label: 'Mesa B', enLabel: 'Table B', capacity: 6, area: 'podB' },
  { id: 'pod_c', label: 'Mesa C', enLabel: 'Table C', capacity: 6, area: 'podC' },
  { id: 'pod_d', label: 'Mesa D', enLabel: 'Table D', capacity: 6, area: 'podD' },
  { id: 'pod_e', label: 'Mesa E', enLabel: 'Table E', capacity: 6, area: 'podE' },
  { id: 'pod_f', label: 'Mesa F', enLabel: 'Table F', capacity: 6, area: 'podF' },
];

// Tables closest to the board — used by a student's "preferFront" note when
// randomizing.
export const FRONT_POD_IDS = ['pod_a', 'pod_b'];

export const podById = (id) => ROOM_PODS.find((p) => p.id === id) || null;

// CSS grid matching the room's actual shape: door + two whiteboards + a
// screen along the top, windows down the right side, teacher's desk in the
// bottom-left corner. Used as inline `gridTemplateAreas`/columns/rows by
// both the admin builder and the student seat-pick prompt so they always
// look identical.
export const ROOM_GRID_STYLE = {
  gridTemplateColumns: '48px 1fr 1fr 1fr 48px',
  gridTemplateRows: '36px 1fr 1fr 1fr 40px',
  gridTemplateAreas: `
    "puerta board1 board2 board3 ."
    "puerta podA   .      podB   ."
    ".      .      podC   podD   ventanas"
    ".      senor  podE   podF   ventanas"
    "idtag  banner banner banner ."
  `,
};

export const chartIdFor = (course, section) => `${course}_${section}`;

// Builds a safe default chart shape when no doc exists yet in Firestore.
export const emptyAssignments = () => Object.fromEntries(ROOM_PODS.map((p) => [p.id, []]));
