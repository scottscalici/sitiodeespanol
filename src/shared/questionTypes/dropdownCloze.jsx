import React, { useState, useEffect } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { renderClozeText, ClozeChrome } from './clozeShared';

export const TYPE_KEY = 'dropdown_cloze';
export const TYPE_LABEL = 'Cloze con Menús';
export const BLANK_TOKEN = '{{blank}}';
const countBlanks = (text) => (text.match(/\{\{blank\}\}/g) || []).length;

export const emptyQuestion = () => ({ type: 'dropdown_cloze', prompt: '', img: '', text: '', blanks: [] });
export const getItemCount = (q) => q.blanks.length;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

// --- Student-facing renderer ---
// Each blank has its own independent option list (unlike word_bank_cloze's
// shared bank) and locks once answered correctly. Grading is deferred to an
// explicit "Revisar" click (not on every selection) so a student can fill
// in every blank before anything is checked — same submit-then-grade model
// as Calentamiento's "Revisar Bloque", rather than judging each pick the
// instant it's made. The first REVISAR that touches a given blank is what
// counts as its "first attempt" for scoring, not the dropdown selection
// itself — re-picking a wrong blank and re-submitting doesn't re-trigger it.
export const Renderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const blankCount = question.blanks.length;
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

    question.blanks.forEach((blank, i) => {
      if (nextCorrect[i]) return; // already locked correct — nothing to re-check
      const isCorrect = blank.answer === selections[i];

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
    });

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

// --- Admin-facing editor ---
// `instanceId` scopes each blank's radio group `name` so multiple
// dropdown_cloze questions in the same list don't cross-interfere.
export const Editor = ({ question: q, onChange, instanceId }) => {
  const updateText = (text) => {
    const needed = countBlanks(text);
    let blanks = q.blanks || [];
    if (needed > blanks.length) {
      blanks = [...blanks, ...Array.from({ length: needed - blanks.length }, () => ({ options: ['', ''], answer: '' }))];
    } else if (needed < blanks.length) {
      blanks = blanks.slice(0, needed);
    }
    onChange({ text, blanks });
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
