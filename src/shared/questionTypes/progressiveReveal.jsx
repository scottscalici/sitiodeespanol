import { useState, useEffect, useRef } from 'react';
import { checkAnswerLeniently } from '../../utils/checkAnswer';
import ImageUploadField from '../../admin/shared/ImageUploadField';

// A "¿Quién/Qué soy?" reveal round: the SAME subject shown as 3
// progressively less-cropped images (images[0] = hardest/most zoomed,
// images[2] = the full, easy reveal). The student guesses after each crop;
// a wrong guess burns that crop and moves to the next, easier one. Modeled
// on a Schoology quiz that paid 5/3/1 points for guessing right on crop
// 1/2/3 — this engine has no concept of a question being worth more than
// another, so instead of literal points this type reports 3 independently-
// gradable "items" per round (getItemCount always 3): guessing right on
// crop N marks items [N..2] correct (you'd obviously have gotten the easier
// crops too), so a first-guess win earns 3/3 of this round's weight in the
// curiosidad's overall average, a second-guess win 2/3, a last-crop win
// 1/3, and giving up for good 0/3 — the same "earlier is worth more" shape
// as the original, built entirely from this engine's existing per-item
// right/wrong grading rather than a custom point system.
//
// The answer is ONE free-text box (not per-word blanks) — "Frida Kahlo" in
// one box, not "Frida" and "Kahlo" separately — so there's no partial
// credit for half a name, same simplification Curiosidad already uses for
// every other named-person question. `prefix`/`suffix` are plain, ungraded
// text shown around the box (e.g. prefix "La" + box "Sagrada Familia", or
// box "Dora" + suffix "la exploradora").
export const TYPE_KEY = 'progressive_reveal';
export const TYPE_LABEL = 'Adivina (Zoom)';

export const emptyQuestion = () => ({
  type: 'progressive_reveal',
  prompt: '',
  prefix: '',
  suffix: '',
  answer: '',
  images: ['', '', ''],
  explanation: '',
});

export const getItemCount = () => 3;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

// Pure, given a {value} snapshot. Deferred mode has no notion of "which
// crop" (see DeferredRenderer below) so a correct guess there is full
// credit (3/3) and a wrong one is none (0/3) — not exercised by Curiosidad
// today, kept consistent with the shared contract in case Practice Cards
// ever wants this type.
export const gradeState = (question, state) => {
  const isCorrect = checkAnswerLeniently(state?.value || '', question.answer, false).correct;
  return [isCorrect, isCorrect, isCorrect];
};

export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

const STAGE_LABEL = ['Pista 1 de 3 (la más difícil)', 'Pista 2 de 3', 'Pista 3 de 3 (revelado completo)'];

