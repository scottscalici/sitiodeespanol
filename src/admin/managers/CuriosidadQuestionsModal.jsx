import React, { useState } from 'react';
import QuestionPoolPickerModal from '../shared/QuestionPoolPickerModal';
import { addPoolQuestion } from '../../utils/questionPool';
import {
  QUESTION_TYPES,
  TYPE_LABELS,
  finalizeQuestion,
  reconstructQuestion,
  parseBulkRow,
  parseBulkSections,
  shuffle,
} from '../../shared/questionTypes';

// Reopening an already-saved curiosidad only has each question's final,
// persisted shape — never the raw, freely-typed text some editors actually
// edit (e.g. word_bank_cloze's {{word}}-tagged passage, matching's
// distractors textarea). Each type's own reconstructQuestion() rebuilds
// that raw text once on load so editing an existing question starts from
// something that reads naturally, instead of a blank textarea next to
// already-filled-in data.
const reconstructEditableFields = (rawQuestions) => (rawQuestions || []).map(reconstructQuestion);

const CuriosidadQuestionsModal = ({ curiosidad, onClose, onSave }) => {
  const [questions, setQuestions] = useState(() => reconstructEditableFields(curiosidad.questions));
  const [minSeconds, setMinSeconds] = useState(curiosidad.minSeconds ?? 60);
  // How many points this is worth toward the pooled "Promedio Calentamientos"
  // class grade (completion-only, same as practice cards' own gradeWeight) —
  // separate from the ranking points students earn, which are computed from
  // accuracy in CuriosidadQuizEngine regardless of this value.
  const [gradeWeight, setGradeWeight] = useState(curiosidad.gradeWeight ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Explicit, deliberate choice between a normal sequential curiosidad (even
  // one made of several multiple_choice questions, e.g. a few MC questions
  // about Las Fallas) and a Jeopardy-style board grouped into categories —
  // rather than leaving the student engine's category picker to switch on by
  // accident just because a Categoría field happened to get typed into.
  // Defaults to whatever this curiosidad's existing questions already imply,
  // so reopening a real Jeopardy board doesn't reset it to Secuencial.
  const [jeopardyMode, setJeopardyMode] = useState(
    (curiosidad.questions || []).some((q) => q.type === 'multiple_choice' && q.category)
  );
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);

  const updateQuestion = (qIdx, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)));
  };

  // --- Bulk import (multiple_choice only) ---
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');

  const handleBulkImport = () => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map(parseBulkRow);
    const valid = parsed.filter(Boolean);
    const invalidCount = parsed.length - valid.length;

    if (valid.length === 0) {
      setBulkStatus('No se pudo leer ninguna línea. Formato: categoría | pregunta | respuesta | distractor1 | distractor2');
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

  // --- Bulk import (line_bank_cloze "sections" — several NEW questions at
  // once, split on divider lines) ---
  const [sectionImportOpen, setSectionImportOpen] = useState(false);
  const [sectionBulkText, setSectionBulkText] = useState('');
  const [sectionBulkStatus, setSectionBulkStatus] = useState('');

  const handleSectionImport = () => {
    const newQuestions = parseBulkSections(sectionBulkText);
    if (newQuestions.length === 0) {
      setSectionBulkStatus('No se encontró ninguna línea para importar.');
      return;
    }
    setQuestions((prev) => [...prev, ...newQuestions]);
    setSectionBulkText('');
    setSectionImportOpen(false);
    setSectionBulkStatus(`Se importaron ${newQuestions.length} sección(es).`);
  };

  // Entries picked from the shared pool already carry a real pool doc id —
  // passed through as `poolId` so handleSave's sync step (below) recognizes
  // them as already-pooled and skips writing a duplicate.
  const handlePoolPicked = (pickedEntries) => {
    const newQuestions = pickedEntries.map((entry) => ({
      type: 'multiple_choice',
      prompt: entry.clue,
      category: entry.category || '',
      options: shuffle([entry.answer, ...(entry.distractors || [])]),
      answer: entry.answer,
      poolId: entry.id,
    }));
    setQuestions((prev) => [...prev, ...newQuestions]);
    setPoolPickerOpen(false);
  };

  // Saves straight to the database (see CuriosidadesManager's
  // handleSaveQuestions) — the modal stays open and shows an error on
  // failure instead of closing and losing the unsaved edits, and only
  // closes once the write has actually succeeded.
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Mirror every not-yet-pooled multiple_choice question into the
      // shared question_pool, so it's reusable later even outside this
      // curiosidad — a blank question the admin added but never filled in
      // is skipped rather than pooling junk. Written here (at save time)
      // rather than the moment each question is created, so a typo fixed
      // before saving is what actually lands in the pool. Mapped over the
      // RAW questions (not yet finalized) and written back to local state
      // as-is — multiple_choice questions have no raw editable fields to
      // lose, so this never clobbers another type's in-progress edits if a
      // later step in this same save fails.
      const poolSyncedQuestions = await Promise.all(
        questions.map(async (q) => {
          if (q.type !== 'multiple_choice' || q.poolId || !q.prompt || !q.answer) return q;
          const poolId = await addPoolQuestion({
            clue: q.prompt,
            answer: q.answer,
            distractors: q.options.filter((o) => o && o !== q.answer),
            category: q.category || '',
            sourceCuriosidadId: curiosidad.id,
          });
          return { ...q, poolId };
        })
      );
      setQuestions(poolSyncedQuestions);

      // Each type converts its own raw, freely-typed editing fields into
      // the final persisted shape here — see e.g. word_bank_cloze's
      // finalizeQuestion for why this has to happen at save time.
      const finalizedQuestions = poolSyncedQuestions.map(finalizeQuestion);

      // In Secuencial mode, a category — however it got there (typed in
      // earlier, or carried over from a pool entry) — would wrongly trip the
      // student engine's category picker, which only checks whether ANY
      // question has one. Stripping it here keeps that check in sync with
      // the explicit mode choice instead of an incidental field value.
      const modeCorrectedQuestions = jeopardyMode
        ? finalizedQuestions
        : finalizedQuestions.map((q) => (q.type === 'multiple_choice' ? { ...q, category: '' } : q));

      await onSave({
        questions: modeCorrectedQuestions,
        minSeconds: Number(minSeconds) || 60,
        gradeWeight: Number(gradeWeight) || 1,
      });
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
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div>
              <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Modo de la Curiosidad</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {jeopardyMode
                  ? 'Los estudiantes eligen una categoría a la vez, estilo Jeopardy.'
                  : 'Las preguntas corren en una sola secuencia, como cualquier otra curiosidad.'}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setJeopardyMode(false)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  !jeopardyMode ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-500'
                }`}
              >
                Secuencial
              </button>
              <button
                onClick={() => setJeopardyMode(true)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  jeopardyMode ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-500'
                }`}
              >
                🏆 Jeopardy (categorías)
              </button>
            </div>
          </div>

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
                  <button
                    onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                    className="shrink-0 text-rose-500 hover:text-rose-700 text-xs font-black uppercase"
                  >
                    🗑️ Quitar
                  </button>
                </div>

                {TypeEditor && (
                  <TypeEditor
                    question={q}
                    onChange={(patch) => updateQuestion(qIdx, patch)}
                    instanceId={qIdx}
                    showCategory={jeopardyMode}
                  />
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
            {!sectionImportOpen ? (
              <button
                onClick={() => setSectionImportOpen(true)}
                className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
              >
                📋 Importar Secciones (Líneas con Banco de Palabras)
              </button>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Pega varias secciones a la vez — cada una se convierte en su propia pregunta, en vez de mezclarse
                  todas juntas
                </p>
                <p className="text-[10px] text-slate-400 font-mono mb-2">
                  Separa cada sección con una línea "---" (o "## Título de la sección" para ponerle un título visible
                  para el estudiante)
                </p>
                <textarea
                  value={sectionBulkText}
                  onChange={(e) => setSectionBulkText(e.target.value)}
                  rows={6}
                  placeholder={
                    '## Sección 3\n' +
                    'Tengo el libro. → {{Lo}} tengo.\n' +
                    'Veo a María. → {{La}} veo.\n' +
                    '---\n' +
                    '## Sección 4\n' +
                    'Ella me pasó el balón. → Ella {{me}} {{lo}} pasó.'
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={handleSectionImport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest"
                  >
                    Importar
                  </button>
                  <button
                    onClick={() => {
                      setSectionImportOpen(false);
                      setSectionBulkText('');
                      setSectionBulkStatus('');
                    }}
                    className="text-xs font-bold text-slate-500 uppercase"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {sectionBulkStatus && <p className="text-xs text-slate-600 font-bold mt-2">{sectionBulkStatus}</p>}
          </div>

          {jeopardyMode && (
          <div className="border-t border-slate-200 pt-4">
            {!bulkImportOpen ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setBulkImportOpen(true)}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
                >
                  📋 Importar en Lote (Opción Múltiple)
                </button>
                <button
                  onClick={() => setPoolPickerOpen(true)}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
                >
                  🗂️ Elegir de la Reserva
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Una pregunta por línea — útil para pegar muchas de una vez
                </p>
                <p className="text-[10px] text-slate-400 font-mono mb-2">
                  categoría | pregunta | respuesta correcta | distractor 1 | distractor 2 | distractor 3
                </p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={5}
                  placeholder={
                    'Geografía Extrema | El salar más grande del mundo | Salar de Uyuni | Atacama | Sahara\n' +
                    'Gastronomía | Plato peruano con pescado marinado en limón | Ceviche | Mole | Paella'
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={handleBulkImport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest"
                  >
                    Importar
                  </button>
                  <button
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
          )}
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

        {poolPickerOpen && (
          <QuestionPoolPickerModal onSelect={handlePoolPicked} onClose={() => setPoolPickerOpen(false)} />
        )}
      </div>
    </div>
  );
};

export default CuriosidadQuestionsModal;
