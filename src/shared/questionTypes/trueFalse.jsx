import React from 'react';
import { PromptImage, PromptAudio } from './clozeShared';

export const TYPE_KEY = 'true_false';
export const TYPE_LABEL = 'Verdadero / Falso';

export const emptyQuestion = () => ({
  type: 'true_false',
  prompt: '',
  promptImage: '',
  promptAudio: '',
  answer: true,
  explanation: '',
});

export const getItemCount = () => 1;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

export const gradeState = (question, state) => [state?.selected === question.answer];

// --- Student-facing renderer ---
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

const Buttons = ({ selected, onPick, disabled, showCorrect, answer }) => (
  <div className="grid grid-cols-2 gap-3">
    {[true, false].map((val) => {
      const isSelected = selected === val;
      const isCorrectChoice = showCorrect === true && val === answer;
      const isWrongChoice = showCorrect === false && isSelected;
      return (
        <button
          key={String(val)}
          type="button"
          onClick={() => onPick(val)}
          disabled={disabled}
          className={`p-4 border-2 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
            isWrongChoice
              ? 'border-rose-500 bg-rose-950 text-rose-300'
              : isCorrectChoice
              ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
              : isSelected
              ? 'border-sky-400 bg-sky-950 text-slate-100'
              : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400'
          }`}
        >
          {val ? 'Verdadero' : 'Falso'}
        </button>
      );
    })}
  </div>
);

const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange, hidePrompt }) => {
  const [selected, setSelected] = React.useState(initialState?.selected ?? null);
  const [done, setDone] = React.useState(initialState?.done || false);
  const attemptedRef = React.useRef(false);

  React.useEffect(() => {
    if (initialState?.done) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    onStateChange?.({ selected, done });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, done]);

  const handlePick = (val) => {
    if (done) return;
    const isCorrect = val === question.answer;
    if (!attemptedRef.current) {
      attemptedRef.current = true;
      onItemFirstAttempt(0, isCorrect);
    }
    setSelected(val);
    if (isCorrect) {
      setDone(true);
      onAllCorrect();
    }
  };

  return (
    <div>
      <PromptImage src={question.promptImage} />
      <PromptAudio src={question.promptAudio} />
      {!hidePrompt && <h2 className="text-lg font-bold text-slate-800 mb-4">{question.prompt}</h2>}
      <Buttons selected={selected} onPick={handlePick} disabled={done} showCorrect={done ? true : null} answer={question.answer} />
      {done && question.explanation && (
        <p className="mt-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">{question.explanation}</p>
      )}
    </div>
  );
};

const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const [selected, setSelected] = React.useState(initialState?.selected ?? null);

  React.useEffect(() => {
    onStateChange?.({ selected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const isCorrect = submitted ? gradeState(question, { selected })[0] : null;

  return (
    <div>
      <PromptImage src={question.promptImage} />
      <PromptAudio src={question.promptAudio} />
      <h2 className="text-lg font-bold text-slate-800 mb-4">{question.prompt}</h2>
      <Buttons selected={selected} onPick={setSelected} disabled={false} showCorrect={isCorrect} answer={question.answer} />
      {submitted && question.explanation && (
        <p className="mt-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">{question.explanation}</p>
      )}
    </div>
  );
};

// --- Admin-facing editor ---
export const Editor = ({ question: q, onChange }) => (
  <>
    <div className="mb-3">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pregunta</label>
      <input
        type="text"
        value={q.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        placeholder="Afirmación a evaluar"
        className="w-full border border-slate-300 rounded-md p-2 text-sm"
      />
    </div>
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Marca la respuesta correcta.</p>
    <div className="flex gap-3 mb-3">
      {[true, false].map((val) => (
        <label key={String(val)} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 flex-1 cursor-pointer">
          <input type="radio" name={`tf-${q.prompt}`} checked={q.answer === val} onChange={() => onChange({ answer: val })} />
          <span className="text-xs font-bold">{val ? 'Verdadero' : 'Falso'}</span>
        </label>
      ))}
    </div>
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
        Explicación (opcional — se muestra como retroalimentación después de responder)
      </label>
      <textarea
        value={q.explanation || ''}
        onChange={(e) => onChange({ explanation: e.target.value })}
        rows={2}
        className="w-full border border-slate-300 rounded-lg p-2 text-xs mt-1"
        placeholder="Por qué es verdadero o falso..."
      />
    </div>
  </>
);
