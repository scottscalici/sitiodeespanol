import React, { useState } from 'react';
import { QUESTION_TYPES, TYPE_LABELS, finalizeQuestion, reconstructQuestion } from '../../shared/questionTypes';
import { validateQuestion } from '../../utils/validateQuestion';

// Reopening an already-saved song only has each question's final, persisted
// shape — never the raw, freely-typed text some editors actually edit (e.g.
// word_bank_cloze's {{word}}-tagged passage). Each type's own
// reconstructQuestion() rebuilds that raw text once on load, same as
// CuriosidadQuestionsModal.
const reconstructEditableFields = (rawQuestions) => (rawQuestions || []).map(reconstructQuestion);

// Trimmed version of CuriosidadQuestionsModal for Música's "Preguntas de
// Comprensión" — same question-list/type-dispatch/move/duplicate/remove
// mechanics, without Jeopardy mode or the per-item grading fields (gradeWeight,
// excused), since any score here is completion-based ranking points awarded
// by MusicaEngine.jsx, never a gradebook percentage.
const MusicaQuestionsModal = ({ cancion, onClose, onSave }) => {
  const [questions, setQuestions] = useState(() => reconstructEditableFields(cancion.questions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Bulk-paste importer — accepts a JSON array of question objects (or
  // { questions: [...] }) in the same raw/editable shape the curiosidades-
  // importer skill already produces, validated with the same shared
  // validateQuestion() every other bulk importer uses. Appended straight
  // into local `questions` state, unfinalized — they go through the same
  // finalizeQuestion() pass as every manually-added question does on
  // "Guardar Preguntas", so no extra step is needed here. Images must
  // already be full URLs — unlike CuriosidadesUploader, this lightweight
  // in-modal importer has no file-picker/upload step of its own.
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');

  // Accepts three shapes, since all three are natural ways to paste this:
  // a bare array of question objects, { questions: [...] } (one song's own
  // shape), or an array of song-like wrappers each with their own
  // `questions` array (e.g. [{ title, questions: [...] }]) — flattened
  // together in that last case.
  const extractQuestionsArray = (parsed) => {
    if (Array.isArray(parsed?.questions)) return parsed.questions;
    if (!Array.isArray(parsed)) return null;
    if (parsed.every((item) => item && typeof item === 'object' && 'type' in item)) return parsed;
    if (parsed.length > 0 && parsed.every((item) => item && Array.isArray(item.questions))) {
      return parsed.flatMap((item) => item.questions);
    }
    return null;
  };

  const handleImport = () => {
    let parsed;
    try {
      parsed = JSON.parse(importText);
    } catch (e) {
      setImportStatus(`❌ JSON inválido: ${e.message}`);
      return;
    }
    const arr = extractQuestionsArray(parsed);
    if (!arr) {
      setImportStatus('❌ Se espera un arreglo de preguntas, { "questions": [...] }, o un arreglo de canciones cada una con su propio "questions".');
      return;
    }
    const errors = arr.flatMap((q, i) => validateQuestion(q, i + 1, cancion.titulo || 'Canción'));
    if (errors.length > 0) {
      setImportStatus(`❌ ${errors.length} error(es) — nada se importó:\n${errors.join('\n')}`);
      return;
    }
    setQuestions((prev) => [...prev, ...arr]);
    setImportText('');
    setImportOpen(false);
    setImportStatus(`✅ Se importaron ${arr.length} pregunta(s).`);
  };

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

          <div className="border-t border-slate-200 pt-4">
            {!importOpen ? (
              <button
                onClick={() => setImportOpen(true)}
                className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800"
              >
                📋 Importar Preguntas (JSON)
              </button>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Pega un arreglo JSON de preguntas (p. ej. del skill de curiosidades)
                </p>
                <p className="text-[10px] text-slate-400 font-mono mb-2">
                  [{'{'}"type":"word_bank_cloze","prompt":"...","rawText":"...{'{'}{'{'}respuesta{'}'}{'}'}...","distractorsText":"..."{'}'}, ...] — si una pregunta lleva imagen, usa una URL completa (este importador no sube archivos).
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportStatus(''); }}
                  rows={6}
                  placeholder='[{"type":"word_bank_cloze","prompt":"¿Qué metáfora usa el artista?","rawText":"Usa {{el vuelo}} para describir..."}]'
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={handleImport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest"
                  >
                    Importar
                  </button>
                  <button
                    onClick={() => { setImportOpen(false); setImportText(''); setImportStatus(''); }}
                    className="text-xs font-bold text-slate-500 uppercase"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {importStatus && <p className="text-xs text-slate-600 font-bold mt-2 whitespace-pre-wrap">{importStatus}</p>}
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
