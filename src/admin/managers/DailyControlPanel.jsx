import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useActiveTheme } from '../../context/ThemeContext';
import { parseHeaderGradientStyle } from '../../utils/parseHeaderGradient';
import { useRawLessonPlanData, computeLessonPlanDay, resolveTodayDia } from '../../hooks/useLessonPlanData';
import { reconstructQuestion } from '../../shared/questionTypes';
import { decodeWord } from '../../utils/wordCipher';
import PracticeCardPreviewModal from './PracticeCardPreviewModal';
import {
  parseIds, joinIds, tareasActiveOnDay,
  setEvaluacionForDay,
  setGramaticaForDay,
  setTareaDueDate, createTarea,
  assignCalentamiento, unassignCalentamiento,
  assignVocabWarmup, unassignVocabWarmup,
  assignCuriosidad, unassignCuriosidad,
  setConversacionAssignment,
  setLecturaAssignment,
  setMusicaAssignment,
  setOracionesAssignment,
  addPracticeCardAssignment, removePracticeCardAssignment,
  setVideoAssignment,
  setAudioAssignment,
} from '../../utils/dailyPlanWriters';

const MAX_DAYS = 85;
const TAREA_TIPOS = ['Dominio', 'VHL', 'KWL', 'Schoology', 'Escuchar', 'Leer', 'Hablar', 'Escribir', 'Proyecto', 'Práctica', 'Examen de IB', 'Señor+'];

// A tiny "✅ Guardado"/"❌ Error" banner per section, same convention every
// other sequencer in this codebase uses — cleared after ~2s so one card's
// save never looks like it applies to another.
const useSectionStatus = () => {
  const [status, setStatus] = useState({});
  const flash = (key, text) => {
    setStatus((prev) => ({ ...prev, [key]: text }));
    setTimeout(() => setStatus((prev) => (prev[key] === text ? { ...prev, [key]: '' } : prev)), 2000);
  };
  return [status, flash];
};

const StatusLine = ({ text }) =>
  text ? <p className={`text-xs font-bold mt-2 ${text.startsWith('❌') ? 'text-rose-500' : 'text-emerald-500'}`}>{text}</p> : null;

// `toolLink` is the small "open the real sequencer/manager for this" link
// every card needs per spec — this panel is a quick control surface, not a
// replacement for the in-depth tools, so every section points back to its
// own full tool for anything beyond a quick swap/edit.
const ToolLink = ({ to, label }) => (
  <Link to={to} className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700 whitespace-nowrap">
    🔗 {label}
  </Link>
);

