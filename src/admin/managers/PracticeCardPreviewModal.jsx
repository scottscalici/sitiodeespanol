import { useState, useRef } from 'react';
import { QUESTION_TYPES, getItemCount, finalizeQuestion } from '../../shared/questionTypes';

// Plays the Creator's current in-progress questions through the EXACT same
// student-facing Renderers PracticeCardEngine uses (mode="deferred"), so
// "how will this actually look/behave for a student" never requires
// saving, assigning a día, and going to find it as a student first. Pure
// client-side simulation — no Firestore writes, no points, nothing saved —
// so closing it and continuing to edit the real card is always safe.
// `questions` is the Creator's raw editor-shape state; finalizeQuestion
// converts it to the stored shape the Renderers actually read, same
// conversion handleSave runs right before writing to Firestore.
export default function PracticeCardPreviewModal({ questions, title, onClose }) {
  // Lazy useState initializer (not useRef) — computed once on mount and
  // never updated, but read directly during render below, which the ref
  // equivalent isn't allowed to be.
  const [finalQuestions] = useState(() => questions.map(finalizeQuestion));
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null); // { correctCount, totalItems, grade }
  const questionStatesRef = useRef({});

  const totalItems = finalQuestions.reduce((sum, q) => sum + getItemCount(q), 0);

  const handleStateChange = (idx, state) => {
    questionStatesRef.current = { ...questionStatesRef.current, [idx]: state };
  };

  const handleSubmit = () => {
    const perQuestionResults = finalQuestions.map((q, idx) => {
      const mod = QUESTION_TYPES[q.type];
      const state = questionStatesRef.current[idx];
      return mod?.gradeState ? mod.gradeState(q, state) : [];
    });
    const correctCount = perQuestionResults.flat().filter(Boolean).length;
    const grade = totalItems > 0 ? Math.round((correctCount / totalItems) * 100) : 0;
    setResult({ correctCount, totalItems, grade });
    setSubmitted(true);
  };

  const handleReset = () => {
    questionStatesRef.current = {};
    setSubmitted(false);
    setResult(null);
  };

  if (finalQuestions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
          <p className="text-slate-500 font-bold">Agrega al menos una pregunta para ver la vista previa.</p>
          <button onClick={onClose} className="mt-4 px-5 py-2.5 bg-slate-700 text-white font-black rounded-lg text-xs uppercase tracking-widest">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-black text-slate-800">👁️ Vista Previa{title ? `: ${title}` : ''}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Simulación local — nada aquí se guarda ni cuenta como intento real
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl px-2">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {submitted && result && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resultado simulado</p>
              <p className="text-3xl font-black text-emerald-500">{result.grade}%</p>
              <p className="text-xs text-slate-500 font-bold">{result.correctCount} de {result.totalItems} correctas</p>
            </div>
          )}

          {finalQuestions.map((q, idx) => {
            const TypeRenderer = QUESTION_TYPES[q.type]?.Renderer;
            if (!TypeRenderer) {
              return (
                <div key={idx} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-600 font-bold">
                  Pregunta {idx + 1}: tipo "{q.type}" desconocido.
                </div>
              );
            }
            return (
              <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pregunta {idx + 1}</p>
                <TypeRenderer
                  mode="deferred"
                  question={q}
                  submitted={submitted}
                  initialState={questionStatesRef.current[idx]}
                  onStateChange={(state) => handleStateChange(idx, state)}
                />
              </div>
            );
          })}

          <div className="flex gap-3 pt-2">
            {!submitted ? (
              <button
                onClick={handleSubmit}
                className="flex-1 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs uppercase tracking-widest"
              >
                Enviar (simulado)
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-xl text-xs uppercase tracking-widest"
              >
                🔄 Reiniciar Vista Previa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