const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange, hidePrompt }) => {
  const [stage, setStage] = useState(() => initialState?.stage || 0);
  const [value, setValue] = useState('');
  const [locked, setLocked] = useState(() => !!initialState?.locked);
  const [won, setWon] = useState(() => !!initialState?.won);
  const [lastWrong, setLastWrong] = useState(false);
  const attemptedRef = useRef(new Set());

  useEffect(() => {
    if (initialState?.locked) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ stage, locked, won });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, locked, won]);

  const markItem = (idx, isCorrect) => {
    if (attemptedRef.current.has(idx)) return;
    attemptedRef.current.add(idx);
    onItemFirstAttempt(idx, isCorrect);
  };

  const handleCheck = () => {
    if (locked || !value.trim()) return;
    const isCorrect = checkAnswerLeniently(value, question.answer, false).correct;

    if (isCorrect) {
      for (let i = stage; i <= 2; i++) markItem(i, true);
      setWon(true);
      setLocked(true);
      onAllCorrect();
      return;
    }

    markItem(stage, false);
    setLastWrong(true);
    setTimeout(() => setLastWrong(false), 400);

    if (stage >= 2) {
      setLocked(true);
      onAllCorrect();
    } else {
      setStage((s) => s + 1);
      setValue('');
    }
  };

  const currentImage = question.images?.[Math.min(stage, 2)];

  return (
    <div className="space-y-4">
      {!hidePrompt && question.prompt && <h2 className="text-lg font-bold text-slate-200 text-center">{question.prompt}</h2>}

      {!locked && (
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
          {STAGE_LABEL[Math.min(stage, 2)]}
        </p>
      )}

      {currentImage && (
        <img src={currentImage} alt="" className="max-h-80 mx-auto object-contain rounded-lg bg-slate-950" />
      )}

      <div className="flex items-center justify-center gap-2 flex-wrap text-slate-200 font-bold">
        {question.prefix && <span>{question.prefix}</span>}
        <input
          type="text"
          value={value}
          disabled={locked}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          autoFocus
          className={`border rounded-lg p-2 text-sm w-48 ${
            locked && won
              ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
              : locked
              ? 'border-rose-400 bg-rose-50 text-rose-800'
              : lastWrong
              ? 'border-rose-400 bg-rose-50 text-rose-800'
              : 'border-slate-300 bg-white text-slate-900'
          }`}
        />
        {question.suffix && <span>{question.suffix}</span>}
      </div>

      {locked && !won && (
        <p className="text-center text-sm text-rose-400">
          Respuesta correcta: <span className="font-bold">{question.answer.split(/[;,]/)[0].trim()}</span>
        </p>
      )}
      {locked && won && (
        <p className="text-center text-sm text-emerald-400 font-bold">
          ¡Correcto! {stage === 0 ? '🌟 ¡En la primera pista!' : stage === 1 ? '👍 En la segunda pista' : '✅'}
        </p>
      )}

      {!locked && (
        <div className="text-center">
          <button
            onClick={handleCheck}
            disabled={!value.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-40"
          >
            Comprobar
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

// Deferred mode shows the full reveal (last image) only — the sequential
// zoom-and-burn-a-guess mechanic depends on instant per-guess feedback,
// which deferred mode (grade-only-at-the-end) doesn't have.
const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const [value, setValue] = useState(() => initialState?.value || '');

  useEffect(() => {
    onStateChange?.({ value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const isCorrect = submitted ? checkAnswerLeniently(value, question.answer, false).correct : null;

  return (
    <div className="space-y-4">
      {question.prompt && <h2 className="text-lg font-bold text-slate-800 text-center">{question.prompt}</h2>}
      {question.images?.[2] && (
        <img src={question.images[2]} alt="" className="max-h-80 mx-auto object-contain rounded-lg bg-slate-100" />
      )}
      <div className="flex items-center justify-center gap-2 flex-wrap text-slate-800 font-bold">
        {question.prefix && <span>{question.prefix}</span>}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`border rounded-lg p-2 text-sm w-48 ${
            isCorrect === true
              ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
              : isCorrect === false
              ? 'border-rose-400 bg-rose-50 text-rose-800'
              : 'border-slate-300 bg-white text-slate-900'
          }`}
        />
        {question.suffix && <span>{question.suffix}</span>}
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
  const images = q.images || ['', '', ''];
  const updateImage = (i, url) => onChange({ images: images.map((im, j) => (j === i ? url : im)) });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
          Instrucciones (opcional)
        </label>
        <input
          type="text"
          value={q.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="ej. ¿Quién soy?"
          className="w-full border border-slate-300 rounded-md p-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Pista {i + 1} {i === 0 ? '(más difícil)' : i === 2 ? '(revelado completo)' : ''}
            </label>
            {images[i] && <img src={images[i]} alt="" className="w-full h-20 object-cover rounded-md border border-slate-200 mb-1" />}
            <ImageUploadField
              value={images[i] || ''}
              onChange={(url) => updateImage(i, url)}
              folder="curiosidades"
              inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
            Prefijo (opcional, ej. "La")
          </label>
          <input
            type="text"
            value={q.prefix || ''}
            onChange={(e) => onChange({ prefix: e.target.value })}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
            Respuesta(s) — separa variantes con coma
          </label>
          <input
            type="text"
            value={q.answer}
            onChange={(e) => onChange({ answer: e.target.value })}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
            Sufijo (opcional, ej. "la exploradora")
          </label>
          <input
            type="text"
            value={q.suffix || ''}
            onChange={(e) => onChange({ suffix: e.target.value })}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
      </div>

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
