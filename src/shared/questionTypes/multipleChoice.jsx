import React, { useState, useEffect } from 'react';
import { shuffle } from './clozeShared';

export const TYPE_KEY = 'multiple_choice';
export const TYPE_LABEL = 'Opción Múltiple';

export const emptyQuestion = () => ({ type: 'multiple_choice', prompt: '', category: '', options: ['', ''], answer: '' });
export const getItemCount = () => 1;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

// Bulk-paste format, one clue per line: categoría | pregunta | respuesta | distractor1 | distractor2 | distractor3
// (1 to 3 distractors — 2 to 4 total options). Point values aren't part of
// this at all: for a Jeopardy-style board they're purely cosmetic and have
// no bearing on grading, so there's nothing to assign here.
export const parseBulkRow = (line) => {
  const parts = line.split('|').map((s) => s.trim());
  if (parts.length < 4) return null;
  const [category, clue, answer, ...rest] = parts;
  const distractors = rest.map((d) => d.trim()).filter(Boolean).slice(0, 3);
  if (!category || !clue || !answer || distractors.length === 0) return null;
  return { type: 'multiple_choice', prompt: clue, category, options: shuffle([answer, ...distractors]), answer };
};

// Same bulk-paste idea, minus the leading category column — for a consumer
// with no Jeopardy/category concept at all (Practice Cards), so its admin
// isn't asked to type a category that would never be shown or used.
// Format: pregunta | respuesta | distractor1 | distractor2 | distractor3
export const parseBulkRowPlain = (line) => {
  const parts = line.split('|').map((s) => s.trim());
  if (parts.length < 3) return null;
  const [clue, answer, ...rest] = parts;
  const distractors = rest.map((d) => d.trim()).filter(Boolean).slice(0, 3);
  if (!clue || !answer || distractors.length === 0) return null;
  return { type: 'multiple_choice', prompt: clue, category: '', options: shuffle([answer, ...distractors]), answer };
};

// --- Student-facing renderer ---
// Resolves the instant you click an option — one gradable item, first-
// attempt-only, lock on correct. Options render as a responsive grid: 2 or 4
// side-by-side pairs (4 wraps into a 2x2 block), 3 all in one row.
export const Renderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const [selectedIdx, setSelectedIdx] = useState(() => initialState?.selectedIdx ?? null);
  const [done, setDone] = useState(() => initialState?.done || false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const attemptedRef = React.useRef(false);

  // Resuming an already-resolved question re-shows the advance control
  // right away, without requiring another click.
  useEffect(() => {
    if (initialState?.done) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ selectedIdx, done });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, done]);

  const handleSelect = (oIdx) => {
    if (done) return;
    const isCorrect = question.options[oIdx] === question.answer;

    if (!attemptedRef.current) {
      attemptedRef.current = true;
      onItemFirstAttempt(0, isCorrect);
    }

    setSelectedIdx(oIdx);
    if (isCorrect) {
      setDone(true);
      onAllCorrect();
    } else {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 400);
    }
  };

  return (
    <div className={`grid gap-3 ${question.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {question.options.map((opt, oIdx) => {
        const isSelected = selectedIdx === oIdx;
        const showWrong = wrongFlash && isSelected;
        const showCorrect = done && isSelected;
        return (
          <button
            key={oIdx}
            onClick={() => handleSelect(oIdx)}
            disabled={done}
            className={`p-4 border-2 rounded-xl font-bold text-sm transition-all ${
              showWrong
                ? 'border-rose-500 bg-rose-950 text-rose-300'
                : showCorrect
                ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                : isSelected
                ? 'border-sky-400 bg-sky-950 text-slate-100'
                : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400'
            } ${done && !isSelected ? 'opacity-40' : ''}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
};

// --- Admin-facing editor ---
// `showCategory` is a Jeopardy-specific concern (whether this curiosidad is
// in category-picker mode) — the caller decides, this editor just obeys it.
// `instanceId` scopes the radio group's `name` so multiple multiple_choice
// questions rendered in the same list don't cross-interfere (native radios
// with the same `name` act as one group regardless of which component
// rendered them).
export const Editor = ({ question: q, onChange, showCategory, instanceId }) => {
  const updateOption = (oIdx, value) => {
    const oldValue = q.options[oIdx];
    onChange({
      options: q.options.map((o, j) => (j === oIdx ? value : o)),
      answer: q.answer === oldValue ? value : q.answer,
    });
  };
  const addOption = () => onChange({ options: [...q.options, ''] });
  const removeOption = (oIdx) => {
    const removedValue = q.options[oIdx];
    onChange({ options: q.options.filter((_, j) => j !== oIdx), answer: q.answer === removedValue ? '' : q.answer });
  };

  return (
    <>
      {showCategory && (
        <div className="flex items-center gap-2 mb-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Categoría</label>
          <input
            type="text"
            value={q.category}
            onChange={(e) => onChange({ category: e.target.value })}
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
              name={`mc-${instanceId}-answer`}
              checked={q.answer === opt && opt !== ''}
              onChange={() => onChange({ answer: opt })}
              title="Marcar como respuesta correcta"
            />
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(oIdx, e.target.value)}
              placeholder="Opción"
              className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs"
            />
            <button onClick={() => removeOption(oIdx)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1">
              ✕
            </button>
          </div>
        ))}
      </div>
      {q.options.length < 4 && (
        <button onClick={addOption} className="mt-2 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
          + Agregar opción
        </button>
      )}
      {!q.answer && (
        <p className="text-[10px] text-amber-600 font-bold mt-1">Marca con el círculo cuál opción es la correcta.</p>
      )}
    </>
  );
};
