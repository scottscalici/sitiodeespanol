import React from 'react';

// Shuffles a copy of the array (Fisher-Yates would be overkill here — a
// simple random sort is fine for a handful of tiles/options).
export const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// Shared by multiple_choice, ordering, write, and matching — a question's
// own optional illustrative image (distinct from per-option/per-pair
// images), rendered the same way regardless of type.
export const PromptImage = ({ src }) =>
  src ? <img src={src} alt="" className="w-full max-h-64 object-contain bg-slate-950 rounded-xl mb-4" /> : null;

// Same idea as PromptImage, for a question's own audio clip (e.g. "listen
// and identify the genre") — a plain native player, no autoplay (a student
// should choose when to hear it, and autoplay would also fire again on
// every re-render of a type that re-renders on each keystroke).
export const PromptAudio = ({ src }) =>
  src ? <audio src={src} controls className="w-full mb-4" /> : null;

// Shared by word_bank_cloze and line_bank_cloze: "Lo" and "lo" are the same
// underlying word, differing only because Spanish capitalizes whichever
// one happens to start a sentence — not a grammar distinction either type
// is actually testing. Matching case-insensitively means picking either
// case counts as correct, and using one case correctly also excludes the
// other case from the rest of the bank (the "spend once" mechanic treats
// them as one word, not two).
export const sameWord = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

// Builds a bank's options from every blank's answer plus any extra
// distractors, deduped case-insensitively (first-seen casing wins) and
// alphabetized — so "Lo" and "lo" collapse into one chip instead of
// appearing as two separate, confusingly-similar options.
export const buildWordBank = (answers, distractors) => {
  const seen = new Map();
  [...answers, ...distractors].forEach((w) => {
    const key = (w || '').toLowerCase();
    if (!seen.has(key)) seen.set(key, w);
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'));
};

// Splits a cloze passage on its "{{blank}}" tokens, interleaving the plain
// text with one inline <select> per blank. Index-based keys are fine here —
// the segments never reorder within a render. `optionsForBlank(i)` decouples
// this from whether each blank has its own option list (dropdown_cloze) or
// all blanks share one word bank (word_bank_cloze). `wrongIndicator` is
// either a single blank index (a one-off transient flash, auto-cleared by
// the caller after a timeout — word_bank_cloze/line_bank_cloze) or an array
// of per-blank booleans (a persistent "graded and still wrong" indicator
// that stays until the student changes it or re-submits — dropdown_cloze's
// submit-to-check flow).
// `lockOnCorrect` (default true, matching every existing retry-mode caller)
// disables a blank once it's correct. Practice Cards' deferred, submit-the-
// whole-card mode passes false — every blank stays editable right up until
// the student is done, since "correct" there is just the live grading
// state as of the last Enviar, not a locked-in final answer.
export const renderClozeText = (text, selections, correctArr, wrongIndicator, onSelect, optionsForBlank, { lockOnCorrect = true } = {}) => {
  const parts = (text || '').split('{{blank}}');
  const nodes = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`t-${i}`}>{part}</span>);
    if (i < parts.length - 1) {
      const isCorrect = correctArr[i];
      const isWrong = Array.isArray(wrongIndicator) ? !!wrongIndicator[i] : wrongIndicator === i;
      nodes.push(
        <select
          key={`b-${i}`}
          value={selections[i] || ''}
          onChange={(e) => onSelect(i, e.target.value)}
          disabled={lockOnCorrect && isCorrect}
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

// Same interleaving idea as renderClozeText, but one free-text <input> per
// blank instead of a <select> — for text_cloze, where there's no bank of
// options to pick from, just whatever the student types. `correctArr`/
// `wrongIndicator` are per-blank boolean[]s, same shape/meaning as
// renderClozeText's (green once correct, red once checked-and-wrong,
// persisting until re-submitted/changed — a free-typed answer has no
// natural "instant" moment to grade at the way a click does).
// `lockOnCorrect` (default true, matching every other retry-mode cloze
// type) disables a blank once it's correct; Practice Cards' deferred mode
// passes false, same reasoning as renderClozeText.
export const renderClozeTextInputs = (text, values, correctArr, wrongIndicator, onChange, { lockOnCorrect = true } = {}) => {
  const parts = (text || '').split('{{blank}}');
  const nodes = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`t-${i}`}>{part}</span>);
    if (i < parts.length - 1) {
      const isCorrect = correctArr[i];
      const isWrong = !!wrongIndicator[i];
      nodes.push(
        <input
          key={`b-${i}`}
          type="text"
          value={values[i] || ''}
          onChange={(e) => onChange(i, e.target.value)}
          disabled={lockOnCorrect && isCorrect}
          size={Math.max(4, (values[i] || '').length + 2)}
          className={`mx-1 border-b-2 bg-slate-900 font-bold rounded px-2 py-1 text-sm align-middle outline-none ${
            isCorrect
              ? 'border-emerald-500 text-emerald-400'
              : isWrong
              ? 'border-rose-500 text-rose-300'
              : 'border-slate-500 text-sky-300 focus:border-sky-400'
          }`}
        />
      );
    }
  });
  return nodes;
};

// Shared visual chrome every cloze type uses: an optional prompt line, an
// "N de M completados" sub-progress line (once there's more than one
// blank), then the optional image, then the passage itself.
//
// `light` (default false, the original look) switches the passage/prompt
// text from light-on-dark to dark-on-light. It's not a cosmetic toggle —
// these colors were hardcoded for Curiosidad's dark quiz background, the
// only place a cloze type was ever used until Practice Cards' bulk
// importer made the other three cloze types reachable there too. Practice
// Cards' own page has a light background, so the original text-slate-200
// rendered as barely-visible light gray on near-white. A caller passes `light` iff
// it's rendering on a light page — currently that's exactly the
// `mode === 'deferred'` (Practice Cards) branch of every cloze type's own
// Renderer, never the `retry` (Curiosidad) one.
//
// `prompt` is only ever rendered here in the `light` case: Curiosidad's
// own engine already renders every question's prompt itself before
// handing off to a type's Renderer (plain `{question.prompt}`, correctly
// colored for its dark background) — rendering it again here would just
// duplicate it. Practice Cards' engine never renders a question's prompt
// at all (unlike write/multiple_choice/etc., which self-render their own),
// so a cloze type showing it here is the only place it was ever going to
// appear there.
//
// `verbBank` (text_cloze only — a plain reference list of infinitives, NOT
// a clickable word bank like word_bank_cloze's) renders right under the
// prompt, same position a paper worksheet's own word-bank box would sit in.
export const ClozeChrome = ({ img, children, completed, total, prompt, verbBank, light = false }) => (
  <div>
    {light && prompt && (
      <p className="text-sm font-bold text-slate-700 mb-4 text-center">{prompt}</p>
    )}
    {verbBank?.length > 0 && (
      <div className="mb-6 text-center">
        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${light ? 'text-slate-400' : 'text-slate-500'}`}>
          Banco de verbos
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {verbBank.map((v, i) => (
            <span
              key={i}
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                light ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {v}
            </span>
          ))}
        </div>
      </div>
    )}
    {total > 1 && (
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-6">
        {completed} de {total} completados
      </p>
    )}
    {img && <img src={img} alt="" className="w-full max-h-64 object-contain bg-slate-950 rounded-lg mb-6" />}
    <p className={`text-base leading-loose text-center ${light ? 'text-slate-800' : 'text-slate-200'}`}>{children}</p>
  </div>
);
