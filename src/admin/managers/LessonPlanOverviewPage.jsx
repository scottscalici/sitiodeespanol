import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLessonPlanRange } from '../../hooks/useLessonPlanData';

const MAX_DAYS = 80;
const SERIF = '"Baskerville Old Face", "Libre Baskerville", Georgia, serif';

// A condensed, multi-day planning overview — unlike the daily Plan de
// Lección page (one day, full detail, specific verbs/vocab words spelled
// out), this prints a whole range of class days on a page or two: just
// titles/labels for each section, so a teacher can see their pacing across
// a week-plus of actual class meetings at a glance. "Día N" is already a
// class-meeting index (not a calendar date — see useLessonPlanData.js), so
// a plain day-number range never includes a day the class doesn't meet.
export default function LessonPlanOverviewPage() {
  const [course, setCourse] = useState('s2');
  const [startDay, setStartDay] = useState(1);
  const [endDay, setEndDay] = useState(5);
  const { loading, days } = useLessonPlanRange(course, startDay, endDay);

  const [notes, setNotes] = useState({});
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesStatus, setNotesStatus] = useState('');

  // One overview note per day, stored on the same per-day doc the daily
  // page's section notes and the formal page's objectives already share
  // (merge:true everywhere so none of the three views clobber the others).
  useEffect(() => {
    let cancelled = false;
    setNotesStatus('');
    const dayNums = Array.from({ length: Math.max(0, endDay - startDay + 1) }, (_, i) => startDay + i);
    Promise.all(dayNums.map((d) => getDoc(doc(db, 'lesson_plan_notes', `${course}_d${d}`)).then((snap) => [d, snap.exists() ? snap.data().overviewNote || '' : ''])))
      .then((entries) => { if (!cancelled) setNotes(Object.fromEntries(entries)); })
      .catch((err) => console.error('Error loading overview notes:', err));
    return () => { cancelled = true; };
  }, [course, startDay, endDay]);

  const updateNote = (dayNum, value) => setNotes((prev) => ({ ...prev, [dayNum]: value }));

  const saveNotes = async () => {
    setNotesSaving(true);
    setNotesStatus('');
    try {
      await Promise.all(
        Object.entries(notes).map(([d, overviewNote]) =>
          setDoc(doc(db, 'lesson_plan_notes', `${course}_d${d}`), { course, dia: Number(d), overviewNote, updatedAt: new Date().toISOString() }, { merge: true })
        )
      );
      setNotesStatus('✅ Notas guardadas.');
    } catch (err) {
      console.error('Error saving overview notes:', err);
      setNotesStatus('❌ Error al guardar.');
    } finally {
      setNotesSaving(false);
    }
  };

  const rangeLabel = startDay === endDay ? `Día ${startDay}` : `Días ${Math.min(startDay, endDay)}–${Math.max(startDay, endDay)}`;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white" style={{ fontFamily: SERIF }}>
      {/* Floating controls — hidden when printing */}
      <div className="print:hidden fixed top-6 right-6 flex flex-wrap items-center gap-3 bg-slate-100 p-3 rounded-xl shadow-lg border border-slate-300 font-sans z-50 max-w-sm">
        <Link to="/admin-lesson-plan" className="text-slate-500 hover:text-slate-800 text-xs font-bold">← Plan Diario</Link>
        <div className="flex bg-white rounded-lg overflow-hidden border border-slate-300">
          <button onClick={() => setCourse('s2')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${course === 's2' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>S2</button>
          <button onClick={() => setCourse('s4')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${course === 's4' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>S4</button>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2 py-1">
          <span className="text-xs font-bold text-slate-500">Día</span>
          <input
            type="number" min="1" max={MAX_DAYS} value={startDay}
            onChange={(e) => setStartDay(Math.min(MAX_DAYS, Math.max(1, Number(e.target.value) || 1)))}
            className="w-12 text-sm font-black outline-none text-center"
          />
          <span className="text-xs font-bold text-slate-500">a</span>
          <input
            type="number" min="1" max={MAX_DAYS} value={endDay}
            onChange={(e) => setEndDay(Math.min(MAX_DAYS, Math.max(1, Number(e.target.value) || 1)))}
            className="w-12 text-sm font-black outline-none text-center"
          />
        </div>
        <button onClick={saveNotes} disabled={notesSaving} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest">
          {notesSaving ? 'Guardando...' : '💾 Guardar Notas'}
        </button>
        <button onClick={() => window.print()} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest">
          🖨️ Imprimir
        </button>
        {notesStatus && <p className="text-[10px] font-bold text-slate-600 w-full">{notesStatus}</p>}
      </div>

      <div className="max-w-4xl mx-auto bg-white text-black p-8 print:p-0 print:max-w-full text-left" style={{ minHeight: '100vh' }}>
        {/* Letterhead */}
        <div className="border-b-2 border-black pb-4 mb-6 print:mt-0 mt-24">
          <div className="flex justify-between items-end mb-2">
            <h1 className="text-3xl font-bold">Resumen de la Semana</h1>
            <h2 className="text-xl italic text-gray-700">{course === 's2' ? 'Spanish 2' : 'Spanish 4'}</h2>
          </div>
          <p className="text-lg">{rangeLabel}</p>
        </div>

        {loading ? (
          <p className="italic text-gray-500">Cargando...</p>
        ) : (
          <div className="space-y-4">
            {days.map((d) => <DayRow key={d.dia} day={d} note={notes[d.dia] || ''} onNoteChange={(v) => updateNote(d.dia, v)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// One compact day block — titles/labels only, never the specific
// verbs/vocab words or curiosidad questions themselves (those stay on the
// daily Plan de Lección page). A day with nothing planned yet still gets a
// row (useful signal: "nothing entered for Día N yet"), just with no pills.
function DayRow({ day, note, onNoteChange }) {
  const calentamientoLabels = [
    ...day.calentamiento.verbs.map((c) => `Verbos: ${c.title}`),
    ...day.calentamiento.vocab.map((v) => `Vocab: ${v.name}`),
  ];
  const curiosidadLabels = day.curiosidad.map((c) => c.title).filter(Boolean);
  const gramaticaLines = day.gramatica.flatMap((g) => [g.introText, g.repasoText].filter(Boolean));
  const practicaLabels = day.practica.map((p) => p.title).filter(Boolean);
  const quizLabels = day.evaluacion.map((e) => e.label).filter(Boolean);

  return (
    <div className="break-inside-avoid border border-gray-300 rounded-lg p-3">
      <div className="flex justify-between items-baseline border-b border-gray-200 pb-1 mb-2">
        <h3 className="text-base font-bold uppercase tracking-wide">Día {day.dia}</h3>
        <span className="text-xs font-mono text-gray-500">{day.activeDatesDisplay}</span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {quizLabels.length > 0 && <Field label="🎯 Evaluación">{quizLabels.join(', ')}</Field>}
        {calentamientoLabels.length > 0 && <Field label="⏱️ Calentamiento">{calentamientoLabels.join(' · ')}</Field>}
        {curiosidadLabels.length > 0 && <Field label="💡 Curiosidad">{curiosidadLabels.join(', ')}</Field>}
        {gramaticaLines.length > 0 && <Field label="📚 Gramática">{gramaticaLines.join(' · ')}</Field>}
        {practicaLabels.length > 0 && <Field label="✏️ Práctica">{practicaLabels.join(', ')}</Field>}
        {quizLabels.length + calentamientoLabels.length + curiosidadLabels.length + gramaticaLines.length + practicaLabels.length === 0 && (
          <span className="italic text-gray-400">Sin contenido planeado todavía.</span>
        )}
      </div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Notas..."
        rows={1}
        className="w-full mt-2 border border-gray-200 rounded p-1.5 text-xs font-sans print:border-gray-400"
      />
    </div>
  );
}

const Field = ({ label, children }) => (
  <span><span className="font-bold text-gray-500">{label}:</span> {children}</span>
);
