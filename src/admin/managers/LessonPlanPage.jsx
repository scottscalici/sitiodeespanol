import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedBucketedCollection } from '../../utils/firestoreCache';
import { TIME_BLOCKS, DEFAULT_DURATIONS, computeBlockTimes } from '../../utils/lessonPlanConfig';

const MAX_DAYS = 80;
const SERIF = '"Baskerville Old Face", "Libre Baskerville", Georgia, serif';

const SECTION_DEFS = [
  { key: 'calentamiento', label: 'Calentamiento', icon: '⏱️' },
  { key: 'oraciones', label: 'Oraciones de Práctica', icon: '✍️' },
  { key: 'curiosidad', label: 'Curiosidad', icon: '💡' },
  { key: 'gramatica', label: 'Gramática / Estructuras', icon: '📚' },
  { key: 'evaluacion', label: 'Evaluación', icon: '🎯' },
  { key: 'practica', label: 'Práctica', icon: '✏️' },
];

const emptyNotes = () => Object.fromEntries([...SECTION_DEFS.map((s) => s.key), 'tarea'].map((k) => [k, '']));

export default function LessonPlanPage() {
  const [course, setCourse] = useState('s2');
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);

  const [calendarMap, setCalendarMap] = useState({});
  const [rawDatesMap, setRawDatesMap] = useState({});
  const [anuncios, setAnuncios] = useState([]);
  const [calentamientos, setCalentamientos] = useState([]);
  const [vocabWarmups, setVocabWarmups] = useState([]);
  const [practiceCards, setPracticeCards] = useState([]);
  const [sentenceSets, setSentenceSets] = useState([]);
  const [curiosidades, setCuriosidades] = useState([]);
  const [gramatica, setGramatica] = useState({ s2: [], s4: [] });
  const [evaluaciones, setEvaluaciones] = useState({ s2: [], s4: [] });
  const [tareas, setTareas] = useState({ s2: [], s4: [] });

  const [durations, setDurations] = useState(DEFAULT_DURATIONS);
  const [notes, setNotes] = useState(emptyNotes());
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesStatus, setNotesStatus] = useState('');

  // Fetched once — the whole data set, filtered client-side on day/course
  // change so flipping through days feels instant (same pattern as
  // DailyPlanHub, which this page pulls together for printing).
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'config', 'academic_year_2026_2027'));
        const mapping = {};
        const rawMapping = {};
        if (configSnap.exists()) {
          const data = configSnap.data();
          (data.map || []).forEach((item) => {
            if (item.dia === null || item.dia === undefined) return;
            const dayNum = Number(item.dia);
            if (!mapping[dayNum]) mapping[dayNum] = [];
            if (!rawMapping[dayNum]) rawMapping[dayNum] = [];
            let formatted = item.fecha;
            if (item.fecha && item.fecha.includes('-')) {
              const parts = item.fecha.split('-');
              if (parts.length === 3) formatted = `${parts[1]}/${parts[2]}`;
            }
            mapping[dayNum].push(`${formatted}${item.ciclo ? ` (${item.ciclo})` : ''}`);
            if (item.fecha) rawMapping[dayNum].push(item.fecha);
          });
        }
        setCalendarMap(mapping);
        setRawDatesMap(rawMapping);

        const [calSnap, vocabSnap, practiceSnap, sentenceSnap, curiosidadesList, tareasSnap, evalsSnap, gramSnap, anunciosSnap] = await Promise.all([
          getDocs(collection(db, 'calentamientos')),
          getDocs(collection(db, 'dailyVocabWarmups')),
          getDocs(collection(db, 'practice_cards')),
          getDocs(collection(db, 'sentence_sets')),
          getCachedBucketedCollection('curiosidades'),
          getDoc(doc(db, 'curriculum_tracks', 'tareas_master')),
          getDoc(doc(db, 'curriculum_tracks', 'evaluaciones_master')),
          getDoc(doc(db, 'curriculum_tracks', 'gramatica_master')),
          getDocs(collection(db, 'anuncios')),
        ]);

        setCalentamientos(calSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setVocabWarmups(vocabSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setPracticeCards(practiceSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSentenceSets(sentenceSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCuriosidades(curiosidadesList);
        setAnuncios(anunciosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTareas({ s2: tareasSnap.exists() ? tareasSnap.data().s2 || [] : [], s4: tareasSnap.exists() ? tareasSnap.data().s4 || [] : [] });
        setEvaluaciones({ s2: evalsSnap.exists() ? evalsSnap.data().s2 || [] : [], s4: evalsSnap.exists() ? evalsSnap.data().s4 || [] : [] });
        setGramatica({ s2: gramSnap.exists() ? gramSnap.data().s2 || [] : [], s4: gramSnap.exists() ? gramSnap.data().s4 || [] : [] });
      } catch (err) {
        console.error('Error loading lesson plan data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

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
      await setDoc(doc(db, 'lesson_plan_notes', noteId), { course, dia: selectedDay, notes, updatedAt: new Date().toISOString() });
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

  if (loading) {
    return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">Cargando Plan de Lección...</div>;
  }

  // --- Filter everything to the selected day/course (same joins DailyPlanHub uses) ---
  const activeCalentamientoVerbs = calentamientos.filter((c) => c.course === course && Number(c.dia) === selectedDay);
  const activeCalentamientoVocab = vocabWarmups.filter((v) => v.course === course && Number(v.dia) === selectedDay);
  const activePracticeCards = practiceCards.filter((p) => p.course === course && Number(p.dia) === selectedDay);
  const activeSentenceSets = sentenceSets.filter((s) => (s.assignments || []).some((a) => a.course === course && Number(a.dia) === selectedDay));
  const activeCuriosidades = curiosidades.filter((c) => (course === 's2' ? c.s2_dia === selectedDay : c.s4_dia === selectedDay));
  const activeGramatica = (gramatica[course] || []).filter((g) => Number(g.dia) === selectedDay);
  const activeEvaluaciones = (evaluaciones[course] || []).filter((e) => Number(e.dia) === selectedDay && e.label && e.label !== 'Nada');
  const tareasDueToday = (tareas[course] || []).filter((t) => Number(t.day_due) === selectedDay);
  const tareasAssignedTodayDueLater = (tareas[course] || []).filter((t) => Number(t.day_assigned) === selectedDay && Number(t.day_due) > selectedDay);

  const dateStrings = calendarMap[selectedDay] || [];
  const activeDatesDisplay = dateStrings.length > 0 ? dateStrings.join(' & ') : 'Fecha por confirmar';

  // Anuncios are matched by actual calendar date (not día number) — a día
  // can resolve to two real dates (one per A/B ciclo), so an announcement
  // active on either one counts as active today.
  const rawDates = rawDatesMap[selectedDay] || [];
  const activeAnuncios = anuncios.filter(
    (a) => (a.courses || []).includes(course) && rawDates.some((d) => d >= a.start_date && d <= a.end_date)
  );

  // Plain "sujeto palabra" list of every verb actually baked for today
  // (e.g. "yo hablar, tú comer, ella vivir") and a plain list of the day's
  // vocab terms — printed small and unstyled on purpose, so there's room to
  // circle/underline ones by hand while teaching, to flag for review.
  const verbList = activeCalentamientoVerbs
    .flatMap((c) => c.bakedQuestions || [])
    .map((q) => `${q.sujeto} ${q.palabra}`)
    .join(', ');
  const vocabList = activeCalentamientoVocab
    .flatMap((v) => v.sequence || [])
    .map((w) => w.palabra)
    .join(', ');

  // --- Build each section's summary content ---
  const sectionContent = {
    calentamiento:
      activeCalentamientoVerbs.length + activeCalentamientoVocab.length === 0 ? null : (
        <div className="space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            {activeCalentamientoVerbs.map((c) => (
              <li key={`v-${c.id}`}>Verbos: {c.title} ({c.bakedQuestions?.length || 0} preguntas)</li>
            ))}
            {activeCalentamientoVocab.map((v) => (
              <li key={`voc-${v.id}`}>Vocabulario: {v.name} ({v.sequence?.length || 0} términos)</li>
            ))}
          </ul>
          {verbList && <p className="text-xs leading-relaxed font-sans text-gray-700 mt-2">{verbList}</p>}
          {vocabList && <p className="text-xs leading-relaxed font-sans text-gray-700 mt-1">{vocabList}</p>}
        </div>
      ),
    oraciones:
      activeSentenceSets.length === 0 ? null : (
        <ul className="list-disc pl-5 space-y-1">
          {activeSentenceSets.map((s) => (
            <li key={s.id}>{s.title || 'Oraciones'} ({(s.lines || []).length} oraciones)</li>
          ))}
        </ul>
      ),
    curiosidad:
      activeCuriosidades.length === 0 ? null : (
        <ul className="list-disc pl-5 space-y-1">
          {activeCuriosidades.map((c) => (
            <li key={c.id}>{c.title}{c.teacher_notes ? ` — ${c.teacher_notes}` : ''}</li>
          ))}
        </ul>
      ),
    gramatica:
      activeGramatica.length === 0 ? null : (
        <div className="space-y-2">
          {activeGramatica.map((g, idx) => (
            <div key={idx}>
              {g.introText && <p><span className="font-bold">Introducir:</span> {g.introText}</p>}
              {g.repasoText && <p><span className="font-bold">Repasar:</span> {g.repasoText}</p>}
            </div>
          ))}
        </div>
      ),
    evaluacion:
      activeEvaluaciones.length === 0 ? null : (
        <ul className="list-disc pl-5 space-y-1">
          {activeEvaluaciones.map((e, idx) => (
            <li key={idx} className="font-bold">{e.label}</li>
          ))}
        </ul>
      ),
    practica:
      activePracticeCards.length === 0 ? null : (
        <ul className="list-disc pl-5 space-y-1">
          {activePracticeCards.map((p) => (
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
            <p>Día {selectedDay} — {activeDatesDisplay}</p>
            <p>{TIME_BLOCKS.map((b) => `${b.label}: ${b.start}–${b.end}`).join('  ·  ')}</p>
          </div>
        </div>

        {/* Anuncios — plain script to read at the start of class, no
            styling/images/links (those live in the student-facing card). */}
        {activeAnuncios.length > 0 && (
          <div className="mb-8 border-b border-gray-300 pb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">📢 Anuncios</h3>
            {activeAnuncios.map((a) => (
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
          {tareasDueToday.length === 0 && tareasAssignedTodayDueLater.length === 0 ? (
            <p className="italic text-gray-500">Sin tareas relevantes hoy.</p>
          ) : (
            <div className="space-y-3 text-base">
              {tareasDueToday.length > 0 && (
                <div>
                  <p className="font-bold">Vence hoy:</p>
                  <ul className="list-disc pl-5">
                    {tareasDueToday.map((t) => (
                      <li key={t.id}>{t.titulo} ({t.tipo})</li>
                    ))}
                  </ul>
                </div>
              )}
              {tareasAssignedTodayDueLater.length > 0 && (
                <div>
                  <p className="font-bold">Asignada hoy (vence después):</p>
                  <ul className="list-disc pl-5">
                    {tareasAssignedTodayDueLater.map((t) => (
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
