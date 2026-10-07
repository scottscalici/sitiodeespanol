import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLessonPlanData } from '../../hooks/useLessonPlanData';
import { TIME_BLOCKS, DEFAULT_DURATIONS, computeBlockTimes } from '../../utils/lessonPlanConfig';

const MAX_DAYS = 80;
const SERIF = '"Baskerville Old Face", "Libre Baskerville", Georgia, serif';

// Order matches how the class period actually runs: quizzes/evaluación
// first thing, then the daily-routine trio (calentamiento, curiosidad,
// gramática), then the rest. Anuncios (rendered separately, above this
// list) and tarea (rendered separately, below it) aren't in this array.
const SECTION_DEFS = [
  { key: 'evaluacion', label: 'Evaluación', icon: '🎯' },
  { key: 'calentamiento', label: 'Calentamiento', icon: '⏱️' },
  { key: 'curiosidad', label: 'Curiosidad', icon: '💡' },
  { key: 'gramatica', label: 'Gramática / Estructuras', icon: '📚' },
  { key: 'practica', label: 'Práctica', icon: '✏️' },
  { key: 'oraciones', label: 'Oraciones de Práctica', icon: '✍️' },
  { key: 'actividades', label: 'Actividades (Video/Lectura/Conversación)', icon: '🎬' },
  { key: 'destacado', label: 'Destacado del Día', icon: '🌟' },
];

const emptyNotes = () => Object.fromEntries([...SECTION_DEFS.map((s) => s.key), 'tarea'].map((k) => [k, '']));

