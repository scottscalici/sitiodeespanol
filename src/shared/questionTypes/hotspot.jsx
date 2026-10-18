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

// target.x/y: the correct region's CENTER, as a percentage of the image's
// rendered width/height (0-100) — resolution/display-size independent.
// target.shape: 'circle' (target.radius, % of image width) or 'box'
// (target.width/target.height, independent % of image width/height —
// a board of rectangular grid cells fits a box far better than a circle).
export const emptyQuestion = () => ({
  type: 'hotspot',
  prompt: '',
  image: '',
  target: { shape: 'circle', x: 50, y: 50, radius: 8, width: 20, height: 15 },
});

export const getItemCount = () => 1;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

const withinTarget = (x, y, target) => {
  if (x == null || y == null || !target) return false;
  if (target.shape === 'box') {
    return Math.abs(x - (target.x ?? 50)) <= (target.width ?? 20) / 2 && Math.abs(y - (target.y ?? 50)) <= (target.height ?? 15) / 2;
  }
  return Math.hypot(x - (target.x ?? 50), y - (target.y ?? 50)) <= (target.radius ?? 8);
};

// Pure, given an {x, y} click snapshot — see dropdownCloze.jsx's gradeState
// for why this is the one place "what counts as correct" lives.
export const gradeState = (question, state) => [withinTarget(state?.x, state?.y, question.target)];

// Shared click-to-percentage handler, used by both render modes.
const posFromEvent = (e, el) => {
  const rect = el.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  };
};

// Where the student clicked — always a small dot, regardless of the
// target's own shape (this just marks "you clicked here").
const ClickMarker = ({ x, y, color }) => (
  <div
    className={`absolute w-5 h-5 rounded-full border-2 -translate-x-1/2 -translate-y-1/2 ${color}`}
    style={{ left: `${x}%`, top: `${y}%` }}
  />
);

// The actual target region — a circle or a box, matching `target.shape`.
// Used for the reveal-on-miss outline and the admin editor's live preview.
const TargetShape = ({ target, className }) => {
  if (target.shape === 'box') {
    return (
      <div
        className={`absolute border-2 -translate-x-1/2 -translate-y-1/2 pointer-events-none ${className}`}
        style={{ left: `${target.x}%`, top: `${target.y}%`, width: `${target.width}%`, height: `${target.height}%` }}
      />
    );
  }
  return (
    <div
      className={`absolute box-border rounded-full border-2 -translate-x-1/2 -translate-y-1/2 pointer-events-none ${className}`}
      style={{ left: `${target.x}%`, top: `${target.y}%`, width: `${target.radius * 2}%`, height: 0, paddingBottom: `${target.radius * 2}%` }}
    />
  );
};

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
    const pt = posFromEvent(e, e.currentTarget);
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
        {click && <ClickMarker x={click.x} y={click.y} color={isCorrect ? 'border-emerald-500 bg-emerald-400/40' : 'border-rose-500 bg-rose-400/40'} />}
        {done && !isCorrect && question.target && <TargetShape target={question.target} className="border-emerald-500" />}
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

  const handleClick = (e) => setClick(posFromEvent(e, e.currentTarget));

  const isCorrect = submitted && click ? withinTarget(click.x, click.y, question.target) : null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-800">{question.prompt}</h2>
      <div className="relative inline-block w-full">
        <img src={question.image} alt="" onClick={handleClick} className="w-full rounded-lg border border-slate-200 cursor-crosshair" />
        {click && (
          <ClickMarker
            x={click.x}
            y={click.y}
            color={isCorrect === true ? 'border-emerald-500 bg-emerald-400/40' : isCorrect === false ? 'border-rose-500 bg-rose-400/40' : 'border-sky-500 bg-sky-400/40'}
          />
        )}
        {submitted && isCorrect === false && question.target && <TargetShape target={question.target} className="border-emerald-500" />}
      </div>
    </div>
  );
};

// --- Admin-facing editor ---
// Circle mode: click the image to set the center (radius via a slider).
// Box mode: click-and-drag to trace the actual rectangle on the board —
// typing raw percentages, for either shape, would be unworkable to
// calibrate by hand.
const MIN_BOX_SIZE = 3; // percent — guards against a near-zero-size box from an accidental plain click

