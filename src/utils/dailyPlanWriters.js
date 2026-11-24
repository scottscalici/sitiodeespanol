// Write-side adapters for the Daily Control Panel — one function per
// section/type, each mirroring the EXACT safe write pattern its real admin
// tool already uses (confirmed by reading that tool's own save code, not
// guessed), so this page never invents a shape or write pattern of its own.
// Every writer invalidates the matching cache entry afterward so the
// panel's own next read reflects the change immediately.
import {
  doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { invalidateCollectionCache, invalidateDocCache } from './firestoreCache';

// ---------------- Shared helpers ----------------

// Copied verbatim from GramaticaSequencer.jsx so the comma-joined id-list
// format stays in lockstep without importing a component file here.
export const parseIds = (str) => (str || '').split(',').map((s) => s.trim()).filter(Boolean);
export const joinIds = (arr) => arr.join(', ');

// Normalizes a field that may be an array, a bare scalar, or missing —
// same shape MusicaEditor.jsx's own toArray handles for `course`/`dias`.
const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
};

// Pure — no Firestore access. This range check (is a tarea's window open on
// this day) doesn't exist anywhere reusable today; every existing consumer
// only does exact-day matches (day_due === day, day_assigned === day).
export const tareasActiveOnDay = (tareasForCourse, selectedDay) =>
  (tareasForCourse || []).filter(
    (t) => Number(t.day_assigned) <= selectedDay && Number(t.day_due) >= selectedDay
  );

// ---------------- Evaluación ----------------
// Re-reads the full per-course array fresh rather than trusting a
// caller-passed copy: EvaluacionesSequencer.jsx's own save overwrites the
// WHOLE array, so a stale read here risks clobbering a concurrent edit from
// that tool (or another browser tab) made since this page's last load.
export const setEvaluacionForDay = async (course, dia, label) => {
  const ref = doc(db, 'curriculum_tracks', 'evaluaciones_master');
  const snap = await getDoc(ref);
  const current = (snap.exists() ? snap.data()[course] : null) || [];
  const idx = current.findIndex((row) => Number(row.dia) === Number(dia));
  const nextRow = { dia: Number(dia), label };
  const next = idx === -1 ? [...current, nextRow] : current.map((row, i) => (i === idx ? nextRow : row));
  await setDoc(ref, { [course]: next }, { merge: true });
  invalidateDocCache('curriculum_tracks', 'evaluaciones_master');
};

// ---------------- Gramática ----------------
export const setGramaticaForDay = async (course, dia, { introText = '', repasoText = '', enlaces = '', recursos = '' }) => {
  const ref = doc(db, 'curriculum_tracks', 'gramatica_master');
  const snap = await getDoc(ref);
  const current = (snap.exists() ? snap.data()[course] : null) || [];
  const idx = current.findIndex((row) => Number(row.dia) === Number(dia));
  const isEmpty = !introText && !repasoText && !enlaces && !recursos;

  let next;
  if (isEmpty) {
    // Matches GramaticaSequencer.jsx's own save: a day with nothing in it
    // is dropped from the array entirely, never saved as a blank row.
    next = idx === -1 ? current : current.filter((_, i) => i !== idx);
  } else {
    const nextRow = { dia: Number(dia), introText, repasoText, enlaces, recursos };
    next = idx === -1 ? [...current, nextRow] : current.map((row, i) => (i === idx ? nextRow : row));
  }
  await setDoc(ref, { [course]: next }, { merge: true });
  invalidateDocCache('curriculum_tracks', 'gramatica_master');
};

// ---------------- Tareas ----------------
export const setTareaDueDate = async (course, taskId, newDueDay) => {
  const ref = doc(db, 'curriculum_tracks', 'tareas_master');
  const snap = await getDoc(ref);
  const current = (snap.exists() ? snap.data()[course] : null) || [];
  const next = current.map((t) => (t.id === taskId ? { ...t, day_due: Number(newDueDay) } : t));
  await setDoc(ref, { [course]: next }, { merge: true });
  invalidateDocCache('curriculum_tracks', 'tareas_master');
};

// New tareas default enforceDueDate: true, matching TareasSequencer.jsx's
// own handleCreateTask — older tareas missing this flag were grandfathered
// in on purpose (see CLAUDE.md), but there's no reason a brand-new one here
// should start out ungoverned too.
export const createTarea = async (course, task) => {
  const ref = doc(db, 'curriculum_tracks', 'tareas_master');
  const snap = await getDoc(ref);
  const current = (snap.exists() ? snap.data()[course] : null) || [];
  const newTask = {
    id: task.id || `t${task.day_assigned}-${Date.now()}`,
    day_assigned: Number(task.day_assigned),
    day_due: Number(task.day_due),
    tipo: task.tipo || 'Dominio',
    titulo: task.titulo || 'Nueva tarea',
    notas_opcionales: task.notas_opcionales || '',
    path_id: task.path_id || '',
    url: task.url || '',
    enforceDueDate: true,
    latePenaltyPerDay: task.latePenaltyPerDay ?? 10,
  };
  await setDoc(ref, { [course]: [...current, newTask] }, { merge: true });
  invalidateDocCache('curriculum_tracks', 'tareas_master');
  return newTask;
};

