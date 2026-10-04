import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';
import { QUESTION_TYPES, TYPE_LABELS, finalizeQuestion, reconstructQuestion, parseBulkRowPlain } from '../../shared/questionTypes';
import { normalizeLegacyPracticeQuestion } from '../../utils/legacyPracticeQuestion';

const DEFAULT_TYPE = 'multiple_choice';
const emptyQuestion = () => QUESTION_TYPES[DEFAULT_TYPE].emptyQuestion();

const reconstructEditableFields = (questions) =>
  (questions || []).map((q) => reconstructQuestion(normalizeLegacyPracticeQuestion(q)));

export default function PracticeCardAdmin() {
  const [cardId, setCardId] = useState('practica_s2_d1_gustar');
  const [title, setTitle] = useState('Gustar');
  const [dia, setDia] = useState(1);
  const [course, setCourse] = useState('s2');
  const [gradeWeight, setGradeWeight] = useState(1);
  const [excused, setExcused] = useState(false);
  const [questions, setQuestions] = useState([emptyQuestion()]);

  const [savedCards, setSavedCards] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');

  useEffect(() => {
    getCachedCollection('practice_cards')
      .then((cards) => setSavedCards([...cards].sort((a, b) => (a.dia || 0) - (b.dia || 0))))
      .catch((err) => console.error('Error loading practice cards:', err))
      .finally(() => setLoadingMeta(false));
  }, []);

  const loadCard = (id) => {
    if (!id) return;
    const c = savedCards.find((x) => x.id === id);
    if (c) {
      setCardId(c.id);
      setTitle(c.title || '');
      setDia(c.dia || 1);
      setCourse(c.course || 's2');
      setGradeWeight(c.gradeWeight || 1);
      setExcused(c.excused || false);
      setQuestions(c.questions?.length ? reconstructEditableFields(c.questions) : [emptyQuestion()]);
    }
  };

  const updateQuestionData = (index, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const changeType = (index, newType) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? QUESTION_TYPES[newType].emptyQuestion() : q)));
  };

  const addQuestion = () => setQuestions([...questions, emptyQuestion()]);
  const removeQuestion = (index) => setQuestions(questions.filter((_, i) => i !== index));

  const handleBulkImport = () => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map(parseBulkRowPlain);
    const valid = parsed.filter(Boolean);
    const invalidCount = parsed.length - valid.length;

    if (valid.length === 0) {
      setBulkStatus('No se pudo leer ninguna línea. Formato: pregunta | respuesta | distractor1 | distractor2');
      return;
    }

    setQuestions((prev) => [...prev, ...valid]);
    setBulkText('');
    setBulkImportOpen(false);
    setBulkStatus(
      invalidCount > 0
        ? `Se importaron ${valid.length} pregunta(s). ${invalidCount} línea(s) no se pudieron leer y se omitieron.`
        : ''
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (questions.length === 0) {
        alert('Agrega al menos una pregunta con respuesta antes de guardar.');
        setSaving(false);
        return;
      }
      const cleanQuestions = questions.map(finalizeQuestion);

      await setDoc(
        doc(db, 'practice_cards', cardId),
        {
          id: cardId,
          title,
          dia: Number(dia),
          course,
          gradeWeight: Number(gradeWeight) || 1,
          excused,
          questions: cleanQuestions,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
      invalidateCollectionCache('practice_cards');
      alert('¡Tarjeta de práctica guardada!');
    } catch (error) {
      console.error('Error saving practice card:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadingMeta) {
    return <div className="p-10 text-center font-bold text-slate-400">Cargando tarjetas de práctica...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 font-sans pb-20">
      <div className="bg-slate-900 p-4 rounded-2xl mb-6 shadow-sm border border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-3 w-full max-w-lg">
          <span className="text-white font-bold text-sm tracking-wider uppercase">Cargar Práctica:</span>
          <select onChange={(e) => loadCard(e.target.value)} className="flex-1 p-2 rounded-xl bg-slate-800 text-sky-400 font-bold border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">-- Seleccionar Tarjeta Anterior --</option>
            {savedCards.map((c) => (
              <option key={c.id} value={c.id}>{c.course?.toUpperCase()} Día {c.dia}: {c.title}</option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest text-right max-w-xs">
          Para duplicar para otro día, cárgala y cambia el "Día" y el "ID Documento" antes de guardar.
        </p>
      </div>

      <div className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Creador de Tarjetas de Práctica</h1>
        <p className="text-slate-500 font-bold text-sm mt-1">
          Mismos tipos de pregunta que las curiosidades. Los puntos de clasificación y el peso en el promedio de clase se configuran por separado abajo.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-1">ID Documento</label>
            <input type="text" value={cardId} onChange={(e) => setCardId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold bg-slate-50" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-black text-slate-500 uppercase mb-1">Título</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold" required />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-1">Curso / Día</label>
            <div className="flex gap-2">
              <select value={course} onChange={(e) => setCourse(e.target.value)} className="w-1/2 p-2.5 border rounded-xl font-bold uppercase bg-slate-50">
                <option value="s2">S2</option>
                <option value="s4">S4</option>
              </select>
              <input type="number" value={dia} onChange={(e) => setDia(e.target.value)} className="w-1/2 p-2.5 border rounded-xl font-bold text-center" />
            </div>
          </div>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs text-sky-800 font-bold">
          🏆 Puntos de clasificación (XP) = 1 punto por cada pregunta que el estudiante responda correctamente en su primer intento. Se otorgan una sola vez, al completar la tarjeta por primera vez.
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase">Peso en el Promedio de Clase</h4>
            <p className="text-[11px] text-slate-400">
              Cuánto vale esta tarjeta en el promedio de calentamientos (independiente de los puntos de clasificación arriba). Un calentamiento vale 5 por defecto.
            </p>
          </div>
          <input type="number" min="0.5" step="0.5" value={gradeWeight} onChange={(e) => setGradeWeight(e.target.value)} className="w-24 p-2.5 border rounded-xl font-bold text-center bg-slate-50 shrink-0" />
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase">Excusar esta Práctica</h4>
            <p className="text-[11px] text-slate-400">Se excluye por completo del promedio (gradebook y panel del estudiante).</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border">
            <input type="checkbox" checked={excused} onChange={(e) => setExcused(e.target.checked)} className="rounded text-amber-500" />
            <span>Excusada</span>
          </label>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
            <h2 className="text-lg font-black text-slate-800 uppercase">Preguntas ({questions.length})</h2>
            <div className="flex flex-wrap gap-2 justify-end">
              {Object.values(QUESTION_TYPES).map((mod) => (
                <button
                  key={mod.TYPE_KEY}
                  type="button"
                  onClick={() => setQuestions([...questions, mod.emptyQuestion()])}
                  className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-xl text-[10px] uppercase tracking-wider shadow-sm"
                >
                  + {mod.TYPE_LABEL}
                </button>
              ))}
            </div>
          </div>

          {questions.map((q, qIdx) => {
            const mod = QUESTION_TYPES[q.type];
            if (!mod) return null;
            const Editor = mod.Editor;
            return (
              <div key={qIdx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <select value={q.type} onChange={(e) => changeType(qIdx, e.target.value)} className="p-1.5 border rounded-lg text-xs font-bold bg-white">
                    {Object.values(QUESTION_TYPES).map((m) => (
                      <option key={m.TYPE_KEY} value={m.TYPE_KEY}>{TYPE_LABELS[m.TYPE_KEY]}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeQuestion(qIdx)} className="p-1.5 text-rose-500 font-bold text-sm" title="Eliminar pregunta">🗑️</button>
                </div>

                <Editor question={q} onChange={(patch) => updateQuestionData(qIdx, patch)} instanceId={qIdx} showCategory={false} />
              </div>
            );
          })}

          <div className="border-t border-slate-200 pt-4">
            {!bulkImportOpen ? (
              <button
                type="button"
                onClick={() => setBulkImportOpen(true)}
                className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
              >
                📋 Importar en Lote (Opción Múltiple)
              </button>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Una pregunta por línea — útil para pegar muchas de una vez
                </p>
                <p className="text-[10px] text-slate-400 font-mono mb-2">
                  pregunta | respuesta correcta | distractor 1 | distractor 2 | distractor 3
                </p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={5}
                  placeholder={
                    '¿Ustedes reciclan el papel? | Sí, lo reciclamos en el contenedor azul. | Sí, los reciclamos en el contenedor azul. | Sí, la reciclamos en el contenedor azul.\n' +
                    '¿Tú reciclas los envases? | Sí, siempre los reciclo. | Sí, siempre lo reciclo. | Sí, siempre las reciclo.'
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest"
                  >
                    Importar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkImportOpen(false);
                      setBulkText('');
                      setBulkStatus('');
                    }}
                    className="text-xs font-bold text-slate-500 uppercase"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {bulkStatus && <p className="text-xs text-slate-600 font-bold mt-2">{bulkStatus}</p>}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs transition-transform hover:scale-105 disabled:opacity-50">
            {saving ? 'Guardando...' : '🔒 Guardar Tarjeta de Práctica'}
          </button>
        </div>
      </form>
    </div>
  );
}
