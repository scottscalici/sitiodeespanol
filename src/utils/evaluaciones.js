import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// The evaluación calendar a teacher edits in the Evaluaciones Sequencer
// (curriculum_tracks/evaluaciones_master: { s2: [{dia,label}], s4: [{dia,label}] } ).
// Practice Hub circles can optionally link to one of these entries so the
// student-side "quiz order" view can sort by when a topic is actually
// quizzed instead of just its textbook chapter order. "Nada" rows are
// placeholders for days with no evaluación and are never a valid link target.
export const fetchEvaluacionOptions = async (course) => {
  try {
    const snap = await getDoc(doc(db, 'curriculum_tracks', 'evaluaciones_master'));
    if (!snap.exists()) return [];
    const rows = snap.data()?.[course] || [];
    return rows
      .filter((r) => r.label && r.label !== 'Nada')
      .map((r) => ({ dia: Number(r.dia), label: r.label }))
      .sort((a, b) => a.dia - b.dia);
  } catch (err) {
    console.error('Error fetching evaluación options:', err);
    return [];
  }
};

// A pod's evalLink ({dia, label}) is saved once when an admin picks it in
// the Pod Creator — it does NOT live-update on its own. If the teacher later
// edits the Evaluaciones Sequencer (pushes a quiz to a different día, swaps
// two días' labels), the pod's stored `dia` would silently go stale. Callers
// that sort/display by día should resolve the CURRENT día live instead of
// trusting the stored one: look up whichever día in a fresh
// fetchEvaluacionOptions() result currently carries this exact label text.
// Falls back to the stored día only if that label can no longer be found
// anywhere in the current calendar (most likely because it was reworded,
// not just moved) — stale-but-visible beats disappearing entirely.
export const resolveCurrentEvalDia = (currentOptions, evalLink) => {
  if (!evalLink) return null;
  const match = currentOptions.find((o) => o.label === evalLink.label);
  return match ? match.dia : evalLink.dia;
};
