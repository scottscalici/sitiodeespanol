import React, { useState, useEffect } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { renderClozeText, ClozeChrome } from './clozeShared';

export const TYPE_KEY = 'dropdown_cloze';
export const TYPE_LABEL = 'Cloze con Menús';
export const BLANK_TOKEN = '{{blank}}';

// The text is what's actually rendered — one <select> per occurrence of
// BLANK_TOKEN — so it's the only reliable source of "how many blanks does
// this question really have". `question.blanks` is supposed to track it
// 1:1, but a stray extra (or missing) entry left over from an older edit
// can't be ruled out for already-saved data. Deriving the count from the
// text, everywhere a blank count is needed, means a mismatched `blanks`
// array can never leave a student stuck on a blank with no corresponding
// control anywhere on the page — the single most confusing way this could
// fail, since there'd be nothing visible to even point at.
const countBlanksInText = (text) => (text || '').split(BLANK_TOKEN).length - 1;

export const emptyQuestion = () => ({ type: 'dropdown_cloze', prompt: '', img: '', text: '', blanks: [] });
export const getItemCount = (q) => countBlanksInText(q.text);
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

// Pure, given a {selections} snapshot (the same shape the deferred
// Renderer's onStateChange reports) — the one place "what counts as
// correct" lives, read by both that Renderer's own live coloring and
// Practice Cards' whole-card grading at Enviar time.
export const gradeState = (question, state) => {
  const selections = state?.selections || [];
  const blankCount = countBlanksInText(question.text);
  return Array.from({ length: blankCount }, (_, i) => question.blanks[i]?.answer === selections[i]);
};

// --- Student-facing renderer ---
// Dispatches on `mode` — see src/shared/questionTypes/index.js for the full
// contract. 'retry' (default, Curiosidad) keeps this type's original
// per-question submit-then-grade model; 'deferred' (Practice Cards) answers
// everything ungraded and only colors blanks once the whole card is
// submitted.
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

// Each blank has its own independent option list (unlike word_bank_cloze's
// shared bank) and locks once answered correctly. Grading is deferred to an
// explicit "Revisar" click (not on every selection) so a student can fill
// in every blank before anything is checked — same submit-then-grade model
// as Calentamiento's "Revisar Bloque", rather than judging each pick the
// instant it's made. The first REVISAR that touches a given blank is what
// counts as its "first attempt" for scoring, not the dropdown selection
// itself — re-picking a wrong blank and re-submitting doesn't re-trigger it.
const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const blankCount = countBlanksInText(question.text);
  const [selections, setSelections] = useState(() => initialState?.selections || Array(blankCount).fill(''));
  const [correct, setCorrect] = useState(() => initialState?.correct || Array(blankCount).fill(false));
  const [wrongAttempted, setWrongAttempted] = useState(() => initialState?.wrongAttempted || Array(blankCount).fill(false));
  const attemptedRef = React.useRef({});

  // Resuming an already-fully-correct question re-shows the advance
  // control right away, without requiring another Revisar click.
  useEffect(() => {
    if (initialState?.correct?.length && initialState.correct.every(Boolean)) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ selections, correct, wrongAttempted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, correct, wrongAttempted]);

  const handleSelect = (blankIdx, value) => {
    if (correct[blankIdx]) return;
    setSelections((prev) => prev.map((v, i) => (i === blankIdx ? value : v)));
    // Picking something new clears any stale "wrong" mark until re-checked.
    setWrongAttempted((prev) => prev.map((w, i) => (i === blankIdx ? false : w)));
  };

  const handleRevisar = () => {
    const nextCorrect = [...correct];
    const nextWrong = [...wrongAttempted];

    for (let i = 0; i < blankCount; i++) {
      if (nextCorrect[i]) continue; // already locked correct — nothing to re-check
      const isCorrect = question.blanks[i]?.answer === selections[i];

      if (!attemptedRef.current[i]) {
        attemptedRef.current[i] = true;
        onItemFirstAttempt(i, isCorrect);
      }

      if (isCorrect) {
        nextCorrect[i] = true;
        nextWrong[i] = false;
      } else {
        nextWrong[i] = true;
      }
    }

    setCorrect(nextCorrect);
    setWrongAttempted(nextWrong);
    if (nextCorrect.every(Boolean)) onAllCorrect();
  };

  const allCorrect = correct.every(Boolean);

  return (
    <div>
      <ClozeChrome img={question.img} completed={correct.filter(Boolean).length} total={blankCount}>
        {renderClozeText(question.text, selections, correct, wrongAttempted, handleSelect, (blankIdx) => question.blanks[blankIdx]?.options || [])}
      </ClozeChrome>
      {!allCorrect && (
        <div className="mt-6 text-center">
          <button
            onClick={handleRevisar}
            className="bg-sky-600 hover:bg-sky-700 text-white font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl transition-colors"
          >
            Revisar
          </button>
        </div>
      )}
    </div>
  );
};

