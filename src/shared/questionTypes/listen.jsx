import React, { useState, useEffect } from 'react';
import { checkAnswerLeniently } from '../../utils/checkAnswer';
import { playAudio } from '../../utils/playAudio';

// Same one-shot grading as `write`, but the prompt is spoken aloud (Spanish
// text-to-speech) instead of shown — the student types what they hear.
export const TYPE_KEY = 'listen';
export const TYPE_LABEL = 'Escuchar';

export const emptyQuestion = () => ({ type: 'listen', prompt: '', answer: '' });
export const getItemCount = () => 1;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

export const Renderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const [value, setValue] = useState(() => initialState?.value || '');
  const [checked, setChecked] = useState(() => initialState?.checked || false);
  const [isCorrect, setIsCorrect] = useState(() => initialState?.isCorrect || false);
  const attemptedRef = React.useRef(false);

  useEffect(() => {
    playAudio(question.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.prompt]);

  // Resuming an already-checked question re-shows the advance control
  // right away, without requiring another check.
  useEffect(() => {
    if (initialState?.checked) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ value, checked, isCorrect });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, checked, isCorrect]);

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
      <button
        onClick={() => playAudio(question.prompt)}
        className="flex items-center gap-2 px-4 py-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-lg hover:bg-indigo-100"
      >
        🔊 Escuchar otra vez
      </button>
      <input
        type="text"
        value={value}
        disabled={checked}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
        placeholder="Escribe lo que escuchaste..."
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
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={q.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        placeholder="Texto a Reproducir (español)"
        className="flex-1 border border-slate-300 rounded-md p-2 text-sm"
      />
      <button
        type="button"
        onClick={() => playAudio(q.prompt)}
        className="shrink-0 px-2 py-2 rounded-md bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
      >
        🔊 Probar audio
      </button>
    </div>
    <input
      type="text"
      value={q.answer}
      onChange={(e) => onChange({ answer: e.target.value })}
      placeholder="Respuesta correcta"
      className="w-full border border-slate-300 rounded-md p-2 text-sm"
    />
  </div>
);
