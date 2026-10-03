import React, { useState } from 'react';
import ImageUploadField from '../shared/ImageUploadField';

// Only the 'matching' question type exists so far — more types (image MC,
// image-grid select) get their own editor blocks here later, picked by the
// same `type` field the student engine branches on.
const emptyPair = () => ({ left: { type: 'text', value: '' }, answer: '' });
const emptyQuestion = () => ({ type: 'matching', prompt: '', pairs: [emptyPair()], distractors: [] });

const CuriosidadQuestionsModal = ({ curiosidad, onClose, onSave }) => {
  const [questions, setQuestions] = useState(curiosidad.questions || []);
  const [minSeconds, setMinSeconds] = useState(curiosidad.minSeconds ?? 60);

  const updateQuestion = (qIdx, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)));
  };

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

  const handleSave = () => {
    onSave({ questions, minSeconds: Number(minSeconds) || 60 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
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
              Tipo: Emparejar (más tipos próximamente)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              Tiempo mínimo (seg)
              <input
                type="number"
                value={minSeconds}
                onChange={(e) => setMinSeconds(e.target.value)}
                className="w-16 border border-slate-300 rounded-md p-1.5 text-center"
              />
            </label>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl px-2">
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
                <input
                  type="text"
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                  placeholder="Instrucción para el estudiante (ej. 'Empareja cada meme con su descripción')"
                  className="flex-1 border border-slate-300 rounded-lg p-2 text-sm font-bold"
                />
                <button
                  onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                  className="shrink-0 text-rose-500 hover:text-rose-700 text-xs font-black uppercase"
                >
                  🗑️ Quitar
                </button>
              </div>

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
            </div>
          ))}

          <button
            onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
            className="w-full py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50"
          >
            + Agregar Pregunta de Emparejar
          </button>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-slate-500 font-bold text-xs uppercase">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest"
          >
            Guardar Preguntas
          </button>
        </div>
      </div>
    </div>
  );
};

export default CuriosidadQuestionsModal;
