import React, { useState, useEffect, useRef } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { PromptImage } from './clozeShared';

// "Put these in the correct order" — items are stored pre-sorted into their
// correct sequence; the student sees them shuffled and drags (or uses the
// ▲▼ buttons) to reorder. Raw shape === persisted shape (like multiple_choice
// and write), so a standalone importer can write this type directly with no
// finalizeQuestion() transform step.
export const TYPE_KEY = 'ordering';
export const TYPE_LABEL = 'Ordenar';

export const emptyQuestion = () => ({
  type: 'ordering',
  prompt: '',
  promptImage: '',
  items: [{ text: '', image: '' }, { text: '', image: '' }],
  allowPartialCredit: false,
});

// allowPartialCredit decides what "one gradable item" means for this
// question: either the whole sequence (all-or-nothing, 1 item) or each
// position in it (credit per correctly-placed item, N items) — both shapes
// already work with the engines' generic getItemCount-sum/gradeState-flatten
// aggregation, same as matching's multi-pair questions.
export const getItemCount = (q) => (q.allowPartialCredit ? (q.items || []).length : 1);
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

// Pure, given an {order} snapshot — order[i] is the index into q.items
// currently sitting in display position i. The stored `items` array IS the
// correct order, so position i is correct iff order[i] === i.
export const gradeState = (question, state) => {
  const order = state?.order || [];
  const positionsCorrect = (question.items || []).map((_, i) => order[i] === i);
  if (question.allowPartialCredit) return positionsCorrect;
  return [positionsCorrect.length > 0 && positionsCorrect.every(Boolean)];
};

// Fisher-Yates, re-rolled if it lands back on the correct order — the
// puzzle must never start solved.
const shuffledOrder = (n) => {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);
  let arr;
  do {
    arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  } while (arr.every((v, i) => v === i));
  return arr;
};

const ItemContent = ({ item }) => (
  <>
    {item.image && <img src={item.image} alt="" className="w-full h-20 object-contain bg-slate-950 rounded-lg mb-1" />}
    {item.text && <span className="text-sm font-bold text-slate-200">{item.text}</span>}
  </>
);