const SectionCard = ({ title, toolLink, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">{title}</h2>
      {toolLink && <ToolLink {...toolLink} />}
    </div>
    {children}
  </div>
);

// ---- Simple read-only preview modals for Calentamiento/Vocab/Curiosidad ----
const SimpleListPreviewModal = ({ title, rows, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-black text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl px-2">✕</button>
      </div>
      <ul className="space-y-1 text-sm">
        {rows.map((r, i) => <li key={i} className="font-mono text-slate-600">{r}</li>)}
      </ul>
    </div>
  </div>
);

// ---------------- Flexible-item type registry ----------------
// One entry per type — adding a new type later is one more object here,
// nothing else in this file changes.
const makeFlexibleTypes = (raw) => [
  {
    key: 'conversacion', label: 'Conversación', toolPath: '/admin-daily-plan-conversaciones',
    getAssigned: (pd) => pd.actividades.conversaciones,
    listAll: (course) => raw.conversaciones.filter((c) => (c.courses || []).includes(course)),
    titleOf: (c) => c.titulo || 'Sin título',
    assign: (id, course, dia) => setConversacionAssignment(id, { course, dia }, true),
    unassign: (id, course, dia) => setConversacionAssignment(id, { course, dia }, false),
  },
  {
    key: 'lectura', label: 'Lectura', toolPath: '/admin-lecturas-sequencer',
    getAssigned: (pd) => pd.actividades.lecturas,
    listAll: () => Object.values(raw.lecturasById || {}),
    titleOf: (l) => l.subtitulo || 'Sin título',
    assign: (id, course, dia) => setLecturaAssignment(course, dia, id, true),
    unassign: (id, course, dia) => setLecturaAssignment(course, dia, id, false),
  },
  {
    key: 'musica', label: 'Música', toolPath: '/admin-daily-plan-musica',
    getAssigned: (pd) => pd.actividades.musica,
    listAll: (course) => raw.musica.filter((m) => (Array.isArray(m.course) ? m.course : [m.course].filter(Boolean)).includes(course)),
    titleOf: (m) => m.titulo || 'Sin título',
    assign: (id, course, dia) => setMusicaAssignment(id, { course, dia }, true),
    unassign: (id, course, dia) => setMusicaAssignment(id, { course, dia }, false),
  },
  {
    key: 'oraciones', label: 'Oraciones', toolPath: '/admin-secret-portal-oraciones',
    getAssigned: (pd) => pd.oraciones,
    listAll: (course) => raw.sentenceSets.filter((s) => (s.assignments || []).some((a) => a.course === course)),
    titleOf: (s) => s.title || 'Sin título',
    assign: (id, course, dia) => setOracionesAssignment(id, { course, dia }, true),
    unassign: (id, course, dia) => setOracionesAssignment(id, { course, dia }, false),
  },
  {
    key: 'practica', label: 'Práctica', toolPath: '/admin-practice-cards-sequencer',
    getAssigned: (pd) => pd.practica,
    listAll: (course) => raw.practiceCards.filter((p) => p.course === course || (p.assignments || []).some((a) => a.course === course)),
    titleOf: (p) => p.title || 'Sin título',
    assign: (id, course, dia) => addPracticeCardAssignment(id, { course, dia }),
    unassign: (id, _course, dia, item) => {
      const match = (item.assignments || []).find((a) => Number(a.dia) === Number(dia));
      return removePracticeCardAssignment(id, match ? match.id : null);
    },
    Preview: ({ item, onClose }) => (
      <PracticeCardPreviewModal
        title={item.title}
        questions={(item.questions || []).map(reconstructQuestion)}
        onClose={onClose}
      />
    ),
  },
  {
    key: 'video', label: 'Video', toolPath: '/admin-daily-plan-videos',
    getAssigned: (pd) => pd.actividades.videos,
    listAll: (course) => raw.videos.filter((v) => (v.tags || []).includes(course)),
    titleOf: (v) => v.title || v.titulo || 'Sin título',
    assign: (id, course, dia) => setVideoAssignment(id, { course, dia }, true),
    unassign: (id, course, dia) => setVideoAssignment(id, { course, dia }, false),
  },
  {
    key: 'audio', label: 'Audio', toolPath: '/admin-daily-plan-audio',
    getAssigned: (pd) => pd.actividades.audio,
    listAll: (course) => (raw.audioClips || []).filter((a) => (a.tags || []).includes(course)),
    titleOf: (a) => a.title || 'Sin título',
    assign: (id, course, dia) => setAudioAssignment(id, { course, dia }, true),
    unassign: (id, course, dia) => setAudioAssignment(id, { course, dia }, false),
  },
];

const DailyControlPanel = () => {
  const [course, setCourse] = useState('s2');
  const [selectedDay, setSelectedDay] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, raw } = useRawLessonPlanData(refreshKey);
  const { theme } = useActiveTheme();
  const [status, flash] = useSectionStatus();
  const [previewVerb, setPreviewVerb] = useState(null);
  const [previewVocab, setPreviewVocab] = useState(null);
  const [previewCuriosidad, setPreviewCuriosidad] = useState(null);
  const [flexPreview, setFlexPreview] = useState(null); // { typeKey, item }
  const [previewAtandoCabos, setPreviewAtandoCabos] = useState(null);
  const [previewEslabones, setPreviewEslabones] = useState(null);

  const [grammarPages, setGrammarPages] = useState(null);
  const [grammarDraft, setGrammarDraft] = useState(null); // { introText, repasoText, enlaces, recursos }
  const [grammarSearch, setGrammarSearch] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newTarea, setNewTarea] = useState(null);

  const hasInitializedDay = useRef(false);
  useEffect(() => {
    if (hasInitializedDay.current || !raw) return;
    const today = resolveTodayDia(raw.rawDatesMap);
    if (today) {
      // One-time snap to today's día once the async calendar fetch resolves —
      // same pattern LessonPlanPage.jsx already uses for the same purpose.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDay(today);
      hasInitializedDay.current = true;
    }
  }, [raw]);

  useEffect(() => {
    if (grammarPages !== null) return;
    getDocs(collection(db, 'grammar_pages')).then((snap) => {
      setGrammarPages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [grammarPages]);

  const afterWrite = (sectionKey, msg) => {
    flash(sectionKey, msg);
    setRefreshKey((k) => k + 1);
  };
  const onWriteError = (sectionKey, err) => {
    console.error(err);
    flash(sectionKey, '❌ Error al guardar');
  };

  if (loading || !raw) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando...</div>;
  }

  const planData = computeLessonPlanDay(raw, course, selectedDay);
  const pageBgClass = theme?.styles?.pageBackground || 'bg-slate-900';
  const pageBgStyle = parseHeaderGradientStyle(pageBgClass);

  // ---- Evaluación ----
  const evalLabels = [...new Set((raw.evaluaciones[course] || []).map((r) => r.label).filter((l) => l && l !== 'Nada'))].sort();
  const currentEval = planData.evaluacion[0]?.label || '';

  // ---- Calentamiento ----
  const calOptions = [...raw.calentamientos].filter((c) => c.course === course).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  const currentCal = planData.calentamiento.verbs[0] || null;
  const vocabOptions = [...raw.vocabWarmups].filter((v) => v.course === course).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const currentVocab = planData.calentamiento.vocab[0] || null;

  // ---- Curiosidad ----
  const assignedCuriosidadIds = new Set(planData.curiosidad.map((c) => c.id));
  const curiosidadOptions = raw.curiosidades.filter((c) => !assignedCuriosidadIds.has(c.id)).sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  // ---- Gramática ----
  const gramRow = planData.gramatica[0] || null;
  const draft = grammarDraft || { introText: gramRow?.introText || '', repasoText: gramRow?.repasoText || '', enlaces: gramRow?.enlaces || '', recursos: gramRow?.recursos || '' };
  const linkedIds = parseIds(draft.enlaces);
  const linkedPages = (grammarPages || []).filter((p) => linkedIds.includes(p.id));
  const grammarSearchResults = grammarSearch.trim() && grammarPages
    ? grammarPages.filter((p) => !linkedIds.includes(p.id) && (p.title || '').toLowerCase().includes(grammarSearch.toLowerCase())).slice(0, 8)
    : [];

  const saveGrammar = async (nextDraft) => {
    try {
      await setGramaticaForDay(course, selectedDay, nextDraft);
      setGrammarDraft(null);
      afterWrite('gramatica', '✅ Guardado');
    } catch (err) {
      onWriteError('gramatica', err);
    }
  };

  const addGrammarLink = (page) => {
    const catSlug = (page.category || 'general').toLowerCase();
    const currentRecursos = parseIds(draft.recursos);
    const nextDraft = {
      ...draft,
      enlaces: joinIds([...linkedIds, page.id]),
      recursos: currentRecursos.includes(catSlug) ? draft.recursos : joinIds([...currentRecursos, catSlug]),
    };
    setGrammarSearch('');
    saveGrammar(nextDraft);
  };
  const removeGrammarLink = (pageId) => {
    saveGrammar({ ...draft, enlaces: joinIds(linkedIds.filter((id) => id !== pageId)) });
  };

  // ---- Tareas ----
  const activeTareas = tareasActiveOnDay(raw.tareas[course], selectedDay);

  // ---- Flexible items ----
  const flexibleTypes = makeFlexibleTypes(raw);
  const withAssigned = flexibleTypes.map((t) => ({ t, assigned: t.getAssigned(planData) || [] }));
  const assignedRows = withAssigned.filter((x) => x.assigned.length > 0).sort((a, b) => a.t.label.localeCompare(b.t.label));
  const emptyRows = withAssigned.filter((x) => x.assigned.length === 0).sort((a, b) => a.t.label.localeCompare(b.t.label));

  // ---- Recreo preview (read-only) ----
  // Señordle/Atando Cabos/Eslabones key by real calendar date, not día — a
  // día can resolve to two real dates (one per A/B ciclo), so show one row
  // per real date rather than picking just one.
  const recreoDates = raw.rawDatesMap[selectedDay] || [];
  const recreoByDate = recreoDates.map((fecha) => ({
    fecha,
    senordleWord: (() => {
      const entry = raw.senordle.find((s) => s.id === `${course}_${fecha}`);
      return entry?.word ? decodeWord(entry.word) : null;
    })(),
    atandoCabos: raw.atandoCabos.find((a) => a.id === `ac-${course}-${fecha}`) || null,
    eslabones: raw.eslabones.find((e) => e.id === `es-${course}-${fecha}`) || null,
  }));

  return (
    <div className={`min-h-screen text-white font-sans relative overflow-hidden ${pageBgStyle ? '' : pageBgClass}`} style={pageBgStyle || undefined}>
      {theme?.styles?.pageBackgroundImage?.url && (
        <div className="fixed inset-0 z-0" style={{ backgroundImage: `url("${theme.styles.pageBackgroundImage.url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ backgroundColor: theme.styles.pageBackgroundImage.overlayColor || '#000000', opacity: theme.styles.pageBackgroundImage.overlayOpacity ?? 0.5 }} />
        </div>
      )}
      {theme?.styles?.bgTexture && (
        <div className="fixed inset-0 pointer-events-none z-[1]" style={{ backgroundImage: `url("${theme.styles.bgTexture}")`, backgroundRepeat: 'repeat', opacity: 0.06 }} />
      )}

      <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-4 relative z-10">
        <div className="flex justify-between items-center">
          <Link to="/admin-daily-plan-hub" className="text-slate-300 hover:text-white text-sm font-bold">← Hub</Link>
          <h1 className="text-xl font-black uppercase tracking-widest">🎛️ Centro de Control Diario</h1>
        </div>

        {/* Sticky controls */}
        <div className="sticky top-2 z-20 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-2xl p-3 flex flex-wrap items-center gap-3 shadow-lg">
          <div className="flex bg-white rounded-lg overflow-hidden border border-slate-300">
            <button onClick={() => setCourse('s2')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${course === 's2' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>S2</button>
            <button onClick={() => setCourse('s4')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${course === 's4' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>S4</button>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2 py-1">
            <button onClick={() => setSelectedDay((d) => Math.max(1, d - 1))} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-600">-</button>
            <select value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))} className="text-sm font-black outline-none text-slate-800">
              {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Día {d}</option>)}
            </select>
            <button onClick={() => setSelectedDay((d) => Math.min(MAX_DAYS, d + 1))} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-600">+</button>
          </div>
          <span className="text-xs font-mono font-bold text-slate-300">{planData.activeDatesDisplay}</span>
        </div>

        {/* ===== Section 1: Fixed Core ===== */}

        <SectionCard title="🎯 Evaluación" toolLink={{ to: '/admin-daily-plan-evals', label: 'Evaluaciones Sequencer' }}>
          <p className="text-sm text-slate-700">{currentEval || <em className="text-slate-400">Nada asignada</em>}</p>
          <div className="flex gap-2 flex-wrap">
            <select
              value=""
              onChange={async (e) => {
                if (!e.target.value) return;
                try { await setEvaluacionForDay(course, selectedDay, e.target.value); afterWrite('evaluacion', '✅ Guardado'); }
                catch (err) { onWriteError('evaluacion', err); }
              }}
              className="text-xs border border-slate-300 rounded-lg p-2 text-slate-700"
            >
              <option value="">Elegir evaluación existente...</option>
              {evalLabels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input
              type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              placeholder="...o escribe una nueva"
              className="text-xs border border-slate-300 rounded-lg p-2 flex-1 min-w-[160px] text-slate-700"
            />
            <button
              onClick={async () => {
                if (!newLabel.trim()) return;
                try { await setEvaluacionForDay(course, selectedDay, newLabel.trim()); setNewLabel(''); afterWrite('evaluacion', '✅ Guardado'); }
                catch (err) { onWriteError('evaluacion', err); }
              }}
              className="text-xs font-black uppercase bg-slate-700 text-white px-3 py-2 rounded-lg"
            >Guardar</button>
          </div>
          <StatusLine text={status.evaluacion} />
        </SectionCard>

        <SectionCard title="⏱️ Calentamiento">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase w-20">Verbos</span>
            <ToolLink to="/admin-secret-portal-calentamiento" label="Calentamiento Admin" />
            <select
              value={currentCal?.id || ''}
              onChange={async (e) => {
                if (!e.target.value) return;
                try { await assignCalentamiento(course, selectedDay, e.target.value); afterWrite('cal', '✅ Guardado'); }
                catch (err) { onWriteError('cal', err); }
              }}
              className="text-xs border border-slate-300 rounded-lg p-2 text-slate-700 flex-1 min-w-[160px]"
            >
              <option value="">Nada</option>
              {calOptions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {currentCal && (
              <>
                <button onClick={() => setPreviewVerb(currentCal)} className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-1.5 rounded">👁️ Ver</button>
                <button
                  onClick={async () => { try { await unassignCalentamiento(currentCal.id); afterWrite('cal', '✅ Guardado'); } catch (err) { onWriteError('cal', err); } }}
                  className="text-[10px] font-black uppercase bg-rose-100 text-rose-600 px-2 py-1.5 rounded"
                >✕</button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase w-20">Vocab</span>
            <ToolLink to="/admin-secret-portal-vocabvault" label="Vocab Vault" />
            <select
              value={currentVocab?.id || ''}
              onChange={async (e) => {
                if (!e.target.value) return;
                try { await assignVocabWarmup(course, selectedDay, e.target.value); afterWrite('vocab', '✅ Guardado'); }
                catch (err) { onWriteError('vocab', err); }
              }}
              className="text-xs border border-slate-300 rounded-lg p-2 text-slate-700 flex-1 min-w-[160px]"
            >
              <option value="">Nada</option>
              {vocabOptions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {currentVocab && (
              <>
                <button onClick={() => setPreviewVocab(currentVocab)} className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-1.5 rounded">👁️ Ver</button>
                <button
                  onClick={async () => { try { await unassignVocabWarmup(currentVocab.id); afterWrite('vocab', '✅ Guardado'); } catch (err) { onWriteError('vocab', err); } }}
                  className="text-[10px] font-black uppercase bg-rose-100 text-rose-600 px-2 py-1.5 rounded"
                >✕</button>
              </>
            )}
          </div>
          <StatusLine text={status.cal} />
          <StatusLine text={status.vocab} />
        </SectionCard>

        <SectionCard title="💡 Curiosidad" toolLink={{ to: '/admin-daily-plan-curiosidades', label: 'Curiosidades Manager' }}>
          {planData.curiosidad.length === 0 && <p className="text-sm text-slate-400 italic">Nada asignada</p>}
          {planData.curiosidad.map((c) => (
            <div key={c.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
              <span className="flex-1 text-sm text-slate-700 font-bold">{c.title}</span>
              <button onClick={() => setPreviewCuriosidad(c)} className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-1.5 rounded">👁️ Ver</button>
              <button
                onClick={async () => { try { await unassignCuriosidad(course, c.id); afterWrite('curiosidad', '✅ Guardado'); } catch (err) { onWriteError('curiosidad', err); } }}
                className="text-[10px] font-black uppercase bg-rose-100 text-rose-600 px-2 py-1.5 rounded"
              >✕ Quitar</button>
            </div>
          ))}
          <select
            value=""
            onChange={async (e) => {
              if (!e.target.value) return;
              try { await assignCuriosidad(course, selectedDay, e.target.value); afterWrite('curiosidad', '✅ Guardado'); }
              catch (err) { onWriteError('curiosidad', err); }
            }}
            className="text-xs border border-slate-300 rounded-lg p-2 text-slate-700"
          >
            <option value="">+ Agregar curiosidad...</option>
            {curiosidadOptions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <StatusLine text={status.curiosidad} />
        </SectionCard>

        <SectionCard title="📚 Gramática" toolLink={{ to: '/admin-daily-plan-gramatica', label: 'Gramática Sequencer' }}>
          <textarea
            value={draft.introText}
            onChange={(e) => setGrammarDraft({ ...draft, introText: e.target.value })}
            placeholder="Introduciendo..."
            rows={2}
            className="w-full text-sm border border-slate-300 rounded-lg p-2 text-slate-700"
          />
          <textarea
            value={draft.repasoText}
            onChange={(e) => setGrammarDraft({ ...draft, repasoText: e.target.value })}
            placeholder="Repasando..."
            rows={2}
            className="w-full text-sm border border-slate-300 rounded-lg p-2 text-slate-700"
          />
          <button
            onClick={() => saveGrammar(draft)}
            className="text-xs font-black uppercase bg-slate-700 text-white px-3 py-2 rounded-lg"
          >Guardar</button>

          <div className="pt-2 border-t border-slate-200 space-y-1.5">
            {linkedPages.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                <span className="flex-1 text-xs font-bold text-slate-700">{p.title}</span>
                <button onClick={() => removeGrammarLink(p.id)} className="text-[10px] font-black uppercase bg-rose-100 text-rose-600 px-2 py-1 rounded">✕</button>
              </div>
            ))}
            <input
              type="text" value={grammarSearch} onChange={(e) => setGrammarSearch(e.target.value)}
              placeholder="+ Agregar nota (busca por título)..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-700"
            />
            {grammarSearchResults.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-h-40 overflow-y-auto">
                {grammarSearchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addGrammarLink(p)}
                    className="w-full text-left text-xs p-2 hover:bg-indigo-50 text-slate-700 border-b border-slate-100 last:border-0"
                  >{p.title} <span className="text-slate-400 font-mono">({p.category})</span></button>
                ))}
              </div>
            )}
          </div>
          <StatusLine text={status.gramatica} />
        </SectionCard>

        <SectionCard title="📝 Tareas" toolLink={{ to: '/admin-daily-plan-tareas', label: 'Tareas Sequencer' }}>
          {activeTareas.length === 0 && <p className="text-sm text-slate-400 italic">Nada activo hoy</p>}
          {activeTareas.map((t) => (
            <div key={t.id} className="bg-slate-50 rounded-lg p-2 space-y-1">
              <p className="text-sm font-bold text-slate-700">{t.titulo} <span className="text-[10px] text-slate-400 font-mono uppercase">({t.tipo})</span></p>
              <p className="text-[10px] text-slate-500 font-mono">Asignado: día {t.day_assigned} · Vence: día {t.day_due}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => { try { await setTareaDueDate(course, t.id, Number(t.day_due) + 1); afterWrite('tareas', '✅ Guardado'); } catch (err) { onWriteError('tareas', err); } }}
                  className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-1 rounded"
                >+1 día</button>
                <button
                  onClick={async () => { try { await setTareaDueDate(course, t.id, Number(t.day_due) + 2); afterWrite('tareas', '✅ Guardado'); } catch (err) { onWriteError('tareas', err); } }}
                  className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-1 rounded"
                >+2 días</button>
                <input
                  type="number" defaultValue={t.day_due}
                  onBlur={async (e) => {
                    const v = Number(e.target.value);
                    if (!v || v === Number(t.day_due)) return;
                    try { await setTareaDueDate(course, t.id, v); afterWrite('tareas', '✅ Guardado'); } catch (err) { onWriteError('tareas', err); }
                  }}
                  className="w-16 text-xs border border-slate-300 rounded p-1 text-center text-slate-700"
                />
              </div>
            </div>
          ))}

          {!newTarea ? (
            <button onClick={() => setNewTarea({ titulo: '', tipo: 'Dominio', day_assigned: selectedDay, day_due: selectedDay, notas_opcionales: '', url: '' })} className="text-xs font-black uppercase text-indigo-300">+ Nueva tarea</button>
          ) : (
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <input type="text" value={newTarea.titulo} onChange={(e) => setNewTarea({ ...newTarea, titulo: e.target.value })} placeholder="Título" className="w-full text-xs border border-slate-300 rounded p-2 text-slate-700" />
              <select value={newTarea.tipo} onChange={(e) => setNewTarea({ ...newTarea, tipo: e.target.value })} className="text-xs border border-slate-300 rounded p-2 text-slate-700">
                {TAREA_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="flex gap-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Asignado
                  <input type="number" value={newTarea.day_assigned} onChange={(e) => setNewTarea({ ...newTarea, day_assigned: e.target.value })} className="block w-16 text-xs border border-slate-300 rounded p-1 text-slate-700" />
                </label>
                <label className="text-[10px] text-slate-500 font-bold uppercase">Vence
                  <input type="number" value={newTarea.day_due} onChange={(e) => setNewTarea({ ...newTarea, day_due: e.target.value })} className="block w-16 text-xs border border-slate-300 rounded p-1 text-slate-700" />
                </label>
              </div>
              <input type="text" value={newTarea.notas_opcionales} onChange={(e) => setNewTarea({ ...newTarea, notas_opcionales: e.target.value })} placeholder="Notas (opcional)" className="w-full text-xs border border-slate-300 rounded p-2 text-slate-700" />
              <input type="text" value={newTarea.url} onChange={(e) => setNewTarea({ ...newTarea, url: e.target.value })} placeholder="URL (opcional)" className="w-full text-xs border border-slate-300 rounded p-2 text-slate-700" />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try { await createTarea(course, newTarea); setNewTarea(null); afterWrite('tareas', '✅ Guardado'); }
                    catch (err) { onWriteError('tareas', err); }
                  }}
                  className="text-xs font-black uppercase bg-slate-700 text-white px-3 py-2 rounded-lg"
                >Crear</button>
                <button onClick={() => setNewTarea(null)} className="text-xs font-bold text-slate-500 uppercase">Cancelar</button>
              </div>
            </div>
          )}
          <StatusLine text={status.tareas} />
        </SectionCard>

        {/* ===== Section 2: Flexible Items ===== */}

        <div className="space-y-3">
          {assignedRows.map(({ t, assigned }) => (
            <SectionCard key={t.key} title={t.label} toolLink={t.toolPath ? { to: t.toolPath, label: `${t.label} Manager` } : null}>
              {assigned.map((item) => (
                <div key={item.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 flex-wrap">
                  <span className="flex-1 text-sm font-bold text-slate-700 min-w-[120px]">{t.titleOf(item)}</span>
                  <select
                    value=""
                    onChange={async (e) => {
                      if (!e.target.value) return;
                      try {
                        await t.unassign(item.id, course, selectedDay, item);
                        await t.assign(e.target.value, course, selectedDay);
                        afterWrite(t.key, '✅ Guardado');
                      } catch (err) { onWriteError(t.key, err); }
                    }}
                    className="text-xs border border-slate-300 rounded-lg p-1.5 text-slate-700"
                  >
                    <option value="">Cambiar...</option>
                    {t.listAll(course).filter((o) => o.id !== item.id).map((o) => <option key={o.id} value={o.id}>{t.titleOf(o)}</option>)}
                  </select>
                  {t.Preview && (
                    <button onClick={() => setFlexPreview({ typeKey: t.key, item })} className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-1.5 rounded">👁️ Ver</button>
                  )}
                  <button
                    onClick={async () => { try { await t.unassign(item.id, course, selectedDay, item); afterWrite(t.key, '✅ Guardado'); } catch (err) { onWriteError(t.key, err); } }}
                    className="text-[10px] font-black uppercase bg-rose-100 text-rose-600 px-2 py-1.5 rounded"
                  >✕ Quitar</button>
                </div>
              ))}
              <StatusLine text={status[t.key]} />
            </SectionCard>
          ))}

          {emptyRows.map(({ t }) => (
            <div key={t.key} className="bg-slate-800/40 rounded-xl p-3 flex items-center gap-2 opacity-60">
              <span className="flex-1 text-xs font-bold text-slate-400 uppercase">{t.label} — nada asignado</span>
              {t.toolPath && <ToolLink to={t.toolPath} label={`${t.label} Manager`} />}
              <select
                value=""
                onChange={async (e) => {
                  if (!e.target.value) return;
                  try { await t.assign(e.target.value, course, selectedDay); afterWrite(t.key, '✅ Guardado'); }
                  catch (err) { onWriteError(t.key, err); }
                }}
                className="text-xs border border-slate-300 rounded-lg p-1.5 text-slate-700"
              >
                <option value="">Asignar...</option>
                {t.listAll(course).map((o) => <option key={o.id} value={o.id}>{t.titleOf(o)}</option>)}
              </select>
              <StatusLine text={status[t.key]} />
            </div>
          ))}
        </div>

        {/* ===== Recreo (read-only preview — side-quest games, keyed by real date, not día) ===== */}
        <SectionCard title="🎮 Recreo (vista previa)">
          <p className="text-xs text-slate-400 italic">
            Señordle, Atando Cabos y Eslabones se asignan por fecha real, no por día de clase — esto muestra lo que un
            estudiante vería hoy, para revisar rápido. Para editarlos, usa su propio manager.
          </p>
          {recreoByDate.length === 0 && <p className="text-sm text-slate-400 italic">Sin fecha definida para este día.</p>}
          {recreoByDate.map(({ fecha, senordleWord, atandoCabos, eslabones }) => (
            <div key={fecha} className="bg-slate-50 rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-mono font-bold text-slate-400">{fecha}</p>

              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-bold text-slate-600 w-28">Señordle</span>
                <ToolLink to="/admin-secret-portal-senordle" label="Señordle Admin" />
                <span className="font-mono text-slate-700">
                  {senordleWord || <em className="text-slate-400 font-sans">Sin asignar</em>}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-bold text-slate-600 w-28">Atando Cabos</span>
                <ToolLink to="/admin-daily-plan-atandocabos" label="Atando Cabos Manager" />
                {atandoCabos ? (
                  <>
                    <span className="text-slate-500 text-xs">{(atandoCabos.categories || []).length} categorías</span>
                    <button onClick={() => setPreviewAtandoCabos(atandoCabos)} className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-1.5 rounded">👁️ Ver</button>
                  </>
                ) : <em className="text-slate-400">Sin asignar</em>}
              </div>

              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-bold text-slate-600 w-28">Eslabones</span>
                <ToolLink to="/admin-daily-plan-eslabones" label="Eslabones Manager" />
                {eslabones ? (
                  <>
                    <span className="text-slate-500 text-xs">{(eslabones.chain || []).length} eslabones</span>
                    <button onClick={() => setPreviewEslabones(eslabones)} className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-1.5 rounded">👁️ Ver</button>
                  </>
                ) : <em className="text-slate-400">Sin asignar</em>}
              </div>
            </div>
          ))}
        </SectionCard>
      </div>

      {previewVerb && (
        <SimpleListPreviewModal
          title={previewVerb.title}
          rows={(previewVerb.bakedQuestions || []).map((q) => `${q.sujeto} ${q.palabra} → ${q.forma}`)}
          onClose={() => setPreviewVerb(null)}
        />
      )}
      {previewVocab && (
        <SimpleListPreviewModal
          title={previewVocab.name}
          rows={(previewVocab.sequence || []).map((w) => `${w.palabra} — ${w.traduccion}`)}
          onClose={() => setPreviewVocab(null)}
        />
      )}
      {previewCuriosidad && (
        <SimpleListPreviewModal
          title={previewCuriosidad.title}
          rows={[previewCuriosidad.img ? `🖼️ ${previewCuriosidad.img}` : null, previewCuriosidad.student_note || '(sin nota)'].filter(Boolean)}
          onClose={() => setPreviewCuriosidad(null)}
        />
      )}
      {flexPreview && (() => {
        const t = flexibleTypes.find((x) => x.key === flexPreview.typeKey);
        const Preview = t?.Preview;
        return Preview ? <Preview item={flexPreview.item} onClose={() => setFlexPreview(null)} /> : null;
      })()}
      {previewAtandoCabos && (
        <SimpleListPreviewModal
          title={`Atando Cabos — ${previewAtandoCabos.fecha}`}
          rows={(previewAtandoCabos.categories || []).map((c) => `${c.title}: ${(c.items || []).join(', ')}`)}
          onClose={() => setPreviewAtandoCabos(null)}
        />
      )}
      {previewEslabones && (
        <SimpleListPreviewModal
          title={`Eslabones — ${previewEslabones.fecha}`}
          rows={previewEslabones.chain || []}
          onClose={() => setPreviewEslabones(null)}
        />
      )}
    </div>
  );
};

export default DailyControlPanel;
