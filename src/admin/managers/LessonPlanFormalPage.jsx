import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLessonPlanData } from '../../hooks/useLessonPlanData';
import { COURSE_TITLES, SECTION_STANDARDS, ACTIVITY_STANDARDS, getEvaluacionStandard } from '../../utils/lessonPlanStandards';

const MAX_DAYS = 80;
const SERIF = '"Baskerville Old Face", "Libre Baskerville", Georgia, serif';

// A standard tag next to a section/activity heading — small-caps pill,
// consistent wherever one appears on this page.
const StandardTag = ({ standard }) => (
  <span className="print:text-gray-700 text-indigo-700 text-[10px] font-bold uppercase tracking-widest border border-current rounded px-2 py-0.5 shrink-0">
    {standard}
  </span>
);

export default function LessonPlanFormalPage() {
  const params = useParams();
  const [course, setCourse] = useState(params.course === 's4' ? 's4' : 's2');
  const [selectedDay, setSelectedDay] = useState(Number(params.dia) || 1);
  const planData = useLessonPlanData(course, selectedDay);

  const [objectives, setObjectives] = useState('');
  const [materialesExtra, setMaterialesExtra] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const noteId = `${course}_d${selectedDay}`;
    setStatus('');
    getDoc(doc(db, 'lesson_plan_notes', noteId))
      .then((snap) => {
        const data = snap.exists() ? snap.data() : {};
        setObjectives(data.objectives || '');
        setMaterialesExtra(data.materialesExtra || '');
      })
      .catch((err) => console.error('Error loading lesson plan notes:', err));
  }, [course, selectedDay]);

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      const noteId = `${course}_d${selectedDay}`;
      // merge:true — the daily plan view writes its own `notes` field to
      // this same per-day doc, so a plain overwrite here would erase it.
      await setDoc(doc(db, 'lesson_plan_notes', noteId), { course, dia: selectedDay, objectives, materialesExtra, updatedAt: new Date().toISOString() }, { merge: true });
      setStatus('✅ Guardado.');
    } catch (err) {
      console.error('Error saving lesson plan objectives:', err);
      setStatus('❌ Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (planData.loading) {
    return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">Cargando Plan de Lección...</div>;
  }

  const { videos, conversaciones, musica, cultura, lecturas } = planData.actividades;
  const hasTarea = planData.tarea.dueToday.length > 0 || planData.tarea.assignedTodayDueLater.length > 0;
  const materiales = planData.tarea.materialesHoy.map((t) => t.titulo);

  // Every standard actually touched today, deduplicated, for the summary
  // line admins look for first — each section can list more than one
  // ("Comparaciones · Conexiones" for Tarea), so split those apart too.
  const standardsUsedToday = new Set();
  const noteStandard = (combined) => combined.split('·').map((s) => s.trim()).forEach((s) => standardsUsedToday.add(s));
  if (planData.destacado.length > 0) noteStandard(SECTION_STANDARDS.destacado);
  if (planData.calentamiento.verbs.length + planData.calentamiento.vocab.length > 0) noteStandard(SECTION_STANDARDS.calentamiento);
  if (planData.oraciones.length > 0) noteStandard(SECTION_STANDARDS.oraciones);
  if (planData.curiosidad.length > 0) noteStandard(SECTION_STANDARDS.curiosidad);
  videos.forEach(() => noteStandard(ACTIVITY_STANDARDS.video));
  lecturas.forEach(() => noteStandard(ACTIVITY_STANDARDS.lectura));
  conversaciones.forEach(() => noteStandard(ACTIVITY_STANDARDS.conversacion));
  musica.forEach(() => noteStandard(ACTIVITY_STANDARDS.musica));
  cultura.forEach(() => noteStandard(ACTIVITY_STANDARDS.cultura));
  if (planData.gramatica.length > 0) noteStandard(SECTION_STANDARDS.gramatica);
  if (planData.practica.length > 0) noteStandard(SECTION_STANDARDS.practica);
  planData.evaluacion.forEach((e) => noteStandard(getEvaluacionStandard(e.label, course)));
  if (hasTarea) noteStandard(SECTION_STANDARDS.tarea);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white" style={{ fontFamily: SERIF }}>
      {/* Floating controls — hidden when printing */}
      <div className="print:hidden fixed top-6 right-6 flex flex-wrap items-center gap-3 bg-slate-100 p-3 rounded-xl shadow-lg border border-slate-300 font-sans z-50 max-w-sm">
        <Link to="/admin-lesson-plan" className="text-slate-500 hover:text-slate-800 text-xs font-bold">← Plan de Trabajo</Link>
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
        <button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest">
          {saving ? 'Guardando...' : '💾 Guardar'}
        </button>
        <button onClick={() => window.print()} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest">
          🖨️ Imprimir
        </button>
        {status && <p className="text-[10px] font-bold text-slate-600 w-full">{status}</p>}
      </div>

      <div className="max-w-4xl mx-auto bg-white text-black p-8 print:p-0 print:max-w-full text-left" style={{ minHeight: '100vh' }}>
        {/* Letterhead */}
        <div className="border-b-2 border-black pb-4 mb-6 print:mt-0 mt-24 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-1">Plan de Lección Formal</p>
          <h1 className="text-3xl font-bold">{COURSE_TITLES[course]}</h1>
          <p className="text-lg mt-1">Día {selectedDay} — {planData.activeDatesDisplay}</p>
        </div>

        {/* Mapped Standards summary — the first thing an administrator looks for */}
        {standardsUsedToday.size > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Normas Nacionales (ACTFL — 5 Cs)</h3>
            <div className="flex flex-wrap gap-2">
              {[...standardsUsedToday].map((s) => <StandardTag key={s} standard={s} />)}
            </div>
          </div>
        )}

        {/* Objectives — manual field, the one part of this page that isn't automated */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Objetivos del Día</h3>
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            placeholder="Los estudiantes podrán..."
            rows={2}
            className="w-full border border-gray-300 rounded p-2 text-base font-sans print:border-gray-400"
          />
        </div>

        {/* Timed-agenda sections, each tagged with its standard */}
        <div className="space-y-4 mb-6">
          {planData.destacado.length > 0 && (
            <div className="break-inside-avoid border border-gray-300 rounded-lg p-4">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h3 className="text-base font-bold uppercase tracking-wide">🌟 Destacado del Día</h3>
                <StandardTag standard={SECTION_STANDARDS.destacado} />
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {planData.destacado.map((d) => (
                  <li key={d.id}>
                    <span className="font-bold">{d.header || d.type}</span>
                    {d.word_of_the_day?.word && (
                      <> — palabra del día: <span className="italic">{d.word_of_the_day.word}</span>{d.word_of_the_day.translation ? ` (${d.word_of_the_day.translation})` : ''}</>
                    )}
                    {d.spanish && <p className="font-normal text-gray-700 mt-1">{d.spanish}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(planData.calentamiento.verbs.length + planData.calentamiento.vocab.length) > 0 && (
            <div className="break-inside-avoid border border-gray-300 rounded-lg p-4">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h3 className="text-base font-bold uppercase tracking-wide">⏱️ Calentamiento</h3>
                <StandardTag standard={SECTION_STANDARDS.calentamiento} />
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {planData.calentamiento.verbs.map((c) => <li key={`v-${c.id}`}>Verbos: {c.title}</li>)}
                {planData.calentamiento.vocab.map((v) => <li key={`voc-${v.id}`}>Vocabulario: {v.name}</li>)}
              </ul>
            </div>
          )}

          {planData.oraciones.length > 0 && (
            <div className="break-inside-avoid border border-gray-300 rounded-lg p-4">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h3 className="text-base font-bold uppercase tracking-wide">✍️ Oraciones de Práctica</h3>
                <StandardTag standard={SECTION_STANDARDS.oraciones} />
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {planData.oraciones.map((s) => <li key={s.id}>{s.title || 'Oraciones'}</li>)}
              </ul>
            </div>
          )}

          {planData.curiosidad.length > 0 && (
            <div className="break-inside-avoid border border-gray-300 rounded-lg p-4">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h3 className="text-base font-bold uppercase tracking-wide">💡 Curiosidad</h3>
                <StandardTag standard={SECTION_STANDARDS.curiosidad} />
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {planData.curiosidad.map((c) => <li key={c.id}>{c.title}</li>)}
              </ul>
            </div>
          )}

          {(videos.length + conversaciones.length + musica.length + cultura.length + lecturas.length) > 0 && (
            <div className="break-inside-avoid border border-gray-300 rounded-lg p-4">
              <h3 className="text-base font-bold uppercase tracking-wide mb-2">🎬 Actividades</h3>
              <ul className="space-y-1">
                {videos.map((v) => (
                  <li key={`vid-${v.id}`} className="flex justify-between items-center gap-3"><span>🎬 Video: {v.title}</span><StandardTag standard={ACTIVITY_STANDARDS.video} /></li>
                ))}
                {lecturas.map((l) => (
                  <li key={`lec-${l.id}`} className="flex justify-between items-center gap-3"><span>📖 Lectura: {l.subtitulo || 'Comprensión de Lectura'}</span><StandardTag standard={ACTIVITY_STANDARDS.lectura} /></li>
                ))}
                {conversaciones.map((c) => (
                  <li key={`conv-${c.id}`} className="flex justify-between items-center gap-3"><span>🗣️ Conversación: {c.titulo}</span><StandardTag standard={ACTIVITY_STANDARDS.conversacion} /></li>
                ))}
                {musica.map((m) => (
                  <li key={`mus-${m.id}`} className="flex justify-between items-center gap-3"><span>🎵 Música: {m.titulo}</span><StandardTag standard={ACTIVITY_STANDARDS.musica} /></li>
                ))}
                {cultura.map((c) => (
                  <li key={`cul-${c.id}`} className="flex justify-between items-center gap-3"><span>🌎 Cultura: {c.titulo}</span><StandardTag standard={ACTIVITY_STANDARDS.cultura} /></li>
                ))}
              </ul>
            </div>
          )}

          {planData.gramatica.length > 0 && (
            <div className="break-inside-avoid border border-gray-300 rounded-lg p-4">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h3 className="text-base font-bold uppercase tracking-wide">📚 Gramática / Estructuras</h3>
                <StandardTag standard={SECTION_STANDARDS.gramatica} />
              </div>
              {planData.gramatica.map((g, idx) => (
                <div key={idx}>
                  {g.introText && <p><span className="font-bold">Introducir:</span> {g.introText}</p>}
                  {g.repasoText && <p><span className="font-bold">Repasar:</span> {g.repasoText}</p>}
                </div>
              ))}
            </div>
          )}

          {planData.evaluacion.length > 0 && (
            <div className="break-inside-avoid border border-gray-300 rounded-lg p-4">
              <h3 className="text-base font-bold uppercase tracking-wide mb-2">🎯 Evaluación</h3>
              <ul className="space-y-1">
                {planData.evaluacion.map((e, idx) => (
                  <li key={idx} className="flex justify-between items-center gap-3"><span className="font-bold">{e.label}</span><StandardTag standard={getEvaluacionStandard(e.label, course)} /></li>
                ))}
              </ul>
            </div>
          )}

          {planData.practica.length > 0 && (
            <div className="break-inside-avoid border border-gray-300 rounded-lg p-4">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h3 className="text-base font-bold uppercase tracking-wide">✏️ Práctica</h3>
                <StandardTag standard={SECTION_STANDARDS.practica} />
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {planData.practica.map((p) => <li key={p.id}>{p.title}</li>)}
              </ul>
            </div>
          )}

          {hasTarea && (
            <div className="break-inside-avoid border border-gray-300 rounded-lg p-4">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h3 className="text-base font-bold uppercase tracking-wide">📝 Tarea (Dominio)</h3>
                <StandardTag standard={SECTION_STANDARDS.tarea} />
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {planData.tarea.dueToday.map((t) => <li key={t.id}>{t.titulo} — vence hoy</li>)}
                {planData.tarea.assignedTodayDueLater.map((t) => <li key={t.id}>{t.titulo} — vence Día {t.day_due}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Materials/technology — auto-detected from today's Tareas, plus a manual field for anything else */}
        <div className="border-t-2 border-black pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Materiales / Tecnología</h3>
          {materiales.length === 0 ? (
            <p className="italic text-gray-500 text-sm mb-2">Ninguno detectado hoy.</p>
          ) : (
            <ul className="list-disc pl-5 space-y-1 mb-2">
              {materiales.map((m, idx) => <li key={idx}>{m}</li>)}
            </ul>
          )}
          <textarea
            value={materialesExtra}
            onChange={(e) => setMaterialesExtra(e.target.value)}
            placeholder="Materiales adicionales..."
            rows={1}
            className="w-full border border-gray-200 rounded p-2 text-sm font-sans print:border-gray-400"
          />
        </div>
      </div>
    </div>
  );
}
