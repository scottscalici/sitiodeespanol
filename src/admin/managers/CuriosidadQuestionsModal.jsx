import React, { useState } from 'react';
import ImageUploadField from '../shared/ImageUploadField';

// Each question type gets its own editor block below, picked by the same
// `type` field the student engine branches on.
const emptyPair = () => ({ left: { type: 'text', value: '' }, answer: '' });
const emptyMatchingQuestion = () => ({ type: 'matching', prompt: '', pairs: [emptyPair()], distractors: [] });
const emptyImageOption = () => ({ img: '', label: '' });
const emptyImageSelectQuestion = () => ({
  type: 'image_select',
  prompt: '',
  options: [emptyImageOption(), emptyImageOption()],
  correctIndices: [],
});

const TYPE_LABELS = {
  matching: 'Emparejar',
  image_select: 'Selección de Imagen',
};

const CuriosidadQuestionsModal = ({ curiosidad, onClose, onSave }) => {
  const [questions, setQuestions] = useState(curiosidad.questions || []);
  const [minSeconds, setMinSeconds] = useState(curiosidad.minSeconds ?? 60);
  // How many points this is worth toward the pooled "Promedio Calentamientos"
  // class grade (completion-only, same as practice cards' own gradeWeight) —
  // separate from the ranking points students earn, which are computed from
  // accuracy in CuriosidadQuizEngine regardless of this value.
  const [gradeWeight, setGradeWeight] = useState(curiosidad.gradeWeight ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateQuestion = (qIdx, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)));
  };

  // --- Matching-type helpers ---
  const addPair = (qIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, pairs: [...q.pairs, emptyPair()] } : q))
    );
  };

  const updatePair = (qIdx, pIdx, patch) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, pairs: q.pairs.map((p, j) => (j === pIdx ? { ...p, ...patch } : p)) } : q
      )
    );
  };

  const removePair = (qIdx, pIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, pairs: q.pairs.filter((_, j) => j !== pIdx) } : q))
    );
  };

  // --- Image-select-type helpers ---
  const addImageOption = (qIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, emptyImageOption()] } : q))
    );
  };

  const updateImageOption = (qIdx, oIdx, patch) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === oIdx ? { ...o, ...patch } : o)) } : q
      )
    );
  };

  const removeImageOption = (qIdx, oIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: q.options.filter((_, j) => j !== oIdx),
              // Keep correctIndices in sync — remove this index and shift
              // every index after it down by one.
              correctIndices: (q.correctIndices || [])
                .filter((idx) => idx !== oIdx)
                .map((idx) => (idx > oIdx ? idx - 1 : idx)),
            }
          : q
      )
    );
  };

  const toggleCorrectOption = (qIdx, oIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const current = q.correctIndices || [];
        const isCorrect = current.includes(oIdx);
        return {
          ...q,
          correctIndices: isCorrect ? current.filter((idx) => idx !== oIdx) : [...current, oIdx],
        };
      })
    );
  };

  // Saves straight to the database (see CuriosidadesManager's
  // handleSaveQuestions) — the modal stays open and shows an error on
  // failure instead of closing and losing the unsaved edits, and only
  // closes once the write has actually succeeded.
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave({ questions, minSeconds: Number(minSeconds) || 60, gradeWeight: Number(gradeWeight) || 1 });
      onClose();
    } catch (err) {
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo — tus cambios aquí no se perdieron.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={saving ? undefined : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-black text-slate-800">
              Preguntas: {curiosidad.title || curiosidad.id}
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              {questions.length} pregunta{questions.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2" title="Puntos hacia el Promedio Calentamientos (crédito por completar, no por precisión)">
              Puntos de clase
              <input
                type="number"
                min="1"
                value={gradeWeight}
                onChange={(e) => setGradeWeight(e.target.value)}
                className="w-14 border border-slate-300 rounded-md p-1.5 text-center"
              />
            </label>
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              Tiempo mínimo (seg)
              <input
                type="number"
                value={minSeconds}
                onChange={(e) => setMinSeconds(e.target.value)}
                className="w-16 border border-slate-300 rounded-md p-1.5 text-center"
              />
            </label>
            <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700 text-xl px-2 disabled:opacity-30">
              ✕
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {questions.length === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-6">
              Todavía no hay preguntas. Agrega una abajo.
            </p>
          )}

          {questions.map((q, qIdx) => (
            <div key={qIdx} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex justify-between items-start mb-3 gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-100 rounded-full px-2 py-1">
                    {TYPE_LABELS[q.type] || q.type}
                  </span>
                  <input
                    type="text"
                    value={q.prompt}
                    onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                    placeholder="Instrucción para el estudiante"
                    className="flex-1 border border-slate-300 rounded-lg p-2 text-sm font-bold"
                  />
                </div>
                <button
                  onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                  className="shrink-0 text-rose-500 hover:text-rose-700 text-xs font-black uppercase"
                >
                  🗑️ Quitar
                </button>
              </div>

              {q.type === 'matching' && (
                <>
                  <div className="space-y-2">
                    {q.pairs.map((pair, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                        <select
                          value={pair.left.type}
                          onChange={(e) => updatePair(qIdx, pIdx, { left: { type: e.target.value, value: '' } })}
                          className="text-xs border border-slate-300 rounded-md p-1.5 font-bold shrink-0"
                        >
                          <option value="text">Texto</option>
                          <option value="image">Imagen</option>
                        </select>

                        {pair.left.type === 'image' ? (
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            {pair.left.value && (
                              <img
                                src={pair.left.value}
                                alt=""
                                className="w-10 h-10 object-cover rounded-md border border-slate-200 shrink-0"
                              />
                            )}
                            <ImageUploadField
                              value={pair.left.value}
                              onChange={(url) => updatePair(qIdx, pIdx, { left: { type: 'image', value: url } })}
                              folder="curiosidades"
                              inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={pair.left.value}
                            onChange={(e) => updatePair(qIdx, pIdx, { left: { type: 'text', value: e.target.value } })}
                            placeholder="Elemento (izquierda)"
                            className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs min-w-0"
                          />
                        )}

                        <span className="text-slate-300 shrink-0">→</span>

                        <input
                          type="text"
                          value={pair.answer}
                          onChange={(e) => updatePair(qIdx, pIdx, { answer: e.target.value })}
                          placeholder="Respuesta correcta"
                          className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs min-w-0"
                        />

                        <button
                          onClick={() => removePair(qIdx, pIdx)}
                          className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => addPair(qIdx)}
                    className="mt-2 text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
                  >
                    + Agregar par
                  </button>

                  <div className="mt-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Distractores extra (opcional, uno por línea)
                    </label>
                    <textarea
                      value={(q.distractors || []).join('\n')}
                      onChange={(e) =>
                        updateQuestion(qIdx, {
                          distractors: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      rows={2}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs mt-1"
                      placeholder="Respuestas incorrectas extra que aparecerán en el banco de opciones"
                    />
                  </div>
                </>
              )}

              {q.type === 'image_select' && (
                <>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Marca la casilla de cada opción correcta — marcar más de una la convierte en una pregunta de
                    "elige {(q.correctIndices || []).length || 'N'}".
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = (q.correctIndices || []).includes(oIdx);
                      return (
                        <div
                          key={oIdx}
                          className={`bg-white border rounded-lg p-2 flex flex-col gap-2 ${
                            isCorrect ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200'
                          }`}
                        >
                          {opt.img && (
                            <img src={opt.img} alt="" className="w-full h-20 object-cover rounded-md border border-slate-200" />
                          )}
                          <ImageUploadField
                            value={opt.img}
                            onChange={(url) => updateImageOption(qIdx, oIdx, { img: url })}
                            folder="curiosidades"
                            inputClassName="w-full border border-slate-300 rounded-md p-1 text-[10px] font-mono"
                          />
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => updateImageOption(qIdx, oIdx, { label: e.target.value })}
                            placeholder="Etiqueta opcional"
                            className="w-full border border-slate-300 rounded-md p-1.5 text-xs"
                          />
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            <input
                              type="checkbox"
                              checked={isCorrect}
                              onChange={() => toggleCorrectOption(qIdx, oIdx)}
                            />
                            Correcta
                          </label>
                          <button
                            onClick={() => removeImageOption(qIdx, oIdx)}
                            className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700"
                          >
                            ✕ Quitar opción
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => addImageOption(qIdx)}
                    className="mt-3 text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
                  >
                    + Agregar opción
                  </button>
                </>
              )}
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={() => setQuestions((prev) => [...prev, emptyMatchingQuestion()])}
              className="flex-1 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50"
            >
              + Pregunta de Emparejar
            </button>
            <button
              onClick={() => setQuestions((prev) => [...prev, emptyImageSelectQuestion()])}
              className="flex-1 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50"
            >
              + Pregunta de Selección de Imagen
            </button>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-end gap-3">
          {error && <p className="text-xs text-rose-600 font-bold mr-auto">{error}</p>}
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-slate-500 font-bold text-xs uppercase disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Preguntas'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CuriosidadQuestionsModal;
