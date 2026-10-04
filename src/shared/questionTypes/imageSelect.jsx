import React, { useState } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';

export const TYPE_KEY = 'image_select';
export const TYPE_LABEL = 'Selección de Imagen';

export const emptyQuestion = () => ({
  type: 'image_select',
  prompt: '',
  options: [
    { img: '', label: '' },
    { img: '', label: '' },
  ],
  correctIndices: [],
});

export const getItemCount = () => 1;
export const finalizeQuestion = (q) => q;
export const reconstructQuestion = (q) => q;

// --- Student-facing renderer ---
// Single-correct-answer questions resolve the instant you click one option;
// multi-correct ones let you toggle several, then confirm. Either way, one
// gradable item (itemIdx 0), first-attempt-only, lock on correct.
export const Renderer = ({ question, onItemFirstAttempt, onAllCorrect }) => {
  const isMultiSelect = (question.correctIndices || []).length > 1;
  const [selectedIdx, setSelectedIdx] = useState([]);
  const [done, setDone] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const attemptedRef = React.useRef(false);

  const recordAttempt = (selection) => {
    const isCorrect = [...question.correctIndices].sort().join(',') === [...selection].sort().join(',');
    if (!attemptedRef.current) {
      attemptedRef.current = true;
      onItemFirstAttempt(0, isCorrect);
    }
    if (isCorrect) {
      setDone(true);
      onAllCorrect();
    } else {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 400);
    }
  };

  const handleSelectSingle = (oIdx) => {
    if (done) return;
    setSelectedIdx([oIdx]);
    recordAttempt([oIdx]);
  };

  const handleToggle = (oIdx) => {
    if (done) return;
    setSelectedIdx((prev) => (prev.includes(oIdx) ? prev.filter((i) => i !== oIdx) : [...prev, oIdx]));
  };

  const handleConfirm = () => {
    if (done || selectedIdx.length === 0) return;
    recordAttempt(selectedIdx);
  };

  return (
    <div>
      {isMultiSelect && (
        <p className="text-xs text-slate-400 text-center mb-4">(elige {question.correctIndices.length})</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {question.options.map((opt, oIdx) => {
          const isSelected = selectedIdx.includes(oIdx);
          const showWrong = wrongFlash && isSelected;
          const showCorrect = done && isSelected;
          return (
            <button
              key={oIdx}
              onClick={() => (isMultiSelect ? handleToggle(oIdx) : handleSelectSingle(oIdx))}
              disabled={done}
              className={`border-2 rounded-xl overflow-hidden transition-all ${
                showWrong
                  ? 'border-rose-500'
                  : showCorrect
                  ? 'border-emerald-500'
                  : isSelected
                  ? 'border-sky-400'
                  : 'border-slate-700 hover:border-slate-500'
              } ${done && !isSelected ? 'opacity-40' : ''}`}
            >
              <img src={opt.img} alt={opt.label || ''} className="w-full h-32 object-contain bg-slate-950" />
              {opt.label && <p className="text-[10px] font-bold text-slate-300 p-1.5">{opt.label}</p>}
            </button>
          );
        })}
      </div>
      {isMultiSelect && !done && (
        <button
          onClick={handleConfirm}
          disabled={selectedIdx.length === 0}
          className="mt-4 w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-black rounded-xl text-xs uppercase tracking-widest"
        >
          Confirmar Selección
        </button>
      )}
    </div>
  );
};

// --- Admin-facing editor ---
export const Editor = ({ question: q, onChange }) => {
  const updateOption = (oIdx, patch) => {
    onChange({ options: q.options.map((o, j) => (j === oIdx ? { ...o, ...patch } : o)) });
  };
  const addOption = () => onChange({ options: [...q.options, { img: '', label: '' }] });
  const removeOption = (oIdx) => {
    onChange({
      options: q.options.filter((_, j) => j !== oIdx),
      correctIndices: (q.correctIndices || [])
        .filter((idx) => idx !== oIdx)
        .map((idx) => (idx > oIdx ? idx - 1 : idx)),
    });
  };
  const toggleCorrect = (oIdx) => {
    const current = q.correctIndices || [];
    const isCorrect = current.includes(oIdx);
    onChange({ correctIndices: isCorrect ? current.filter((idx) => idx !== oIdx) : [...current, oIdx] });
  };

  return (
    <>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
        Marca la casilla de cada opción correcta — marcar más de una la convierte en una pregunta de "elige{' '}
        {(q.correctIndices || []).length || 'N'}".
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {q.options.map((opt, oIdx) => {
          const isCorrect = (q.correctIndices || []).includes(oIdx);
          return (
            <div
              key={oIdx}
              className={`bg-white border rounded-lg p-2 flex flex-col gap-2 ${
                isCorrect ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200'
              }`}
            >
              {opt.img && <img src={opt.img} alt="" className="w-full h-20 object-cover rounded-md border border-slate-200" />}
              <ImageUploadField
                value={opt.img}
                onChange={(url) => updateOption(oIdx, { img: url })}
                folder="curiosidades"
                inputClassName="w-full border border-slate-300 rounded-md p-1 text-[10px] font-mono"
              />
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(oIdx, { label: e.target.value })}
                placeholder="Etiqueta opcional"
                className="w-full border border-slate-300 rounded-md p-1.5 text-xs"
              />
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                <input type="checkbox" checked={isCorrect} onChange={() => toggleCorrect(oIdx)} />
                Correcta
              </label>
              <button onClick={() => removeOption(oIdx)} className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700">
                ✕ Quitar opción
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={addOption} className="mt-3 text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
        + Agregar opción
      </button>
    </>
  );
};
