import React from 'react';

// Shuffles a copy of the array (Fisher-Yates would be overkill here — a
// simple random sort is fine for a handful of tiles/options).
export const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// Splits a cloze passage on its "{{blank}}" tokens, interleaving the plain
// text with one inline <select> per blank. Index-based keys are fine here —
// the segments never reorder within a render. `optionsForBlank(i)` decouples
// this from whether each blank has its own option list (dropdown_cloze) or
// all blanks share one word bank (word_bank_cloze).
export const renderClozeText = (text, selections, correctArr, wrongFlashIdx, onSelect, optionsForBlank) => {
  const parts = (text || '').split('{{blank}}');
  const nodes = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`t-${i}`}>{part}</span>);
    if (i < parts.length - 1) {
      const isCorrect = correctArr[i];
      const isWrong = wrongFlashIdx === i;
      nodes.push(
        <select
          key={`b-${i}`}
          value={selections[i] || ''}
          onChange={(e) => onSelect(i, e.target.value)}
          disabled={isCorrect}
          className={`mx-1 border-b-2 bg-slate-900 font-bold rounded px-2 py-1 text-sm align-middle ${
            isCorrect
              ? 'border-emerald-500 text-emerald-400'
              : isWrong
              ? 'border-rose-500 text-rose-300'
              : 'border-slate-500 text-sky-300'
          }`}
        >
          <option value="" disabled>
            ?
          </option>
          {optionsForBlank(i).map((opt, oIdx) => (
            <option key={oIdx} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
  });
  return nodes;
};

// Shared visual chrome both cloze types use: an "N de M completados"
// sub-progress line (once there's more than one blank), then the optional
// image, then the passage itself.
export const ClozeChrome = ({ img, children, completed, total }) => (
  <div>
    {total > 1 && (
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-6">
        {completed} de {total} completados
      </p>
    )}
    {img && <img src={img} alt="" className="w-full max-h-64 object-contain bg-slate-950 rounded-lg mb-6" />}
    <p className="text-base text-slate-200 leading-loose text-center">{children}</p>
  </div>
);