// Freely editable at all times (never locks, even once correct — the
// student may resubmit for a better score), with no Revisar step: grading
// only ever shows once the caller says the whole card has been submitted,
// and re-colors live from then on as the student keeps editing.
const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const blankCount = countBlanksInText(question.text);
  const [selections, setSelections] = useState(() => initialState?.selections || Array(blankCount).fill(''));

  useEffect(() => {
    onStateChange?.({ selections });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections]);

  const handleSelect = (blankIdx, value) => {
    setSelections((prev) => prev.map((v, i) => (i === blankIdx ? value : v)));
  };

  const correct = submitted ? gradeState(question, { selections }) : Array(blankCount).fill(null);
  const wrong = correct.map((c) => c === false);
  // Pre-submit, "completado" just means answered (nothing graded yet);
  // once submitted it switches to counting actually-correct blanks.
  const completedCount = submitted ? correct.filter((c) => c === true).length : selections.filter(Boolean).length;

  return (
    <ClozeChrome img={question.img} completed={completedCount} total={blankCount}>
      {renderClozeText(
        question.text,
        selections,
        correct,
        wrong,
        handleSelect,
        (blankIdx) => question.blanks[blankIdx]?.options || [],
        { lockOnCorrect: false }
      )}
    </ClozeChrome>
  );
};

// --- Admin-facing editor ---
// `instanceId` scopes each blank's radio group `name` so multiple
// dropdown_cloze questions in the same list don't cross-interfere.
export const Editor = ({ question: q, onChange, instanceId }) => {
  // Re-anchors existing blanks by POSITION when the text changes, instead
  // of only ever appending new blank configs to the end or truncating from
  // the end. Inserting or removing a {{blank}} in the MIDDLE of an
  // already-configured paragraph used to silently shift every blank after
  // that point onto the wrong slot — its stored options/answer then belong
  // to a different spot in the text than where it now renders, so no
  // selection there can ever be marked correct again, permanently stranding
  // a student on that question. Finds the longest matching prefix/suffix of
  // segments-between-blanks on both the old and new text; blanks inside
  // that matching window are kept as-is (by position), new default blanks
  // are only created for the genuinely new/changed span in the middle.
  const updateText = (text) => {
    const oldSegments = (q.text || '').split(BLANK_TOKEN);
    const newSegments = text.split(BLANK_TOKEN);
    const oldBlanks = q.blanks || [];
    const makeDefault = () => ({ options: ['', ''], answer: '' });

    let prefix = 0;
    const maxPrefix = Math.min(oldSegments.length, newSegments.length) - 1;
    while (prefix < maxPrefix && oldSegments[prefix] === newSegments[prefix]) prefix++;

    let suffix = 0;
    const maxSuffix = Math.min(oldSegments.length, newSegments.length) - 1 - prefix;
    while (
      suffix < maxSuffix &&
      oldSegments[oldSegments.length - 1 - suffix] === newSegments[newSegments.length - 1 - suffix]
    ) {
      suffix++;
    }

    const newBlankCount = newSegments.length - 1;
    const keptStart = oldBlanks.slice(0, prefix);
    const keptEnd = suffix > 0 ? oldBlanks.slice(oldBlanks.length - suffix) : [];
    const middleCount = Math.max(0, newBlankCount - prefix - suffix);
    const middle = Array.from({ length: middleCount }, makeDefault);

    onChange({ text, blanks: [...keptStart, ...middle, ...keptEnd] });
  };

  const addOption = (bIdx) => {
    onChange({ blanks: q.blanks.map((b, j) => (j === bIdx ? { ...b, options: [...b.options, ''] } : b)) });
  };
  const updateOption = (bIdx, oIdx, value) => {
    onChange({
      blanks: q.blanks.map((b, j) => {
        if (j !== bIdx) return b;
        const oldValue = b.options[oIdx];
        return {
          ...b,
          options: b.options.map((o, k) => (k === oIdx ? value : o)),
          answer: b.answer === oldValue ? value : b.answer,
        };
      }),
    });
  };
  const removeOption = (bIdx, oIdx) => {
    onChange({
      blanks: q.blanks.map((b, j) => {
        if (j !== bIdx) return b;
        const removedValue = b.options[oIdx];
        return { ...b, options: b.options.filter((_, k) => k !== oIdx), answer: b.answer === removedValue ? '' : b.answer };
      }),
    });
  };
  const setAnswer = (bIdx, value) => {
    onChange({ blanks: q.blanks.map((b, j) => (j === bIdx ? { ...b, answer: value } : b)) });
  };

  return (
    <>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
        Escribe el párrafo y pon <code className="bg-slate-200 px-1 rounded">{BLANK_TOKEN}</code> donde va cada
        espacio en blanco — cada uno tendrá su propio menú de opciones.
      </p>

      <div className="flex items-start gap-2 mb-3">
        {q.img && <img src={q.img} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 shrink-0" />}
        <ImageUploadField
          value={q.img}
          onChange={(url) => onChange({ img: url })}
          folder="curiosidades"
          placeholder="Imagen opcional (p. ej. foto del cóndor)"
          inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
        />
      </div>

      <textarea
        value={q.text}
        onChange={(e) => updateText(e.target.value)}
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
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Espacio en blanco {bIdx + 1}</p>
              <div className="space-y-1.5">
                {blank.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`cloze-${instanceId}-${bIdx}-answer`}
                      checked={blank.answer === opt && opt !== ''}
                      onChange={() => setAnswer(bIdx, opt)}
                      title="Marcar como respuesta correcta"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(bIdx, oIdx, e.target.value)}
                      placeholder="Opción"
                      className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs"
                    />
                    <button onClick={() => removeOption(bIdx, oIdx)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addOption(bIdx)} className="mt-2 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
                + Agregar opción
              </button>
              {!blank.answer && (
                <p className="text-[10px] text-amber-600 font-bold mt-1">Marca con el círculo cuál opción es la correcta.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
