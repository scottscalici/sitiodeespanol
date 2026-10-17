import React, { useState, useEffect } from 'react';
import { checkAnswerLeniently } from '../../utils/checkAnswer';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { PromptImage } from './clozeShared';

// One-shot free-text type ported from Practice Cards: unlike the
// retry-until-correct types above, this grades a single attempt and then
// always lets the student move on — onAllCorrect() here means "checked",
// not "correct", which is this type's own (intentional) use of that
// callback's real contract: "parent may now show its advance control."
export const TYPE_KEY = 'write';
export const TYPE_LABEL = 'Escribir';

export const emptyQuestion = () => ({ type: 'write', prompt: '', promptImage: '', answer: '', requireAccents: false });
export const getItemCount = () => 1;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

// Pure, given a {value} snapshot — see dropdownCloze.jsx's gradeState for
// why this is the one place "what counts as correct" lives.
export const gradeState = (question, state) => [checkAnswerLeniently(state?.value || '', question.answer, !!question.requireAccents).correct];

// Dispatches on `mode` — see src/shared/questionTypes/index.js for the full
// contract.
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const [value, setValue] = useState(() => initialState?.value || '');
  const [checked, setChecked] = useState(() => initialState?.checked || false);
  const [isCorrect, setIsCorrect] = useState(() => initialState?.isCorrect || false);
  const [missedAccent, setMissedAccent] = useState(() => initialState?.missedAccent || false);
  const attemptedRef = React.useRef(false);

  // Resuming an already-checked question re-shows the advance control
  // right away, without requiring another check.
  useEffect(() => {
    if (initialState?.checked) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ value, checked, isCorrect, missedAccent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, checked, isCorrect, missedAccent]);

  const handleCheck = () => {
    if (checked || !value.trim()) return;
    const result = checkAnswerLeniently(value, question.answer, !!question.requireAccents);
    setIsCorrect(result.correct);
    setMissedAccent(result.missedAccent);
    setChecked(true);
    if (!attemptedRef.current) {
      attemptedRef.current = true;
      onItemFirstAttempt(0, result.correct);
    }
    onAllCorrect();
  };

  return (
    <div className="space-y-4">
      <PromptImage src={question.promptImage} />
      <h2 className="text-lg font-bold text-slate-800">{question.prompt}</h2>
      <input
        type="text"
        value={value}
        disabled={checked}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
        placeholder="Escribe tu respuesta..."
        autoFocus
        className={`w-full border rounded-lg p-3 text-base ${
          checked ? (isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-rose-400 bg-rose-50 text-rose-800') : 'border-slate-300'
        }`}
      />
      {checked && !isCorrect && !missedAccent && (
        <p className="text-sm text-rose-600">
          Respuesta correcta: <span className="font-bold">{question.answer}</span>
        </p>
      )}
      {checked && missedAccent && (
        <p className={`text-sm font-bold ${isCorrect ? 'text-amber-600' : 'text-rose-600'}`}>
          ⚠️ Cuidado con los acentos{isCorrect ? ' — tu respuesta fue aceptada, pero revisa el acento.' : `: la respuesta correcta es "${question.answer}".`}
        </p>
      )}
      {!checked && (
        <button
          onClick={handleCheck}
          disabled={!value.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:opacity-40"
        >
          Comprobar
        </button>
      )}
    </div>
  );
};

// Plain, always-editable text input — no Comprobar step, since nothing is
// graded until the whole card is submitted. Colored live from then on.
const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const [value, setValue] = useState(() => initialState?.value || '');

  useEffect(() => {
    onStateChange?.({ value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const result = submitted ? checkAnswerLeniently(value, question.answer, !!question.requireAccents) : null;
  const isCorrect = result ? result.correct : null;

  return (
    <div className="space-y-4">
      <PromptImage src={question.promptImage} />
      <h2 className="text-lg font-bold text-slate-800">{question.prompt}</h2>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Escribe tu respuesta..."
        autoFocus
        className={`w-full border rounded-lg p-3 text-base ${
          isCorrect === true
            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
            : isCorrect === false
            ? 'border-rose-400 bg-rose-50 text-rose-800'
            : 'border-slate-300'
        }`}
      />
      {isCorrect === false && !result?.missedAccent && (
        <p className="text-sm text-rose-600">
          Respuesta correcta: <span className="font-bold">{question.answer}</span>
        </p>
      )}
      {result?.missedAccent && (
        <p className={`text-sm font-bold ${isCorrect ? 'text-amber-600' : 'text-rose-600'}`}>
          ⚠️ Cuidado con los acentos{isCorrect ? ' — tu respuesta fue aceptada, pero revisa el acento.' : `: la respuesta correcta es "${question.answer}".`}
        </p>
      )}
    </div>
  );
};

export const Editor = ({ question: q, onChange }) => (
  <div className="space-y-2">
    <input
      type="text"
      value={q.prompt}
      onChange={(e) => onChange({ prompt: e.target.value })}
      placeholder="Pregunta (inglés o instrucción)"
      className="w-full border border-slate-300 rounded-md p-2 text-sm"
    />
    <div className="flex items-center gap-2">
      {q.promptImage && (
        <img src={q.promptImage} alt="" className="w-12 h-12 object-cover rounded-md border border-slate-200 shrink-0" />
      )}
      <ImageUploadField
        value={q.promptImage || ''}
        onChange={(url) => onChange({ promptImage: url })}
        folder="curiosidades"
        placeholder="Imagen opcional"
        inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
      />
    </div>
    <input
      type="text"
      value={q.answer}
      onChange={(e) => onChange({ answer: e.target.value })}
      placeholder="Respuesta correcta"
      className="w-full border border-slate-300 rounded-md p-2 text-sm"
    />
    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
      <input
        type="checkbox"
        checked={!!q.requireAccents}
        onChange={(e) => onChange({ requireAccents: e.target.checked })}
      />
      Requerir acentos correctos (si no, solo se avisa)
    </label>
  </div>
);
