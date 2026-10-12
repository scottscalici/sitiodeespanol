import React, { useState, useEffect } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { shuffle } from './clozeShared';

export const TYPE_KEY = 'multiple_choice';
export const TYPE_LABEL = 'Opción Múltiple';

export const emptyQuestion = () => ({
  type: 'multiple_choice',
  prompt: '',
  promptImage: '',
  category: '',
  options: ['', ''],
  optionImages: ['', ''],
  answer: '',
});

export const getItemCount = () => 1;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

// Bulk-paste format, one clue per line: categoría | pregunta | respuesta | distractor1 | distractor2 | distractor3
// (1 to 3 distractors — 2 to 4 total options). Point values aren't part of
// this at all: for a Jeopardy-style board they're purely cosmetic and have
// no bearing on grading, so there's nothing to assign here. Plain text
// only — no image column, same as matching's distractors staying text-only.
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

// Pure, given a {selectedIdx} snapshot — see dropdownCloze.jsx's gradeState
// for why this is the one place "what counts as correct" lives.
export const gradeState = (question, state) => [question.options[state?.selectedIdx] === question.answer];

// --- Student-facing renderer ---
// Dispatches on `mode` — see src/shared/questionTypes/index.js for the full
// contract.
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

// The prompt's own image (if any) is rendered here, inside the type's own
// Renderer, rather than in the shared engine that renders `question.prompt`
// text — CuriosidadQuizEngine and PracticeCardEngine both just hand the
// question straight through, so keeping this self-contained means it works
// in either consumer without either engine needing to know about it.
const PromptImage = ({ src }) =>
  src ? <img src={src} alt="" className="w-full max-h-64 object-contain bg-slate-950 rounded-xl mb-4" /> : null;

const OptionContent = ({ text, image }) => (
  <>
    {image && <img src={image} alt="" className="w-full h-24 object-contain bg-slate-950 rounded-lg mb-2" />}
    {text}
  </>
);

// Resolves the instant you click an option — one gradable item, first-
// attempt-only, lock on correct. Options render as a responsive grid: 2 or 4
// side-by-side pairs (4 wraps into a 2x2 block), 3 all in one row.
const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
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
    <div>
      <PromptImage src={question.promptImage} />
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
              <OptionContent text={opt} image={question.optionImages?.[oIdx]} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Freely editable at all times — no lock-on-correct, since the student may
// change their pick and resubmit for a better score. Grading only shows
// once the caller says the whole card has been submitted.
const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const [selectedIdx, setSelectedIdx] = useState(() => initialState?.selectedIdx ?? null);

  useEffect(() => {
    onStateChange?.({ selectedIdx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx]);

  const isCorrect = submitted ? gradeState(question, { selectedIdx })[0] : null;

  return (
    <div>
      <PromptImage src={question.promptImage} />
      <div className={`grid gap-3 ${question.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {question.options.map((opt, oIdx) => {
          const isSelected = selectedIdx === oIdx;
          const showWrong = isSelected && isCorrect === false;
          const showCorrect = isSelected && isCorrect === true;
          return (
            <button
              key={oIdx}
              onClick={() => setSelectedIdx(oIdx)}
              className={`p-4 border-2 rounded-xl font-bold text-sm transition-all ${
                showWrong
                  ? 'border-rose-500 bg-rose-950 text-rose-300'
                  : showCorrect
                  ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                  : isSelected
                  ? 'border-sky-400 bg-sky-950 text-slate-100'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400'
              }`}
            >
              <OptionContent text={opt} image={question.optionImages?.[oIdx]} />
            </button>
          );
        })}
      </div>
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
  // optionImages may not exist yet on a question created before this field
  // was added (or one that only ever went through parseBulkRow) — normalize
  // to a same-length array here so every mutation below can write a full
  // array back, instead of leaving admin-created and bulk-imported questions
  // on two different shapes going forward.
  const optionImages = q.options.map((_, i) => q.optionImages?.[i] || '');

  const updateOption = (oIdx, value) => {
    const oldValue = q.options[oIdx];
    onChange({
      options: q.options.map((o, j) => (j === oIdx ? value : o)),
      answer: q.answer === oldValue ? value : q.answer,
    });
  };
  const updateOptionImage = (oIdx, url) => {
    onChange({ optionImages: optionImages.map((img, j) => (j === oIdx ? url : img)) });
  };
  const addOption = () => onChange({ options: [...q.options, ''], optionImages: [...optionImages, ''] });
  const removeOption = (oIdx) => {
    const removedValue = q.options[oIdx];
    onChange({
      options: q.options.filter((_, j) => j !== oIdx),
      optionImages: optionImages.filter((_, j) => j !== oIdx),
      answer: q.answer === removedValue ? '' : q.answer,
    });
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

      <div className="mb-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
          Imagen de la pregunta (opcional)
        </label>
        <div className="flex items-center gap-2">
          {q.promptImage && (
            <img src={q.promptImage} alt="" className="w-12 h-12 object-cover rounded-md border border-slate-200 shrink-0" />
          )}
          <ImageUploadField
            value={q.promptImage || ''}
            onChange={(url) => onChange({ promptImage: url })}
            folder="curiosidades"
            inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
          />
        </div>
      </div>

      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
        Marca con el círculo cuál opción es la correcta (2 a 4 opciones).
      </p>
      <div className="space-y-2">
        {q.options.map((opt, oIdx) => (
          <div key={oIdx} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
            <input
              type="radio"
              name={`mc-${instanceId}-answer`}
              checked={q.answer === opt && opt !== ''}
              onChange={() => onChange({ answer: opt })}
              title="Marcar como respuesta correcta"
              className="mt-2"
            />
            <div className="flex-1 min-w-0 space-y-1">
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(oIdx, e.target.value)}
                placeholder="Opción"
                className="w-full border border-slate-300 rounded-md p-1.5 text-xs"
              />
              <div className="flex items-center gap-1">
                {optionImages[oIdx] && (
                  <img src={optionImages[oIdx]} alt="" className="w-8 h-8 object-cover rounded-md border border-slate-200 shrink-0" />
                )}
                <ImageUploadField
                  value={optionImages[oIdx]}
                  onChange={(url) => updateOptionImage(oIdx, url)}
                  folder="curiosidades"
                  inputClassName="w-full border border-slate-300 rounded-md p-1 text-[9px] font-mono"
                />
              </div>
            </div>
            <button onClick={() => removeOption(oIdx)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1 mt-2">
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
