import { useState, useEffect, useRef } from 'react';
import { checkAnswerLeniently } from '../../utils/checkAnswer';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { PromptImage } from './clozeShared';

// A timed "lightning round" — N clue/answer blanks shown together, racing a
// single countdown (default 60s) instead of the untimed, one-at-a-time
// pacing every other type uses. Modeled on last year's "capitales" Schoology
// quiz: type as many answers as you can before time's up, graded on
// whatever's in each box the instant the clock hits zero (or the student
// submits early) — there's no per-blank retry once locked, since racing the
// clock IS the point. A correct answer can list English and/or Spanish forms
// comma/semicolon-separated (checkAnswerLeniently already splits those), so
// "Ciudad de México, Mexico City" accepts either.
export const TYPE_KEY = 'speed_blanks';
export const TYPE_LABEL = 'Ronda Relámpago';

export const emptyQuestion = () => ({
  type: 'speed_blanks',
  prompt: '',
  promptImage: '',
  timeLimit: 60,
  items: [{ clue: '', answer: '' }],
  explanation: '',
});

export const getItemCount = (q) => (q.items || []).length;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

// Pure, given an {answers} snapshot (one string per item, same shape
// onStateChange reports) — the one place "what counts as correct" lives.
export const gradeState = (question, state) => {
  const answers = state?.answers || [];
  return (question.items || []).map((item, i) => checkAnswerLeniently(answers[i] || '', item.answer, false).correct);
};

// Dispatches on `mode` — see src/shared/questionTypes/index.js for the full
// contract. Curiosidad (the only real consumer so far) always uses 'retry'.
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

const formatClock = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(1, '0')}:${s.toString().padStart(2, '0')}`;
};

const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange, hidePrompt }) => {
  const items = question.items || [];
  const timeLimit = question.timeLimit || 60;

  const [started, setStarted] = useState(() => !!initialState?.started);
  const [locked, setLocked] = useState(() => !!initialState?.locked);
  const [answers, setAnswers] = useState(() => initialState?.answers || Array(items.length).fill(''));
  const [timeLeft, setTimeLeft] = useState(() => (initialState?.timeLeft != null ? initialState.timeLeft : timeLimit));
  const attemptedRef = useRef(false);
  const inputRefs = useRef([]);

  // Resuming an already-locked round re-shows the advance control right
  // away, without requiring another lock.
  useEffect(() => {
    if (initialState?.locked) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ started, locked, answers, timeLeft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, locked, answers, timeLeft]);

  const doLock = () => {
    setLocked(true);
    if (!attemptedRef.current) {
      attemptedRef.current = true;
      const correctness = gradeState(question, { answers });
      correctness.forEach((isCorrect, i) => onItemFirstAttempt(i, isCorrect));
    }
    onAllCorrect();
  };

  // Countdown — only ticks once the student has actually started, and stops
  // the instant it's locked (by timeout or an early submit).
  useEffect(() => {
    if (!started || locked) return;
    if (timeLeft <= 0) {
      doLock();
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, locked, timeLeft]);

  const correctness = locked ? gradeState(question, { answers }) : null;
  const correctCount = correctness ? correctness.filter(Boolean).length : 0;

  const handleChange = (i, value) => {
    if (locked) return;
    setAnswers((prev) => prev.map((v, j) => (j === i ? value : v)));
  };

  const handleEnter = (i, e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = inputRefs.current[i + 1];
    if (next) next.focus();
  };

  if (!started) {
    return (
      <div className="space-y-4 text-center">
        <PromptImage src={question.promptImage} />
        {!hidePrompt && question.prompt && <h2 className="text-lg font-bold text-slate-800">{question.prompt}</h2>}
        <p className="text-sm text-slate-600">
          Tienes <span className="font-black">{formatClock(timeLimit)}</span> para escribir{' '}
          <span className="font-black">{items.length}</span> respuestas.
        </p>
        <button
          onClick={() => setStarted(true)}
          className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-sm uppercase tracking-widest shadow-md"
        >
          ⚡ ¡Comenzar!
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PromptImage src={question.promptImage} />
      {!hidePrompt && question.prompt && <h2 className="text-lg font-bold text-slate-800 text-center">{question.prompt}</h2>}

      {!locked && (
        <p
          className={`text-center text-3xl font-black font-mono ${timeLeft <= 10 ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}
        >
          ⏱️ {formatClock(timeLeft)}
        </p>
      )}
      {locked && (
        <p className="text-center text-xs font-black uppercase tracking-widest text-slate-500">
          {correctCount} de {items.length} correctas
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, i) => {
          const isCorrect = correctness ? correctness[i] : null;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-bold text-slate-700">{item.clue}</span>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={answers[i] || ''}
                  disabled={locked}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleEnter(i, e)}
                  ref={(el) => (inputRefs.current[i] = el)}
                  autoFocus={i === 0}
                  className={`w-full border rounded-lg p-2 text-sm ${
                    isCorrect === true
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                      : isCorrect === false
                      ? 'border-rose-400 bg-rose-50 text-rose-800'
                      : 'border-slate-300 bg-white text-slate-900'
                  }`}
                />
                {isCorrect === false && (
                  <p className="text-[11px] text-rose-600 mt-0.5">
                    Respuesta correcta: <span className="font-bold">{item.answer.split(/[;,]/)[0].trim()}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!locked && (
        <div className="text-center">
          <button
            onClick={doLock}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-black rounded-lg text-xs uppercase tracking-widest"
          >
            Terminar ronda
          </button>
        </div>
      )}

      {locked && question.explanation && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          {question.explanation}
        </p>
      )}
    </div>
  );
};

