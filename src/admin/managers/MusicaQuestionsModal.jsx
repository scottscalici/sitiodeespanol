import React, { useState } from 'react';
import { QUESTION_TYPES, TYPE_LABELS, finalizeQuestion, reconstructQuestion } from '../../shared/questionTypes';

// Reopening an already-saved song only has each question's final, persisted
// shape — never the raw, freely-typed text some editors actually edit (e.g.
// word_bank_cloze's {{word}}-tagged passage). Each type's own
// reconstructQuestion() rebuilds that raw text once on load, same as
// CuriosidadQuestionsModal.
const reconstructEditableFields = (rawQuestions) => (rawQuestions || []).map(reconstructQuestion);

// Trimmed version of CuriosidadQuestionsModal for Música's "Preguntas de
// Comprensión" — same question-list/type-dispatch/move/duplicate/remove
// mechanics, without Jeopardy mode, grading fields, or bulk-import, since
// these questions are ungraded practice attached to a song, not a scored
// curiosidad or practice card.
const MusicaQuestionsModal = ({ cancion, onClose, onSave }) => {
  const [questions, setQuestions] = useState(() => reconstructEditableFields(cancion.questions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateQuestion = (qIdx, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)));
  };

  const duplicateQuestion = (qIdx) => {
    setQuestions((prev) => {
      const copy = JSON.parse(JSON.stringify(prev[qIdx]));
      const next = [...prev];
      next.splice(qIdx + 1, 0, copy);
      return next;
    });
  };

  const moveQuestion = (qIdx, direction) => {
    setQuestions((prev) => {
      const targetIdx = qIdx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[qIdx], next[targetIdx]] = [next[targetIdx], next[qIdx]];
      return next;
    });
  };

  // Saves into the parent editor's own local state (see MusicaEditor's
  // onSave) rather than straight to Firestore — Música's editor already
  // saves every field together with one "Guardar Canción" button, unlike
  // Curiosidades' grid-row pattern.
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const finalizedQuestions = questions.map(finalizeQuestion);
      await onSave(finalizedQuestions);
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
            <h2 className="text-lg font-black text-slate-800">Preguntas: {cancion.titulo || 'Canción'}</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              {questions.length} pregunta{questions.length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700 text-xl px-2 disabled:opacity-30">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {questions.length === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-6">
              Todavía no hay preguntas. Agrega una abajo.
            </p>
          )}

          {questions.map((q, qIdx) => {
            const TypeEditor = QUESTION_TYPES[q.type]?.Editor;
            return (
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
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => moveQuestion(qIdx, -1)}
                      disabled={qIdx === 0}
                      title="Mover arriba"
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-slate-400 text-sm px-1"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveQuestion(qIdx, 1)}
                      disabled={qIdx === questions.length - 1}
                      title="Mover abajo"
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-slate-400 text-sm px-1"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => duplicateQuestion(qIdx)}
                      title="Duplicar pregunta"
                      className="text-indigo-500 hover:text-indigo-700 text-xs font-black uppercase px-1"
                    >
                      ⧉ Duplicar
                    </button>
                    <button
                      onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                      className="text-rose-500 hover:text-rose-700 text-xs font-black uppercase"
                    >
                      🗑️ Quitar
                    </button>
                  </div>
                </div>

                {TypeEditor && (
                  <TypeEditor question={q} onChange={(patch) => updateQuestion(qIdx, patch)} instanceId={qIdx} />
                )}
              </div>
            );
          })}

          <div className="flex gap-3">
            {Object.values(QUESTION_TYPES).map((mod) => (
              <button
                key={mod.TYPE_KEY}
                onClick={() => setQuestions((prev) => [...prev, mod.emptyQuestion()])}
                className="flex-1 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50"
              >
                + Pregunta de {mod.TYPE_LABEL}
              </button>
            ))}
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

export default MusicaQuestionsModal;