// ---------------- Calentamiento (verb warm-ups) ----------------
// Enforces one-per-slot: clears whichever OTHER doc for this course already
// holds this día before assigning the new one. New behavior — neither
// CalentamientoAdmin.jsx nor any other existing tool checks for this today;
// added here per explicit confirmation that this page's dropdown should
// always mean exactly one.
export const assignCalentamiento = async (course, dia, calId) => {
  const all = await getDocs(collection(db, 'calentamientos'));
  const clears = [];
  all.forEach((docSnap) => {
    const d = docSnap.data();
    if (docSnap.id !== calId && d.course === course && Number(d.dia) === Number(dia)) {
      clears.push(updateDoc(doc(db, 'calentamientos', docSnap.id), { dia: null }));
    }
  });
  await Promise.all(clears);
  await setDoc(doc(db, 'calentamientos', calId), { dia: Number(dia) }, { merge: true });
  invalidateCollectionCache('calentamientos');
};

export const unassignCalentamiento = async (calId) => {
  await updateDoc(doc(db, 'calentamientos', calId), { dia: null });
  invalidateCollectionCache('calentamientos');
};

export const assignVocabWarmup = async (course, dia, warmupId) => {
  const all = await getDocs(collection(db, 'dailyVocabWarmups'));
  const clears = [];
  all.forEach((docSnap) => {
    const d = docSnap.data();
    if (docSnap.id !== warmupId && d.course === course && Number(d.dia) === Number(dia)) {
      clears.push(updateDoc(doc(db, 'dailyVocabWarmups', docSnap.id), { dia: null }));
    }
  });
  await Promise.all(clears);
  await updateDoc(doc(db, 'dailyVocabWarmups', warmupId), { dia: Number(dia) });
  invalidateCollectionCache('dailyVocabWarmups');
};

export const unassignVocabWarmup = async (warmupId) => {
  await updateDoc(doc(db, 'dailyVocabWarmups', warmupId), { dia: null });
  invalidateCollectionCache('dailyVocabWarmups');
};

// ---------------- Curiosidad ----------------
// Mirrors CuriosidadesManager.jsx's SAFE per-item save (handleSaveQuestions):
// re-reads the bundle doc fresh immediately before writing, patches only the
// touched item, writes the whole items map back — a stale local snapshot
// can never clobber anyone else's edit. Falls back to the legacy per-doc
// shape only if the bundle doesn't exist yet, mirroring that manager's own
// isBundled branch. Deliberately does NOT clear any other item sharing this
// day — multiple curiosidades per day is a confirmed, legitimate case here,
// unlike Calentamiento/Vocab above.
const CURIOSIDADES_BUNDLE_ID = '_bundle';

export const assignCuriosidad = async (course, dia, curiosidadId) => {
  const dayField = course === 's2' ? 's2_dia' : 's4_dia';
  const value = dia === null ? null : Number(dia);
  const bundleRef = doc(db, 'curiosidades', CURIOSIDADES_BUNDLE_ID);
  const bundleSnap = await getDoc(bundleRef);
  if (bundleSnap.exists()) {
    const liveItems = bundleSnap.data()?.items || {};
    const updatedItems = {
      ...liveItems,
      [curiosidadId]: { ...(liveItems[curiosidadId] || {}), [dayField]: value },
    };
    await setDoc(bundleRef, { items: updatedItems });
  } else {
    await setDoc(doc(db, 'curiosidades', curiosidadId), { [dayField]: value }, { merge: true });
  }
  invalidateCollectionCache('curiosidades');
};

export const unassignCuriosidad = (course, curiosidadId) => assignCuriosidad(course, null, curiosidadId);