export default function LessonPlanPage() {
  const [course, setCourse] = useState('s2');
  const [selectedDay, setSelectedDay] = useState(1);
  const planData = useLessonPlanData(course, selectedDay);

  const [durations, setDurations] = useState(DEFAULT_DURATIONS);
  const [notes, setNotes] = useState(emptyNotes());
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesStatus, setNotesStatus] = useState('');

  // Per-day/course notes — loaded fresh whenever the day or course changes,
  // saved explicitly via the button (not on every keystroke).
  useEffect(() => {
    const noteId = `${course}_d${selectedDay}`;
    setNotesStatus('');
    getDoc(doc(db, 'lesson_plan_notes', noteId))
      .then((snap) => setNotes(snap.exists() ? { ...emptyNotes(), ...snap.data().notes } : emptyNotes()))
      .catch((err) => console.error('Error loading lesson plan notes:', err));
  }, [course, selectedDay]);

  const saveNotes = async () => {
    setNotesSaving(true);
    setNotesStatus('');
    try {
      const noteId = `${course}_d${selectedDay}`;
      // merge:true — the Formal plan view writes its own `objectives` field
      // to this same per-day doc, so a plain overwrite here would erase it.
      await setDoc(doc(db, 'lesson_plan_notes', noteId), { course, dia: selectedDay, notes, updatedAt: new Date().toISOString() }, { merge: true });
      setNotesStatus('✅ Notas guardadas.');
    } catch (err) {
      console.error('Error saving lesson plan notes:', err);
      setNotesStatus('❌ Error al guardar.');
    } finally {
      setNotesSaving(false);
    }
  };

  const updateNote = (key, value) => setNotes((prev) => ({ ...prev, [key]: value }));
  const updateDuration = (key, value) => setDurations((prev) => ({ ...prev, [key]: Math.max(0, Number(value) || 0) }));

  if (planData.loading) {
    return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">Cargando Plan de Lección...</div>;
  }

  // --- Build each section's summary content ---
  const sectionContent = {
    destacado:
      planData.destacado.length === 0 ? null : (
        <ul className="list-disc pl-5 space-y-1">
          {planData.destacado.map((d) => (
            <li key={d.id}>
              <span className="font-bold">{d.header || d.type}</span>
              {d.word_of_the_day?.word && (
                <> — palabra del día: <span className="italic">{d.word_of_the_day.word}</span>{d.word_of_the_day.translation ? ` (${d.word_of_the_day.translation})` : ''}</>
              )}
            </li>
          ))}
        </ul>
      ),
    calentamiento:
      planData.calentamiento.verbs.length + planData.calentamiento.vocab.length === 0 ? null : (
        <div className="space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            {planData.calentamiento.verbs.map((c) => (
              <li key={`v-${c.id}`}>Verbos: {c.title} ({c.bakedQuestions?.length || 0} preguntas)</li>
            ))}
            {planData.calentamiento.vocab.map((v) => (
              <li key={`voc-${v.id}`}>Vocabulario: {v.name} ({v.sequence?.length || 0} términos)</li>
            ))}
          </ul>
          {planData.calentamiento.verbList && <p className="text-xs leading-relaxed font-sans text-gray-700 mt-2">{planData.calentamiento.verbList}</p>}
          {planData.calentamiento.vocabList && <p className="text-xs leading-relaxed font-sans text-gray-700 mt-1">{planData.calentamiento.vocabList}</p>}
        </div>
      ),
    oraciones:
      planData.oraciones.length === 0 ? null : (
        <ul className="list-disc pl-5 space-y-1">
          {planData.oraciones.map((s) => (
            <li key={s.id}>{s.title || 'Oraciones'} ({(s.lines || []).length} oraciones)</li>
          ))}
        </ul>
      ),
    curiosidad:
      planData.curiosidad.length === 0 ? null : (
        <ul className="list-disc pl-5 space-y-1">
          {planData.curiosidad.map((c) => (
            <li key={c.id}>{c.title}{c.teacher_notes ? ` — ${c.teacher_notes}` : ''}</li>
          ))}
        </ul>
      ),
    actividades:
      (() => {
        const { videos, conversaciones, musica, cultura, lecturas } = planData.actividades;
        if (videos.length + conversaciones.length + musica.length + cultura.length + lecturas.length === 0) return null;
        return (
          <ul className="list-disc pl-5 space-y-1">
            {videos.map((v) => <li key={`vid-${v.id}`}>🎬 Video: {v.title}</li>)}
            {conversaciones.map((c) => <li key={`conv-${c.id}`}>🗣️ Conversación: {c.titulo}</li>)}
            {musica.map((m) => <li key={`mus-${m.id}`}>🎵 Música: {m.titulo}</li>)}
            {cultura.map((c) => <li key={`cul-${c.id}`}>🌎 Cultura: {c.titulo}</li>)}
            {lecturas.map((l) => <li key={`lec-${l.id}`}>📖 Lectura: {l.subtitulo || 'Comprensión de Lectura'}</li>)}
          </ul>
        );
      })(),
    gramatica:
      planData.gramatica.length === 0 ? null : (
        <div className="space-y-2">
          {planData.gramatica.map((g, idx) => (
            <div key={idx}>
              {g.introText && <p><span className="font-bold">Introducir:</span> {g.introText}</p>}
              {g.repasoText && <p><span className="font-bold">Repasar:</span> {g.repasoText}</p>}
            </div>
          ))}
        </div>
      ),
    evaluacion:
      planData.evaluacion.length === 0 ? null : (
        <ul className="list-disc pl-5 space-y-1">
          {planData.evaluacion.map((e, idx) => (
            <li key={idx} className="font-bold">{e.label}</li>
          ))}
        </ul>
      ),
    practica:
      planData.practica.length === 0 ? null : (
        <ul className="list-disc pl-5 space-y-1">
          {planData.practica.map((p) => (
            <li key={p.id}>{p.title} ({p.questions?.length || 0} preguntas)</li>
          ))}
        </ul>
      ),
  };

  // Only sections with real content today get a timed slot.
  const agendaSections = SECTION_DEFS.filter((s) => sectionContent[s.key] !== null);
  const agendaItems = agendaSections.map((s) => ({ key: s.key, minutes: durations[s.key] }));
  const blockTimesPerItem = computeBlockTimes(agendaItems);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white" style={{ fontFamily: SERIF }}>
      {/* Floating controls — hidden when printing */}
      <div className="print:hidden fixed top-6 right-6 flex flex-wrap items-center gap-3 bg-slate-100 p-3 rounded-xl shadow-lg border border-slate-300 font-sans z-50 max-w-sm">
        <Link to="/admin-daily-plan-hub" className="text-slate-500 hover:text-slate-800 text-xs font-bold">← Hub</Link>
        <div className="flex bg-white rounded-lg overflow-hidden border border-slate-300">
          <button onClick={() => setCourse('s2')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${course === 's2' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>S2</button>
          <button onClick={() => setCourse('s4')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${course === 's4' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>S4</button>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2 py-1">
          <button onClick={() => setSelectedDay((d) => Math.max(1, d - 1))} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-600">-</button>
          <select value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))} className="text-sm font-black outline-none">
            {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>Día {d}</option>
            ))}
          </select>
          <button onClick={() => setSelectedDay((d) => Math.min(MAX_DAYS, d + 1))} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-600">+</button>
        </div>
        <button onClick={saveNotes} disabled={notesSaving} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest">
          {notesSaving ? 'Guardando...' : '💾 Guardar Notas'}
        </button>
        <button onClick={() => window.print()} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest">
          🖨️ Imprimir
        </button>
        <Link to={`/admin-lesson-plan-formal/${course}/${selectedDay}`} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest text-center">
          🏛️ Plan Formal
        </Link>
        {notesStatus && <p className="text-[10px] font-bold text-slate-600 w-full">{notesStatus}</p>}
      </div>

      <div className="max-w-4xl mx-auto bg-white text-black p-8 print:p-0 print:max-w-full text-left" style={{ minHeight: '100vh' }}>
        {/* Letterhead */}
        <div className="border-b-2 border-black pb-4 mb-8 print:mt-0 mt-24">
          <div className="flex justify-between items-end mb-2">
            <h1 className="text-4xl font-bold">Plan de Lección</h1>
            <h2 className="text-xl italic text-gray-700">{course === 's2' ? 'Spanish 2' : 'Spanish 4'}</h2>
          </div>
          <div className="flex justify-between items-center text-lg">
            <p>Día {selectedDay} — {planData.activeDatesDisplay}</p>
            <p>{TIME_BLOCKS.map((b) => `${b.label}: ${b.start}–${b.end}`).join('  ·  ')}</p>
          </div>
        </div>

        {/* Anuncios — plain script to read at the start of class, no
            styling/images/links (those live in the student-facing card). */}
        {planData.anuncios.length > 0 && (
          <div className="mb-8 border-b border-gray-300 pb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">📢 Anuncios</h3>
            {planData.anuncios.map((a) => (
              <p key={a.id} className="text-base">{a.text}</p>
            ))}
          </div>
        )}

        {/* Timed agenda */}
        {agendaSections.length === 0 ? (
          <p className="italic text-gray-500 mb-8">No hay contenido automático asignado para este día.</p>
        ) : (
          <div className="space-y-6 mb-8">
            {agendaSections.map((s, idx) => (
              <div key={s.key} className="break-inside-avoid border border-gray-300 rounded-lg p-4">
                <div className="flex justify-between items-start gap-4 border-b border-gray-200 pb-2 mb-2">
                  <h3 className="text-lg font-bold uppercase tracking-wide">{s.icon} {s.label}</h3>
                  <div className="flex items-center gap-2 shrink-0 text-sm font-mono text-gray-600">
                    <span>{blockTimesPerItem[idx].join('  /  ')}</span>
                    <span className="print:hidden flex items-center gap-1 font-sans">
                      (<input
                        type="number"
                        min="0"
                        value={durations[s.key]}
                        onChange={(e) => updateDuration(s.key, e.target.value)}
                        className="w-12 border border-gray-300 rounded p-0.5 text-center"
                      /> min)
                    </span>
                  </div>
                </div>
                <div className="text-base">{sectionContent[s.key]}</div>
                <textarea
                  value={notes[s.key]}
                  onChange={(e) => updateNote(s.key, e.target.value)}
                  placeholder="Notas..."
                  rows={2}
                  className="w-full mt-3 border border-gray-200 rounded p-2 text-sm font-sans print:border-gray-400"
                />
              </div>
            ))}
          </div>
        )}

        {/* Sections with no content today — still listed for a complete record */}
        {SECTION_DEFS.filter((s) => sectionContent[s.key] === null).length > 0 && (
          <div className="mb-8 text-sm text-gray-500 italic">
            Sin contenido automático hoy: {SECTION_DEFS.filter((s) => sectionContent[s.key] === null).map((s) => s.label).join(', ')}.
          </div>
        )}

        {/* Tarea — reference list, not timed */}
        <div className="break-inside-avoid border-t-2 border-black pt-4">
          <h3 className="text-lg font-bold uppercase tracking-wide mb-2">📝 Tarea</h3>
          {planData.tarea.dueToday.length === 0 && planData.tarea.assignedTodayDueLater.length === 0 ? (
            <p className="italic text-gray-500">Sin tareas relevantes hoy.</p>
          ) : (
            <div className="space-y-3 text-base">
              {planData.tarea.dueToday.length > 0 && (
                <div>
                  <p className="font-bold">Vence hoy:</p>
                  <ul className="list-disc pl-5">
                    {planData.tarea.dueToday.map((t) => (
                      <li key={t.id}>{t.titulo} ({t.tipo})</li>
                    ))}
                  </ul>
                </div>
              )}
              {planData.tarea.assignedTodayDueLater.length > 0 && (
                <div>
                  <p className="font-bold">Asignada hoy (vence después):</p>
                  <ul className="list-disc pl-5">
                    {planData.tarea.assignedTodayDueLater.map((t) => (
                      <li key={t.id}>{t.titulo} ({t.tipo}) — vence Día {t.day_due}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <textarea
            value={notes.tarea}
            onChange={(e) => updateNote('tarea', e.target.value)}
            placeholder="Notas..."
            rows={2}
            className="w-full mt-3 border border-gray-200 rounded p-2 text-sm font-sans print:border-gray-400"
          />
        </div>
      </div>
    </div>
  );
}
