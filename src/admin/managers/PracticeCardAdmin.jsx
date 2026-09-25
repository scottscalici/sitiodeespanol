import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';

const emptyQuestion = () => ({ type: 'mc', prompt: '', options: ['', ''], correctAnswer: '' });

export default function PracticeCardAdmin() {
  const [cardId, setCardId] = useState('practica_s2_d1_gustar');
  const [title, setTitle] = useState('Gustar');
  const [dia, setDia] = useState(1);
  const [course, setCourse] = useState('s2');
  const [points, setPoints] = useState(1);
  const [excused, setExcused] = useState(false);
  const [questions, setQuestions] = useState([emptyQuestion()]);

  const [savedCards, setSavedCards] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);

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
      setPoints(c.points || 1);
      setExcused(c.excused || false);
      setQuestions(c.questions?.length ? c.questions : [emptyQuestion()]);
    }
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIndex, optIndex, value) => {
    const updated = [...questions];
    const options = [...updated[qIndex].options];
    options[optIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options };
    setQuestions(updated);
  };

  const addOption = (qIndex) => {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], options: [...updated[qIndex].options, ''] };
    setQuestions(updated);
  };

  const removeOption = (qIndex, optIndex) => {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], options: updated[qIndex].options.filter((_, i) => i !== optIndex) };
    setQuestions(updated);
  };

  const addQuestion = () => setQuestions([...questions, emptyQuestion()]);
  const removeQuestion = (index) => setQuestions(questions.filter((_, i) => i !== index));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanQuestions = questions
        .filter((q) => q.prompt.trim() && q.correctAnswer.trim())
        .map((q) => (q.type === 'mc' ? { ...q, options: q.options.filter((o) => o.trim()) } : { type: 'write', prompt: q.prompt, correctAnswer: q.correctAnswer }));

      if (cleanQuestions.length === 0) {
        alert('Agrega al menos una pregunta con respuesta antes de guardar.');
        setSaving(false);
        return;
      }

      await setDoc(
        doc(db, 'practice_cards', cardId),
        {
          id: cardId,
          title,
          dia: Number(dia),
          course,
          points: Number(points) || 1,
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
          Preguntas de opción múltiple o de escribir, ~1 punto cada tarjeta. Cuenta para el mismo promedio que los calentamientos.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-1">Puntos</label>
            <input type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-center" />
          </div>
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
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-800 uppercase">Preguntas ({questions.length})</h2>
            <button type="button" onClick={addQuestion} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-sm">
              + Añadir Pregunta
            </button>
          </div>

          {questions.map((q, qIdx) => (
            <div key={qIdx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <select value={q.type} onChange={(e) => updateQuestion(qIdx, 'type', e.target.value)} className="p-1.5 border rounded-lg text-xs font-bold bg-white">
                  <option value="mc">Opción Múltiple</option>
                  <option value="write">Escribir</option>
                </select>
                <button type="button" onClick={() => removeQuestion(qIdx)} className="p-1.5 text-rose-500 font-bold text-sm" title="Eliminar pregunta">🗑️</button>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Pregunta (inglés o instrucción)</label>
                <input type="text" value={q.prompt} onChange={(e) => updateQuestion(qIdx, 'prompt', e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold bg-white" />
              </div>

              {q.type === 'mc' ? (
                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-slate-400 uppercase">Opciones</label>
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex gap-2 items-center">
                      <input type="text" value={opt} onChange={(e) => updateOption(qIdx, optIdx, e.target.value)} className="flex-1 p-1.5 border rounded-lg text-sm bg-white" placeholder={`Opción ${optIdx + 1}`} />
                      <button type="button" onClick={() => removeOption(qIdx, optIdx)} className="text-rose-400 text-xs font-bold">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(qIdx)} className="text-sky-600 text-xs font-bold">+ Opción</button>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Respuesta Correcta (debe coincidir con una opción)</label>
                    <input type="text" value={q.correctAnswer} onChange={(e) => updateQuestion(qIdx, 'correctAnswer', e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold bg-white" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Respuesta Correcta</label>
                  <input type="text" value={q.correctAnswer} onChange={(e) => updateQuestion(qIdx, 'correctAnswer', e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold bg-white" />
                </div>
              )}
            </div>
          ))}
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