// ---------------- Conversación ----------------
// courses[]/dias[] apply independently on this doc (not paired per the real
// data model — confirmed), so assign/unassign just toggles membership in
// each set; matches ConversacionesManager.jsx's own targeted merge write.
export const setConversacionAssignment = async (conversacionId, { course, dia }, assign) => {
  const ref = doc(db, 'conversaciones', conversacionId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : { courses: [], dias: [] };
  const courses = new Set(data.courses || []);
  const dias = new Set((data.dias || []).map(Number));
  if (assign) {
    courses.add(course);
    dias.add(Number(dia));
  } else {
    dias.delete(Number(dia));
  }
  await setDoc(ref, { courses: [...courses], dias: [...dias].sort((a, b) => a - b) }, { merge: true });
  invalidateCollectionCache('conversaciones');
};

// ---------------- Lectura (lecturas_master) ----------------
// Dot-path update so only this one day's array changes — matches
// LecturasSequencer.jsx exactly, including deleteField() to actually clear
// an emptied day (setDoc+merge can't delete a nested key, only leave it
// alone). Falls back to setDoc for the doc's very first-ever write.
export const setLecturaAssignment = async (course, dia, lecturaId, assign) => {
  const ref = doc(db, 'curriculum_tracks', 'lecturas_master');
  const snap = await getDoc(ref);
  const exists = snap.exists();
  const current = exists ? (snap.data()?.[course]?.[String(dia)] || []) : [];
  const next = assign
    ? (current.includes(lecturaId) ? current : [...current, lecturaId])
    : current.filter((id) => id !== lecturaId);

  if (exists) {
    const fieldPath = `${course}.${dia}`;
    await updateDoc(ref, { [fieldPath]: next.length === 0 ? deleteField() : next });
  } else {
    await setDoc(ref, { [course]: { [String(dia)]: next } });
  }
  invalidateDocCache('curriculum_tracks', 'lecturas_master');
};

// ---------------- Música ----------------
export const setMusicaAssignment = async (musicaId, { course, dia }, assign) => {
  const ref = doc(db, 'musica', musicaId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const courseSet = new Set(toArray(data.course));
  const dias = new Set(toArray(data.dias).map(Number));
  if (assign) {
    courseSet.add(course);
    dias.add(Number(dia));
  } else {
    dias.delete(Number(dia));
  }
  await updateDoc(ref, { course: [...courseSet], dias: [...dias].sort((a, b) => a - b) });
  invalidateCollectionCache('musica');
};

// ---------------- Oraciones (sentence_sets) ----------------
// This collection has no merge-write precedent (SampleSentencesManager.jsx
// always resaves the whole doc) — load-before-edit, then resave everything,
// same as that tool.
export const setOracionesAssignment = async (setId, { course, dia }, assign) => {
  const ref = doc(db, 'sentence_sets', setId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`sentence_sets/${setId} not found`);
  const data = snap.data();
  const current = data.assignments || [];
  const matches = (a) => a.course === course && Number(a.dia) === Number(dia);
  const next = assign
    ? (current.some(matches) ? current : [...current, { course, dia: Number(dia) }])
    : current.filter((a) => !matches(a));
  await setDoc(ref, { ...data, assignments: next, updatedAt: new Date().toISOString() });
  invalidateCollectionCache('sentence_sets');
};

// ---------------- Practice (practice_cards) ----------------
// Mirrors PracticeCardsSequencer.jsx exactly: a new day+course occurrence is
// an entry in assignments[]; the card's own legacy dia/course pair (if any)
// is a separate, un-removable-by-id "occurrence #0" cleared via dia: null.
const assignmentSlug = () => `asg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const addPracticeCardAssignment = async (cardId, { course, dia, sections = null }) => {
  const ref = doc(db, 'practice_cards', cardId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().assignments || []) : [];
  const newAssignment = { id: assignmentSlug(), course, dia: Number(dia), sections };
  await updateDoc(ref, { assignments: [...current, newAssignment] });
  invalidateCollectionCache('practice_cards');
  return newAssignment;
};

export const removePracticeCardAssignment = async (cardId, assignmentId) => {
  const ref = doc(db, 'practice_cards', cardId);
  if (assignmentId == null) {
    await updateDoc(ref, { dia: null });
  } else {
    const snap = await getDoc(ref);
    const current = snap.exists() ? (snap.data().assignments || []) : [];
    await updateDoc(ref, { assignments: current.filter((a) => a.id !== assignmentId) });
  }
  invalidateCollectionCache('practice_cards');
};

// ---------------- Video ----------------
// A video only ever holds ONE día at a time (confirmed — not an array like
// Conversación/Música), so "assign" always replaces it outright; no
// one-per-slot clearing needed since nothing else can claim it simultaneously.
export const setVideoAssignment = async (videoId, { course, dia }, assign) => {
  const ref = doc(db, 'videos', videoId);
  if (!assign) {
    await setDoc(ref, { dia: null }, { merge: true });
    invalidateCollectionCache('videos');
    return;
  }
  const snap = await getDoc(ref);
  const tags = new Set((snap.exists() ? snap.data().tags : null) || []);
  tags.add(course);
  await setDoc(ref, { tags: [...tags], dia: Number(dia) }, { merge: true });
  invalidateCollectionCache('videos');
};

// ---------------- Audio (new) ----------------
// Same shape/pattern as Video, against the new audio_clips collection.
export const setAudioAssignment = async (audioId, { course, dia }, assign) => {
  const ref = doc(db, 'audio_clips', audioId);
  if (!assign) {
    await setDoc(ref, { dia: null }, { merge: true });
    invalidateCollectionCache('audio_clips');
    return;
  }
  const snap = await getDoc(ref);
  const tags = new Set((snap.exists() ? snap.data().tags : null) || []);
  tags.add(course);
  await setDoc(ref, { tags: [...tags], dia: Number(dia) }, { merge: true });
  invalidateCollectionCache('audio_clips');
};
