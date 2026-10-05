import React, { useState } from 'react';
import { checkAnswerLeniently } from '../../utils/checkAnswer';

// One-shot free-text type ported from Practice Cards: unlike the
// retry-until-correct types above, this grades a single attempt and then
// always lets the student move on — onAllCorrect() here means "checked",
// not "correct", which is this type's own (intentional) use of that
// callback's real contract: "parent may now show its advance control."
export const TYPE_KEY = 'write';
export const TYPE_LABEL = 'Escribir';

export const emptyQuestion = () => ({ type: 'write', prompt: '', answer: '' });
export const getItemCount = () => 1;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

export const Renderer = ({ question, onItemFirstAttempt, onAllCorrect }) => {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const attemptedRef = React.useRef(false);

  const handleCheck = () => {
    if (checked || !value.trim()) return;
    const correct = checkAnswerLeniently(value, question.answer, false).correct;
    setIsCorrect(correct);
    setChecked(true);
    if (!attemptedRef.current) {
      attemptedRef.current = true;
      onItemFirstAttempt(0, correct);
    }
    onAllCorrect();
  };

  return (
    <div className="space-y-4">
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
      {checked && !isCorrect && (
        <p className="text-sm text-rose-600">
          Respuesta correcta: <span className="font-bold">{question.answer}</span>
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

export const Editor = ({ question: q, onChange }) => (
  <div className="space-y-2">
    <input
      type="text"
      value={q.prompt}
      onChange={(e) => onChange({ prompt: e.target.value })}
      placeholder="Pregunta (inglés o instrucción)"
      className="w-full border border-slate-300 rounded-md p-2 text-sm"
    />
    <input
      type="text"
      value={q.answer}
      onChange={(e) => onChange({ answer: e.target.value })}
      placeholder="Respuesta correcta"
      className="w-full border border-slate-300 rounded-md p-2 text-sm"
    />
  </div>
);
