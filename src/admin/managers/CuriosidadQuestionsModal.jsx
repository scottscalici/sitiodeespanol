import React, { useState } from 'react';
import ImageUploadField from '../shared/ImageUploadField';
import QuestionPoolPickerModal from '../shared/QuestionPoolPickerModal';
import { addPoolQuestion } from '../../utils/questionPool';

// Shuffles a copy of the array (same simple approach as the student engine's
// own shuffle — order just needs to vary, not be cryptographically random).
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

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

// A passage of text with one or more blanks, each blank getting its OWN
// dropdown of options (unlike a shared word bank) — the admin types the
// literal token "{{blank}}" wherever a blank belongs, and the blanks array
// below is kept in sync with however many tokens are currently in the text.
const BLANK_TOKEN = '{{blank}}';
const countBlanks = (text) => (text.match(/\{\{blank\}\}/g) || []).length;
const emptyClozeBlank = () => ({ options: ['', ''], answer: '' });
const emptyDropdownClozeQuestion = () => ({ type: 'dropdown_cloze', prompt: '', img: '', text: '', blanks: [] });

// Same "{{blank}}"-tagged passage, but every blank shares ONE word bank
// (typed once) instead of each blank getting its own option list — the
// classic "fill in the blanks using the word bank" worksheet, where a word
// already used correctly in one blank disappears from the others. Admin
// types the shared bank once (correct answers + any extra distractors all
// together) and just assigns which bank word is correct for each blank.
const emptyWordBankClozeQuestion = () => ({ type: 'word_bank_cloze', prompt: '', img: '', text: '', wordBank: [], answers: [] });

// A single clue with 2-4 text options, one correct — the "Jeopardy-style"
// question type. `category` groups questions into the student-facing
// category picker (see CuriosidadQuizEngine); questions with no category
// just play in the normal linear sequence like any other type. Every
// multiple_choice question gets mirrored into the shared question_pool
// collection on save (see handleSave below) so it's reusable in future
// activities beyond this one curiosidad.
const emptyMultipleChoiceQuestion = () => ({ type: 'multiple_choice', prompt: '', category: '', options: ['', ''], answer: '' });

const TYPE_LABELS = {
  matching: 'Emparejar',
  image_select: 'Selección de Imagen',
  dropdown_cloze: 'Cloze con Menús',
  word_bank_cloze: 'Cloze con Banco de Palabras',
  multiple_choice: 'Opción Múltiple',
};