// Shared drag/reorder list for both modes — dragging uses Pointer Events
// (not HTML5 drag-and-drop, which has no touch support) so mouse, touch and
// pen all work the same way; the ▲▼ buttons are always visible, not just a
// fallback, for keyboard/accessibility use and for anyone who finds tapping
// easier than dragging on a touch device.
const OrderList = ({ items, order, setOrder, locked, rowState }) => {
  const containerRef = useRef(null);
  const draggingPosRef = useRef(null);

  const movePos = (from, to) => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handlePointerDown = (e, pos) => {
    if (locked) return;
    draggingPosRef.current = pos;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const fromPos = draggingPosRef.current;
    if (fromPos === null || !containerRef.current) return;
    const rows = Array.from(containerRef.current.children);
    const hoverIdx = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return e.clientY >= rect.top && e.clientY <= rect.bottom;
    });
    if (hoverIdx !== -1 && hoverIdx !== fromPos) {
      movePos(fromPos, hoverIdx);
      draggingPosRef.current = hoverIdx;
    }
  };

  const handlePointerUp = () => {
    draggingPosRef.current = null;
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {order.map((itemIdx, pos) => {
        const item = items[itemIdx];
        const state = rowState?.(pos);
        return (
          <div
            key={itemIdx}
            onPointerDown={(e) => handlePointerDown(e, pos)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: locked ? 'auto' : 'none' }}
            className={`flex items-center gap-2 p-2 border rounded-xl transition-all select-none ${
              state === true
                ? 'border-emerald-500 bg-emerald-950'
                : state === false
                ? 'border-rose-500 bg-rose-950'
                : 'bg-slate-900 border-slate-700'
            } ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
          >
            <span className="text-slate-500 font-black text-xs w-5 text-center shrink-0">{pos + 1}</span>
            <div className="flex-1 min-w-0">
              <ItemContent item={item} />
            </div>
            {!locked && (
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => movePos(pos, pos - 1)}
                  disabled={pos === 0}
                  aria-label="Subir"
                  className="text-slate-400 hover:text-amber-400 disabled:opacity-20 text-xs leading-none px-1"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => movePos(pos, pos + 1)}
                  disabled={pos === order.length - 1}
                  aria-label="Bajar"
                  className="text-slate-400 hover:text-amber-400 disabled:opacity-20 text-xs leading-none px-1"
                >
                  ▼
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// --- Student-facing renderer ---
// Dispatches on `mode` — see src/shared/questionTypes/index.js for the full
// contract.
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

// Retry mode: the student freely rearranges, then clicks "Comprobar Orden" —
// an exact match locks it and advances; a wrong attempt just flashes rows
// red/green and lets them keep adjusting and re-checking (same
// retry-until-correct spirit as matching), rather than the one-shot
// grade-and-move-on behavior write/listen use.
const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const n = (question.items || []).length;
  const [order, setOrder] = useState(() => initialState?.order || shuffledOrder(n));
  const [done, setDone] = useState(() => initialState?.done || false);
  const [checked, setChecked] = useState(() => initialState?.done || false);
  const attemptedRef = useRef(false);

  // Resuming an already-solved question re-shows the advance control right
  // away, without requiring another check.
  useEffect(() => {
    if (initialState?.done) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ order, done });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, done]);

  const positionsCorrect = (question.items || []).map((_, i) => order[i] === i);
  const overall = positionsCorrect.length > 0 && positionsCorrect.every(Boolean);

  const handleCheck = () => {
    if (done) return;
    if (!attemptedRef.current) {
      attemptedRef.current = true;
      if (question.allowPartialCredit) {
        positionsCorrect.forEach((isCorrect, i) => onItemFirstAttempt(i, isCorrect));
      } else {
        onItemFirstAttempt(0, overall);
      }
    }
    setChecked(true);
    if (overall) {
      setDone(true);
      onAllCorrect();
    }
  };

  return (
    <div>
      <PromptImage src={question.promptImage} />
      <OrderList
        items={question.items}
        order={order}
        setOrder={(updater) => {
          setChecked(false);
          setOrder(updater);
        }}
        locked={done}
        rowState={(pos) => (checked ? positionsCorrect[pos] : null)}
      />
      {!done && (
        <button onClick={handleCheck} className="mt-3 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">
          Comprobar Orden
        </button>
      )}
      {checked && !overall && <p className="text-sm text-rose-400 font-bold mt-2">Todavía no es el orden correcto — sigue intentando.</p>}
    </div>
  );
};

// Deferred mode: freely reorderable at all times, nothing locked — colored
// live from the caller's own `submitted` flag, same as every other type's
// deferred renderer.
const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const n = (question.items || []).length;
  const [order, setOrder] = useState(() => initialState?.order || shuffledOrder(n));

  useEffect(() => {
    onStateChange?.({ order });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const positionsCorrect = submitted ? (question.items || []).map((_, i) => order[i] === i) : null;

  return (
    <div>
      <PromptImage src={question.promptImage} />
      <OrderList items={question.items} order={order} setOrder={setOrder} locked={false} rowState={(pos) => (submitted ? positionsCorrect[pos] : null)} />
    </div>
  );
};

// --- Admin-facing editor ---
export const Editor = ({ question: q, onChange }) => {
  const items = q.items || [];

  const updateItem = (idx, patch) => {
    onChange({ items: items.map((it, j) => (j === idx ? { ...it, ...patch } : it)) });
  };
  const addItem = () => onChange({ items: [...items, { text: '', image: '' }] });
  const removeItem = (idx) => onChange({ items: items.filter((_, j) => j !== idx) });
  const moveItem = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(idx, 1);
    next.splice(to, 0, moved);
    onChange({ items: next });
  };

  return (
    <>
      <div className="mb-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Imagen de la pregunta (opcional)</label>
        <div className="flex items-center gap-2">
          {q.promptImage && <img src={q.promptImage} alt="" className="w-12 h-12 object-cover rounded-md border border-slate-200 shrink-0" />}
          <ImageUploadField
            value={q.promptImage || ''}
            onChange={(url) => onChange({ promptImage: url })}
            folder="curiosidades"
            inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
          />
        </div>
      </div>

      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Escribe los elementos en el ORDEN CORRECTO (de arriba hacia abajo).</p>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
            <span className="text-slate-400 font-black text-xs w-5 text-center shrink-0 mt-2">{idx + 1}</span>
            <div className="flex-1 min-w-0 space-y-1">
              <input
                type="text"
                value={item.text || ''}
                onChange={(e) => updateItem(idx, { text: e.target.value })}
                placeholder="Elemento"
                className="w-full border border-slate-300 rounded-md p-1.5 text-xs"
              />
              <div className="flex items-center gap-1">
                {item.image && <img src={item.image} alt="" className="w-8 h-8 object-cover rounded-md border border-slate-200 shrink-0" />}
                <ImageUploadField
                  value={item.image || ''}
                  onChange={(url) => updateItem(idx, { image: url })}
                  folder="curiosidades"
                  inputClassName="w-full border border-slate-300 rounded-md p-1 text-[9px] font-mono"
                />
              </div>
            </div>
            <div className="flex flex-col shrink-0 mt-1">
              <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 text-xs leading-none px-1">
                ▲
              </button>
              <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 text-xs leading-none px-1">
                ▼
              </button>
            </div>
            <button onClick={() => removeItem(idx)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1 mt-2">
              ✕
            </button>
          </div>
        ))}
      </div>
      {items.length < 8 && (
        <button onClick={addItem} className="mt-2 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
          + Agregar elemento
        </button>
      )}
      {items.length < 2 && <p className="text-[10px] text-amber-600 font-bold mt-1">Necesitas al menos 2 elementos.</p>}

      <label className="flex items-center gap-2 mt-3">
        <input type="checkbox" checked={!!q.allowPartialCredit} onChange={(e) => onChange({ allowPartialCredit: e.target.checked })} />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dar crédito parcial por elemento en la posición correcta</span>
      </label>
    </>
  );
};
