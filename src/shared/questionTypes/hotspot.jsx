import React, { useState } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';

// Click-the-spot-on-one-shared-image — e.g. a lotería board where the
// student clicks the picture matching a given word. Deliberately one
// question = one image + one target (not several words batched into one
// question): a teacher with a board of several words just adds one
// question per word, reusing the same uploaded board image each time —
// matches every other type's "one question = one gradable thing" shape,
// and generalizes cleanly to a future board with a different image per
// question too.
export const TYPE_KEY = 'hotspot';
export const TYPE_LABEL = 'Punto en la Imagen';

// target.x/y: the correct spot's center, as a percentage of the image's
// rendered width/height (0-100) — resolution/display-size independent.
// target.radius: click tolerance, as a percentage of the image's width.
export const emptyQuestion = () => ({
  type: 'hotspot',
  prompt: '',
  image: '',
  target: { x: 50, y: 50, radius: 8 },
});

export const getItemCount = () => 1;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

const withinTarget = (x, y, target) => {
  if (x == null || y == null || !target) return false;
  const dist = Math.hypot(x - (target.x ?? 50), y - (target.y ?? 50));
  return dist <= (target.radius ?? 8);
};

// Pure, given an {x, y} click snapshot — see dropdownCloze.jsx's gradeState
// for why this is the one place "what counts as correct" lives.
export const gradeState = (question, state) => [withinTarget(state?.x, state?.y, question.target)];

// Shared click-to-percentage handler + marker overlay, used by both modes.
const clickToPercent = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  };
};

const Marker = ({ x, y, color }) => (
  <div
    className={`absolute w-5 h-5 rounded-full border-2 -translate-x-1/2 -translate-y-1/2 ${color}`}
    style={{ left: `${x}%`, top: `${y}%` }}
  />
);

// Dispatches on `mode` — see src/shared/questionTypes/index.js for the full
// contract.
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

// One click = one attempt. A miss is marked wrong immediately and reveals
// the correct spot on the board (matches write/listen's reveal-on-miss),
// then locks — no retry, consistent with every other single-shot type here.
const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const [click, setClick] = useState(() => (initialState?.x != null ? { x: initialState.x, y: initialState.y } : null));
  const [done, setDone] = useState(() => initialState?.done || false);
  const attemptedRef = React.useRef(false);

  React.useEffect(() => {
    if (initialState?.done) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    onStateChange?.({ x: click?.x, y: click?.y, done });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [click, done]);

  const isCorrect = click ? withinTarget(click.x, click.y, question.target) : null;

  const handleClick = (e) => {
    if (done) return;
    const pt = clickToPercent(e);
    setClick(pt);
    setDone(true);
    const correct = withinTarget(pt.x, pt.y, question.target);
    if (!attemptedRef.current) {
      attemptedRef.current = true;
      onItemFirstAttempt(0, correct);
    }
    onAllCorrect();
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-800">{question.prompt}</h2>
      <div className="relative inline-block w-full">
        <img
          src={question.image}
          alt=""
          onClick={handleClick}
          className={`w-full rounded-lg border border-slate-200 ${done ? '' : 'cursor-crosshair'}`}
        />
        {click && <Marker x={click.x} y={click.y} color={isCorrect ? 'border-emerald-500 bg-emerald-400/40' : 'border-rose-500 bg-rose-400/40'} />}
        {done && !isCorrect && question.target && (
          <Marker x={question.target.x} y={question.target.y} color="border-emerald-500 bg-transparent" />
        )}
      </div>
      {!done && <p className="text-xs text-slate-400">Haz clic en la imagen.</p>}
    </div>
  );
};

// Freely re-clickable until the whole card is submitted, like every other
// deferred renderer — no lock, colored live once `submitted` is true.
const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const [click, setClick] = useState(() => (initialState?.x != null ? { x: initialState.x, y: initialState.y } : null));

  React.useEffect(() => {
    onStateChange?.({ x: click?.x, y: click?.y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [click]);

  const handleClick = (e) => setClick(clickToPercent(e));

  const isCorrect = submitted && click ? withinTarget(click.x, click.y, question.target) : null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-800">{question.prompt}</h2>
      <div className="relative inline-block w-full">
        <img src={question.image} alt="" onClick={handleClick} className="w-full rounded-lg border border-slate-200 cursor-crosshair" />
        {click && (
          <Marker
            x={click.x}
            y={click.y}
            color={isCorrect === true ? 'border-emerald-500 bg-emerald-400/40' : isCorrect === false ? 'border-rose-500 bg-rose-400/40' : 'border-sky-500 bg-sky-400/40'}
          />
        )}
        {submitted && isCorrect === false && question.target && (
          <Marker x={question.target.x} y={question.target.y} color="border-emerald-500 bg-transparent" />
        )}
      </div>
    </div>
  );
};

// --- Admin-facing editor ---
// Coordinates are set by clicking directly on the uploaded image — typing
// raw percentages would be nearly impossible to calibrate accurately by
// hand, and a teacher placing several of these per board needs this to be
// fast and visual.
export const Editor = ({ question: q, onChange }) => {
  const target = q.target || { x: 50, y: 50, radius: 8 };

  const handlePlace = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onChange({ target: { ...target, x, y } });
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={q.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        placeholder="Pregunta / palabra a buscar (ej: Haz clic en: la rana)"
        className="w-full border border-slate-300 rounded-md p-2 text-sm"
      />
      <ImageUploadField
        value={q.image || ''}
        onChange={(url) => onChange({ image: url })}
        folder="curiosidades"
        placeholder="Imagen del tablero"
        inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
      />
      {q.image ? (
        <>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Haz clic en la imagen para marcar el punto correcto:</p>
          <div className="relative inline-block w-full">
            <img src={q.image} alt="" onClick={handlePlace} className="w-full rounded-lg border border-slate-300 cursor-crosshair" />
            <div
              className="absolute box-border rounded-full border-2 border-indigo-600 bg-indigo-400/30 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${target.x}%`, top: `${target.y}%`, width: `${target.radius * 2}%`, height: 0, paddingBottom: `${target.radius * 2}%` }}
            />
          </div>
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
            Tolerancia del clic:
            <input
              type="range"
              min="3"
              max="25"
              value={target.radius}
              onChange={(e) => onChange({ target: { ...target, radius: Number(e.target.value) } })}
              className="flex-1"
            />
            <span className="font-mono text-slate-400">{target.radius}%</span>
          </label>
        </>
      ) : (
        <p className="text-xs text-slate-400 italic">Sube una imagen para poder marcar el punto correcto.</p>
      )}
    </div>
  );
};
