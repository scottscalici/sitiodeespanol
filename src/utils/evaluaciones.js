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