// Deferred mode (Practice Cards-style whole-card submit) — no independent
// countdown of its own (that would fight the card's own single Enviar
// control), so this just behaves like a plain set of text inputs, graded
// live from `submitted` the same way every other deferred renderer works.
// Not exercised by Curiosidad today, but kept consistent with the shared
// contract in case Practice Cards ever wants this type too.
const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const items = question.items || [];
  const [answers, setAnswers] = useState(() => initialState?.answers || Array(items.length).fill(''));

  useEffect(() => {
    onStateChange?.({ answers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  const correctness = submitted ? gradeState(question, { answers }) : null;

  return (
    <div className="space-y-4">
      <PromptImage src={question.promptImage} />
      {question.prompt && <h2 className="text-lg font-bold text-slate-800 text-center">{question.prompt}</h2>}
      <div className="space-y-2">
        {items.map((item, i) => {
          const isCorrect = correctness ? correctness[i] : null;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-bold text-slate-700">{item.clue}</span>
              <input
                type="text"
                value={answers[i] || ''}
                onChange={(e) => setAnswers((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                className={`flex-1 min-w-0 border rounded-lg p-2 text-sm ${
                  isCorrect === true
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    : isCorrect === false
                    ? 'border-rose-400 bg-rose-50 text-rose-800'
                    : 'border-slate-300 bg-white text-slate-900'
                }`}
              />
            </div>
          );
        })}
      </div>
      {submitted && question.explanation && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          {question.explanation}
        </p>
      )}
    </div>
  );
};

export const Editor = ({ question: q, onChange }) => {
  const items = q.items || [];
  const updateItem = (i, patch) => onChange({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const addItem = () => onChange({ items: [...items, { clue: '', answer: '' }] });
  const removeItem = (i) => onChange({ items: items.filter((_, j) => j !== i) });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
          Instrucciones (se muestran antes de empezar)
        </label>
        <input
          type="text"
          value={q.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="ej. Escribe las capitales lo más rápido posible"
          className="w-full border border-slate-300 rounded-md p-2 text-sm"
        />
      </div>

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

      <div>
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
          Tiempo límite (segundos)
        </label>
        <input
          type="number"
          min="5"
          value={q.timeLimit ?? 60}
          onChange={(e) => onChange({ timeLimit: Math.max(5, Number(e.target.value) || 60) })}
          className="w-28 border border-slate-300 rounded-md p-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 bg-white border border-slate-200 rounded-lg p-2">
            <input
              type="text"
              value={item.clue}
              onChange={(e) => updateItem(i, { clue: e.target.value })}
              placeholder="Pista (ej. ¿Cuál es la capital de España?)"
              className="flex-1 min-w-0 border border-slate-300 rounded-md p-1.5 text-xs"
            />
            <input
              type="text"
              value={item.answer}
              onChange={(e) => updateItem(i, { answer: e.target.value })}
              placeholder="Respuesta(s) — separa variantes con coma"
              className="flex-1 min-w-0 border border-slate-300 rounded-md p-1.5 text-xs"
            />
            <button onClick={() => removeItem(i)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1 mt-1.5">
              ✕
            </button>
          </div>
        ))}
      </div>

      <button onClick={addItem} className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
        + Agregar pregunta
      </button>

      <div>
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Explicación (opcional, se muestra después de responder)
        </label>
        <textarea
          value={q.explanation || ''}
          onChange={(e) => onChange({ explanation: e.target.value })}
          rows={2}
          className="w-full border border-slate-300 rounded-lg p-2 text-xs mt-1"
        />
      </div>
    </div>
  );
};
