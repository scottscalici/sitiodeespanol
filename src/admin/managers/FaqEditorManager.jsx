import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';
import { renderFormattedText } from '../../utils/formattedText';

const COURSE_OPTIONS = [
  { value: 'all', label: 'Ambos Cursos' },
  { value: 's2', label: 'Solo S2' },
  { value: 's4', label: 'Solo S4' },
];

const emptyDraft = () => ({ id: null, question: '', answer: '', course: 'all', order: 0 });

// Small inline B/I/S/U toolbar for the answer textarea — wraps the current
// selection in the matching marker pair, rendered by utils/formattedText.jsx
// on the student-facing FaqPage. Kept local to this file (not shared with
// GramaticaSequencer's own copy) since that one manages refs per-row for a
// whole spreadsheet of textareas, while this only ever needs one at a time.
const FormatToolbar = ({ textareaRef, value, onChange }) => {
  const applyFormat = (marker) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd) || 'texto';
    const newValue = `${value.slice(0, selectionStart)}${marker}${selected}${marker}${value.slice(selectionEnd)}`;
    onChange(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + marker.length, selectionStart + marker.length + selected.length);
    });
  };
  return (
    <div className="flex gap-1 mb-1">
      <button type="button" onClick={() => applyFormat('**')} title="Negrita" className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-[11px] font-black text-slate-200">B</button>
      <button type="button" onClick={() => applyFormat('_')} title="Cursiva" className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-[11px] italic font-bold text-slate-200">I</button>
      <button type="button" onClick={() => applyFormat('~~')} title="Tachado" className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-[11px] line-through font-bold text-slate-200">S</button>
      <button type="button" onClick={() => applyFormat('__')} title="Subrayado" className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-[11px] underline font-bold text-slate-200">U</button>
    </div>
  );
};

export default function FaqEditorManager() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft());
  const [status, setStatus] = useState('');
  const answerRef = useRef(null);

  const fetchEntries = async () => {
    try {
      const data = await getCachedCollection('faq_entries');
      const sorted = [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setEntries(sorted);
      return sorted;
    } catch (error) {
      console.error('Error loading FAQ entries:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const startEdit = (entry) => setDraft({ ...entry });

  const saveDraft = async () => {
    if (!draft.question.trim() || !draft.answer.trim()) {
      setStatus('❌ La pregunta y la respuesta son obligatorias.');
      return;
    }
    const id = draft.id || `faq_${Date.now()}`;
    try {
      await setDoc(doc(db, 'faq_entries', id), {
        question: draft.question.trim(),
        answer: draft.answer.trim(),
        course: draft.course || 'all',
        order: Number(draft.order) || 0,
      });
      invalidateCollectionCache('faq_entries');
      const refreshed = await fetchEntries();
      setDraft({ ...emptyDraft(), order: refreshed.length });
      setStatus('✅ Guardado.');
    } catch (error) {
      console.error('Error saving FAQ entry:', error);
      setStatus('❌ Error al guardar.');
    }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('¿Eliminar esta pregunta permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'faq_entries', id));
      invalidateCollectionCache('faq_entries');
      await fetchEntries();
      if (draft.id === id) setDraft(emptyDraft());
    } catch (error) {
      console.error('Error deleting FAQ entry:', error);
      setStatus('❌ Error al eliminar.');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>❓</span> Editor de Preguntas Frecuentes
          </h2>
          <div className="flex gap-2">
            <Link to="/preguntas-frecuentes" target="_blank" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
              👁️ Ver Página
            </Link>
            <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
              ← Hub
            </Link>
          </div>
        </div>

        <p className="text-slate-400 text-xs leading-relaxed">
          Estas preguntas se agregan AL FINAL de la página de Preguntas Frecuentes, después de las secciones ya escritas
          (Recuperaciones, calificación, recorrido del sitio) — esas no se editan aquí. Usa los botones B/I/S/U en la
          respuesta para darle formato; se ve igual para los estudiantes.
        </p>

        {/* EDITOR FORM */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest">
            {draft.id ? 'Editando Pregunta' : 'Nueva Pregunta'}
          </h3>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pregunta</label>
            <input
              type="text"
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              placeholder='Ej: "¿Qué pasa si falto a clase el día de un quiz?"'
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Respuesta</label>
            <FormatToolbar textareaRef={answerRef} value={draft.answer} onChange={(v) => setDraft({ ...draft, answer: v })} />
            <textarea
              ref={answerRef}
              value={draft.answer}
              onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              rows={5}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Curso</label>
              <select
                value={draft.course}
                onChange={(e) => setDraft({ ...draft, course: e.target.value })}
                className="bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
              >
                {COURSE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Orden</label>
              <input
                type="number"
                value={draft.order}
                onChange={(e) => setDraft({ ...draft, order: e.target.value })}
                className="w-20 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={saveDraft}
              className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs px-5 py-2.5 rounded-lg transition-colors"
            >
              {draft.id ? 'Actualizar' : 'Agregar'}
            </button>
            {draft.id && (
              <button
                onClick={() => setDraft(emptyDraft())}
                className="text-slate-400 hover:text-white text-xs font-bold px-3 py-2.5"
              >
                Cancelar
              </button>
            )}
          </div>

          {status && (
            <p className={`text-xs font-bold ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
          )}
        </div>

        {/* EXISTING ENTRIES */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
            Preguntas Agregadas ({entries.length})
          </h3>
          {entries.length === 0 && (
            <p className="text-slate-500 text-sm italic">Todavía no hay preguntas agregadas aquí.</p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-start gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                    {COURSE_OPTIONS.find((o) => o.value === (entry.course || 'all'))?.label || 'Ambos Cursos'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-600">Orden: {entry.order ?? 0}</span>
                </div>
                <p className="text-white font-bold text-sm">{entry.question}</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{renderFormattedText(entry.answer)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(entry)} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold px-2 py-1">Editar</button>
                <button onClick={() => deleteEntry(entry.id)} className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2 py-1">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