// Bulk-paste format, one clue per line: categoría | pregunta | respuesta | distractor1 | distractor2 | distractor3
// (1 to 3 distractors — 2 to 4 total options). Point values aren't part of
// this at all: they're purely cosmetic on a future Jeopardy board and have
// no bearing on grading, so there's nothing to assign here.
const parseBulkRow = (line) => {
  const parts = line.split('|').map((s) => s.trim());
  if (parts.length < 4) return null;
  const [category, clue, answer, ...rest] = parts;
  const distractors = rest.map((d) => d.trim()).filter(Boolean).slice(0, 3);
  if (!category || !clue || !answer || distractors.length === 0) return null;
  return {
    type: 'multiple_choice',
    prompt: clue,
    category,
    options: shuffle([answer, ...distractors]),
    answer,
  };
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

  // --- Dropdown-cloze-type helpers ---
  // Changing the passage text re-counts "{{blank}}" tokens and grows/shrinks
  // the blanks array to match, preserving existing blanks by position so
  // editing text before/after an existing blank doesn't lose its options.
  const updateClozeText = (qIdx, text) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const needed = countBlanks(text);
        let blanks = q.blanks || [];
        if (needed > blanks.length) {
          blanks = [...blanks, ...Array.from({ length: needed - blanks.length }, emptyClozeBlank)];
        } else if (needed < blanks.length) {
          blanks = blanks.slice(0, needed);
        }
        return { ...q, text, blanks };
      })
    );
  };

  const addClozeBlankOption = (qIdx, bIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, blanks: q.blanks.map((b, j) => (j === bIdx ? { ...b, options: [...b.options, ''] } : b)) }
          : q
      )
    );
  };

  const updateClozeBlankOption = (qIdx, bIdx, oIdx, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          blanks: q.blanks.map((b, j) => {
            if (j !== bIdx) return b;
            const oldValue = b.options[oIdx];
            return {
              ...b,
              options: b.options.map((o, k) => (k === oIdx ? value : o)),
              // The correct answer is stored by value, not index — keep it
              // pointing at the same option if that's the one being edited.
              answer: b.answer === oldValue ? value : b.answer,
            };
          }),
        };
      })
    );
  };

  const removeClozeBlankOption = (qIdx, bIdx, oIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          blanks: q.blanks.map((b, j) => {
            if (j !== bIdx) return b;
            const removedValue = b.options[oIdx];
            return {
              ...b,
              options: b.options.filter((_, k) => k !== oIdx),
              answer: b.answer === removedValue ? '' : b.answer,
            };
          }),
        };
      })
    );
  };

  const setClozeBlankAnswer = (qIdx, bIdx, value) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, blanks: q.blanks.map((b, j) => (j === bIdx ? { ...b, answer: value } : b)) } : q
      )
    );
  };

  // --- Word-bank-cloze-type helpers ---
  // Same token-counting idea as updateClozeText, but keeps a flat `answers`
  // array (one correct word per blank) instead of growing/shrinking a full
  // blanks array, since all blanks share the one wordBank list below.
  const updateWordBankClozeText = (qIdx, text) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const needed = countBlanks(text);
        let answers = q.answers || [];
        if (needed > answers.length) {
          answers = [...answers, ...Array(needed - answers.length).fill('')];
        } else if (needed < answers.length) {
          answers = answers.slice(0, needed);
        }
        return { ...q, text, answers };
      })
    );
  };

  const updateWordBank = (qIdx, text) => {
    const wordBank = text.split('\n').map((w) => w.trim()).filter(Boolean);
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, wordBank } : q)));
  };

  const setWordBankAnswer = (qIdx, bIdx, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, answers: q.answers.map((a, j) => (j === bIdx ? value : a)) } : q))
    );
  };

  // --- Multiple-choice-type helpers ---
  const addMCOption = (qIdx) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, ''] } : q)));
  };

  const updateMCOption = (qIdx, oIdx, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const oldValue = q.options[oIdx];
        return {
          ...q,
          options: q.options.map((o, j) => (j === oIdx ? value : o)),
          answer: q.answer === oldValue ? value : q.answer,
        };
      })
    );
  };

  const removeMCOption = (qIdx, oIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const removedValue = q.options[oIdx];
        return {
          ...q,
          options: q.options.filter((_, j) => j !== oIdx),
          answer: q.answer === removedValue ? '' : q.answer,
        };
      })
    );
  };

  const setMCAnswer = (qIdx, value) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, answer: value } : q)));
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
      // In Secuencial mode, a category — however it got there (typed in
      // earlier, or carried over from a pool entry) — would wrongly trip the
      // student engine's category picker, which only checks whether ANY
      // question has one. Stripping it here keeps that check in sync with
      // the explicit mode choice instead of an incidental field value.
      const modeCorrectedQuestions = jeopardyMode
        ? questions
        : questions.map((q) => (q.type === 'multiple_choice' ? { ...q, category: '' } : q));

      // Mirror every not-yet-pooled multiple_choice question into the
      // shared question_pool, so it's reusable later even outside this
      // curiosidad — a blank question the admin added but never filled in
      // is skipped rather than pooling junk. Written here (at save time)
      // rather than the moment each question is created, so a typo fixed
      // before saving is what actually lands in the pool.
      const poolSyncedQuestions = await Promise.all(
        modeCorrectedQuestions.map(async (q) => {
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
      await onSave({
        questions: poolSyncedQuestions,
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

              {q.type === 'dropdown_cloze' && (
                <>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Escribe el párrafo y pon <code className="bg-slate-200 px-1 rounded">{BLANK_TOKEN}</code> donde
                    va cada espacio en blanco — cada uno tendrá su propio menú de opciones.
                  </p>

                  <div className="flex items-start gap-2 mb-3">
                    {q.img && (
                      <img src={q.img} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 shrink-0" />
                    )}
                    <ImageUploadField
                      value={q.img}
                      onChange={(url) => updateQuestion(qIdx, { img: url })}
                      folder="curiosidades"
                      placeholder="Imagen opcional (p. ej. foto del cóndor)"
                      inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
                    />
                  </div>

                  <textarea
                    value={q.text}
                    onChange={(e) => updateClozeText(qIdx, e.target.value)}
                    rows={3}
                    placeholder={`El cóndor es ${BLANK_TOKEN} de las aves más grandes del mundo.`}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
                  />

                  {q.blanks.length === 0 ? (
                    <p className="text-xs text-slate-400 italic mt-2">
                      Agrega al menos un {BLANK_TOKEN} al texto para crear un espacio en blanco.
                    </p>
                  ) : (
                    <div className="space-y-3 mt-3">
                      {q.blanks.map((blank, bIdx) => (
                        <div key={bIdx} className="bg-white border border-slate-200 rounded-lg p-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Espacio en blanco {bIdx + 1}
                          </p>
                          <div className="space-y-1.5">
                            {blank.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`cloze-${qIdx}-${bIdx}-answer`}
                                  checked={blank.answer === opt && opt !== ''}
                                  onChange={() => setClozeBlankAnswer(qIdx, bIdx, opt)}
                                  title="Marcar como respuesta correcta"
                                />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateClozeBlankOption(qIdx, bIdx, oIdx, e.target.value)}
                                  placeholder="Opción"
                                  className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs"
                                />
                                <button
                                  onClick={() => removeClozeBlankOption(qIdx, bIdx, oIdx)}
                                  className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => addClozeBlankOption(qIdx, bIdx)}
                            className="mt-2 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
                          >
                            + Agregar opción
                          </button>
                          {!blank.answer && (
                            <p className="text-[10px] text-amber-600 font-bold mt-1">
                              Marca con el círculo cuál opción es la correcta.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {q.type === 'word_bank_cloze' && (
                <>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Escribe el párrafo y pon <code className="bg-slate-200 px-1 rounded">{BLANK_TOKEN}</code> donde
                    va cada espacio en blanco — todos comparten el mismo banco de palabras de abajo.
                  </p>

                  <div className="flex items-start gap-2 mb-3">
                    {q.img && (
                      <img src={q.img} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 shrink-0" />
                    )}
                    <ImageUploadField
                      value={q.img}
                      onChange={(url) => updateQuestion(qIdx, { img: url })}
                      folder="curiosidades"
                      placeholder="Imagen opcional"
                      inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
                    />
                  </div>

                  <textarea
                    value={q.text}
                    onChange={(e) => updateWordBankClozeText(qIdx, e.target.value)}
                    rows={3}
                    placeholder={`El pato nada en ${BLANK_TOKEN} y come ${BLANK_TOKEN}.`}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
                  />

                  <div className="mt-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Banco de palabras (una por línea — incluye las respuestas correctas y cualquier distractor extra)
                    </label>
                    <textarea
                      value={(q.wordBank || []).join('\n')}
                      onChange={(e) => updateWordBank(qIdx, e.target.value)}
                      rows={4}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono mt-1"
                      placeholder={'agua\npan\nlago\n...'}
                    />
                  </div>

                  {q.answers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic mt-2">
                      Agrega al menos un {BLANK_TOKEN} al texto para crear un espacio en blanco.
                    </p>
                  ) : (
                    <div className="space-y-2 mt-3">
                      {q.answers.map((answer, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">
                            Espacio {bIdx + 1}
                          </span>
                          <select
                            value={answer}
                            onChange={(e) => setWordBankAnswer(qIdx, bIdx, e.target.value)}
                            className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs"
                          >
                            <option value="">— Elige la palabra correcta —</option>
                            {(q.wordBank || []).map((word, wIdx) => (
                              <option key={wIdx} value={word}>
                                {word}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                  {(q.wordBank || []).length === 0 && (
                    <p className="text-[10px] text-amber-600 font-bold mt-1">
                      Agrega palabras al banco arriba antes de asignar respuestas.
                    </p>
                  )}
                </>
              )}

              {q.type === 'multiple_choice' && (
                <>
                  {jeopardyMode && (
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">
                        Categoría
                      </label>
                      <input
                        type="text"
                        value={q.category}
                        onChange={(e) => updateQuestion(qIdx, { category: e.target.value })}
                        placeholder="p. ej. Geografía Extrema — igual en cada pregunta de esta categoría"
                        className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs"
                      />
                    </div>
                  )}
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Marca con el círculo cuál opción es la correcta (2 a 4 opciones).
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`mc-${qIdx}-answer`}
                          checked={q.answer === opt && opt !== ''}
                          onChange={() => setMCAnswer(qIdx, opt)}
                          title="Marcar como respuesta correcta"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateMCOption(qIdx, oIdx, e.target.value)}
                          placeholder="Opción"
                          className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs"
                        />
                        <button
                          onClick={() => removeMCOption(qIdx, oIdx)}
                          className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  {q.options.length < 4 && (
                    <button
                      onClick={() => addMCOption(qIdx)}
                      className="mt-2 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
                    >
                      + Agregar opción
                    </button>
                  )}
                  {!q.answer && (
                    <p className="text-[10px] text-amber-600 font-bold mt-1">
                      Marca con el círculo cuál opción es la correcta.
                    </p>
                  )}
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
            <button
              onClick={() => setQuestions((prev) => [...prev, emptyDropdownClozeQuestion()])}
              className="flex-1 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50"
            >
              + Pregunta de Cloze con Menús
            </button>
            <button
              onClick={() => setQuestions((prev) => [...prev, emptyWordBankClozeQuestion()])}
              className="flex-1 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50"
            >
              + Pregunta de Cloze con Banco de Palabras
            </button>
            <button
              onClick={() => setQuestions((prev) => [...prev, emptyMultipleChoiceQuestion()])}
              className="flex-1 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50"
            >
              + Pregunta de Opción Múltiple
            </button>
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
