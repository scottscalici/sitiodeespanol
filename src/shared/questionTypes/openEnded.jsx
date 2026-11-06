import React from 'react';
import { PromptImage, PromptAudio } from './clozeShared';

export const TYPE_KEY = 'open_ended';
export const TYPE_LABEL = 'Respuesta Abierta (calificada por el profesor)';

export const emptyQuestion = () => ({
  type: 'open_ended',
  prompt: '',
  promptImage: '',
  promptAudio: '',
  placeholder: '',
});

// Not machine-gradable, so it contributes nothing to a card's auto-scored
// total — getItemCount of 0 excludes it from totalItems, gradeState of []
// has nothing to report. The student's free-text response is still saved
// (via onStateChange, same as every other type) and still occupies its own
// spot in the question list; a teacher grades it separately (see the
// teacher-grading queue, a later addition) and that grade is added to the
// student's classwork total on its own, not folded into this card's own
// percentage.
export const getItemCount = () => 0;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;
export const gradeState = () => [];

// --- Student-facing renderer ---
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

// 'retry' mode has no real meaning here (nothing to grade instantly), but
// the contract still expects every type to support it — a plain textarea
// that reports itself done once the student has typed something and moved
// on, so a caller that uses this mode elsewhere doesn't get stuck.
const RetryRenderer = ({ question, onAllCorrect, initialState, onStateChange, hidePrompt }) => {
  const [text, setText] = React.useState(initialState?.text || '');
  const reportedRef = React.useRef(false);

  React.useEffect(() => {
    onStateChange?.({ text });
    if (text.trim() && !reportedRef.current) {
      reportedRef.current = true;
      onAllCorrect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div>
      <PromptImage src={question.promptImage} />
      <PromptAudio src={question.promptAudio} />
      {!hidePrompt && <h2 className="text-lg font-bold text-slate-800 mb-4">{question.prompt}</h2>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={question.placeholder || 'Escribe tu respuesta...'}
        rows={5}
        className="w-full border-2 border-slate-700 bg-slate-900 text-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:border-amber-400"
      />
    </div>
  );
};

const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const [text, setText] = React.useState(initialState?.text || '');

  React.useEffect(() => {
    onStateChange?.({ text });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div>
      <PromptImage src={question.promptImage} />
      <PromptAudio src={question.promptAudio} />
      <h2 className="text-lg font-bold text-slate-800 mb-4">{question.prompt}</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={question.placeholder || 'Escribe tu respuesta...'}
        rows={5}
        disabled={submitted}
        className="w-full border-2 border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-amber-400 disabled:bg-slate-50 disabled:text-slate-500"
      />
      {submitted && (
        <p className="mt-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
          ⏳ Pendiente de revisión del profesor
        </p>
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
        placeholder="Pregunta de respuesta abierta"
        className="w-full border border-slate-300 rounded-md p-2 text-sm"
      />
    </div>
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
        Placeholder (opcional)
      </label>
      <input
        type="text"
        value={q.placeholder || ''}
        onChange={(e) => onChange({ placeholder: e.target.value })}
        placeholder="Texto de ejemplo dentro del cuadro de respuesta"
        className="w-full border border-slate-300 rounded-md p-2 text-xs"
      />
    </div>
    <p className="text-[10px] text-slate-400 mt-2">
      Esta pregunta no se califica automáticamente — el profesor la revisa y asigna puntos por separado.
    </p>
  </>
);