export const Editor = ({ question: q, onChange }) => {
  const target = q.target || { shape: 'circle', x: 50, y: 50, radius: 8, width: 20, height: 15 };
  const [drag, setDrag] = useState(null); // { start: {x,y}, current: {x,y} } while drawing a box
  // A freshly-uploaded board photo can still be decoding when the editor
  // mounts; its rendered box grows mid-drag as the real dimensions settle,
  // which desyncs drag-start's percentage (taken against the stale box)
  // from drag-end's (against the final one) and corrupts the saved target.
  // Gate interaction on the image actually being loaded to rule that out.
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = React.useRef(null);

  React.useEffect(() => {
    setImgLoaded(false);
  }, [q.image]);

  const handleImgLoad = () => setImgLoaded(true);
  // onLoad never fires for an already-cached image mounted complete.
  const handleImgRef = (el) => {
    imgRef.current = el;
    if (el?.complete) setImgLoaded(true);
  };

  const setShape = (shape) => onChange({ target: { ...target, shape } });

  const handleMouseDown = (e) => {
    if (target.shape !== 'box' || !imgLoaded) return;
    const pt = posFromEvent(e, e.currentTarget);
    setDrag({ start: pt, current: pt });
  };
  const handleMouseMove = (e) => {
    if (!drag) return;
    setDrag({ start: drag.start, current: posFromEvent(e, e.currentTarget) });
  };
  const handleMouseUp = (e) => {
    if (!drag) return;
    const end = posFromEvent(e, e.currentTarget);
    let x1 = Math.min(drag.start.x, end.x);
    let x2 = Math.max(drag.start.x, end.x);
    let y1 = Math.min(drag.start.y, end.y);
    let y2 = Math.max(drag.start.y, end.y);
    let width = x2 - x1;
    let height = y2 - y1;
    if (width < MIN_BOX_SIZE || height < MIN_BOX_SIZE) {
      // Treat as a plain click rather than a drag — center a default-sized box there.
      width = Math.max(width, MIN_BOX_SIZE * 3);
      height = Math.max(height, MIN_BOX_SIZE * 3);
    }
    const x = x1 + (x2 - x1) / 2 || end.x;
    const y = y1 + (y2 - y1) / 2 || end.y;
    onChange({ target: { ...target, x, y, width, height } });
    setDrag(null);
  };

  const handleCircleClick = (e) => {
    if (!imgLoaded) return;
    const pt = posFromEvent(e, e.currentTarget);
    onChange({ target: { ...target, x: pt.x, y: pt.y } });
  };

  const dragPreview =
    drag &&
    (() => {
      const x1 = Math.min(drag.start.x, drag.current.x);
      const x2 = Math.max(drag.start.x, drag.current.x);
      const y1 = Math.min(drag.start.y, drag.current.y);
      const y2 = Math.max(drag.start.y, drag.current.y);
      return { left: x1, top: y1, width: x2 - x1, height: y2 - y1 };
    })();

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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShape('circle')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                target.shape !== 'box' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              ⭕ Círculo
            </button>
            <button
              type="button"
              onClick={() => setShape('box')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                target.shape === 'box' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              ⬜ Caja
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {target.shape === 'box' ? 'Arrastra sobre la imagen para dibujar la caja correcta:' : 'Haz clic en la imagen para marcar el punto correcto:'}
          </p>
          <div
            className="relative inline-block w-full select-none"
            onMouseDown={target.shape === 'box' ? handleMouseDown : undefined}
            onMouseMove={target.shape === 'box' ? handleMouseMove : undefined}
            onMouseUp={target.shape === 'box' ? handleMouseUp : undefined}
          >
            <img
              ref={handleImgRef}
              src={q.image}
              alt=""
              onLoad={handleImgLoad}
              onClick={target.shape === 'box' ? undefined : handleCircleClick}
              draggable={false}
              className="w-full rounded-lg border border-slate-300 cursor-crosshair"
            />
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 rounded-lg text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Cargando imagen…
              </div>
            )}
            {imgLoaded && !drag && <TargetShape target={target} className="border-indigo-600 bg-indigo-400/30" />}
            {dragPreview && (
              <div
                className="absolute border-2 border-indigo-600 bg-indigo-400/30 pointer-events-none"
                style={{ left: `${dragPreview.left}%`, top: `${dragPreview.top}%`, width: `${dragPreview.width}%`, height: `${dragPreview.height}%` }}
              />
            )}
          </div>
          {target.shape !== 'box' && (
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
          )}
        </>
      ) : (
        <p className="text-xs text-slate-400 italic">Sube una imagen para poder marcar el punto correcto.</p>
      )}
    </div>
  );
};
