import React, { useState, useEffect } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { shuffle } from './clozeShared';

export const TYPE_KEY = 'matching';
export const TYPE_LABEL = 'Emparejar';

// A pair's two sides can each carry text and/or an image, shown together.
// Older saved questions used a narrower shape — `left: {type:'text'|'image',
// value}` (one or the other, never both) and a plain-string `answer` with no
// image at all. Student-facing rendering reads raw Firestore data directly
// (no reconstructQuestion pass — see CuriosidadQuizEngine/PracticeCardEngine),
// so normalizePair has to understand both shapes forever, not just at the
// one admin-editor load site.
const normalizePair = (pair) => ({
  left:
    pair.left && pair.left.type !== undefined
      ? {
          text: pair.left.type === 'text' ? pair.left.value || '' : '',
          image: pair.left.type === 'image' ? pair.left.value || '' : '',
        }
      : { text: pair.left?.text || '', image: pair.left?.image || '' },
  right: pair.right ? { text: pair.right.text || '', image: pair.right.image || '' } : { text: pair.answer || '', image: '' },
});

export const emptyQuestion = () => ({
  type: 'matching',
  prompt: '',
  pairs: [{ left: { text: '', image: '' }, right: { text: '', image: '' } }],
  distractorsText: '',
});

export const getItemCount = (q) => q.pairs.length;

// Converts the raw, freely-typed distractorsText into the final shape the
// Renderer reads — see parseLines's own comment (shared/questionTypes/text.js)
// for why this has to happen at save time, not on every keystroke.
export const finalizeQuestion = (q) => {
  const { distractorsText, ...rest } = q;
  return { ...rest, distractors: (distractorsText || '').split('\n').map((s) => s.trim()).filter(Boolean) };
};

// Reopening an already-saved question only has the final `distractors`
// array — reconstructs the editable raw text once on load, and migrates
// any pre-upgrade pairs into the current {text, image} shape so the Editor
// never has to special-case the old one.
export const reconstructQuestion = (q) => {
  const withDistractors = q.distractorsText !== undefined ? q : { ...q, distractorsText: (q.distractors || []).join('\n') };
  return { ...withDistractors, pairs: (withDistractors.pairs || []).map(normalizePair) };
};

// Pure, given an {assignments} snapshot (deferred mode's own shape — see
// DeferredRenderer below) — see dropdownCloze.jsx's gradeState for why this
// is the one place "what counts as correct" lives. Assignments hold an
// answer-bank key (`p${pairIndex}` for a real pair, `d${index}` for a
// distractor) rather than the answer's content, so grading never has to
// compare text/image values — a pair is correct iff it was matched to its
// own key.
export const gradeState = (question, state) => {
  const assignments = state?.assignments || [];
  return question.pairs.map((_, i) => assignments[i] === `p${i}`);
};

const buildAnswerBank = (question) => {
  const pairs = question.pairs.map(normalizePair);
  const real = pairs.map((p, i) => ({ key: `p${i}`, text: p.right.text, image: p.right.image }));
  const fake = (question.distractors || []).map((d, i) => ({ key: `d${i}`, text: d, image: '' }));
  return shuffle([...real, ...fake]);
};

const BankTile = ({ entry }) => (
  <>
    {entry.image && <img src={entry.image} alt="" className="w-full h-20 object-contain bg-slate-950 rounded-lg mb-1" />}
    {entry.text && <span className="text-xs font-bold text-slate-200">{entry.text}</span>}
  </>
);

const LeftTile = ({ left }) => (
  <>
    {left.image && <img src={left.image} alt="" className="w-full h-32 object-contain bg-slate-950 rounded-lg mb-1" />}
    {left.text && <span className="text-xs font-bold text-slate-200">{left.text}</span>}
  </>
);

// --- Student-facing renderer ---
// Dispatches on `mode` — see src/shared/questionTypes/index.js for the full
// contract.
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

// Self-contained: owns its own interaction state, remounts fresh whenever
// the caller changes its `key` (e.g. on navigating to a different question).
// Calls onItemFirstAttempt(pairIdx, isCorrect) once per pair's first attempt,
// and onAllCorrect() once every pair has been matched.
const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const pairs = question.pairs.map(normalizePair);
  const [matchedPairIdx, setMatchedPairIdx] = useState(() => initialState?.matchedPairIdx || []);
  const [selectedLeftIdx, setSelectedLeftIdx] = useState(null);
  const [answerBank] = useState(() => buildAnswerBank(question));
  const [wrongFlashIdx, setWrongFlashIdx] = useState(null);
  const attemptedRef = React.useRef({});

  // Resuming an already-fully-matched question re-shows the advance
  // control right away, without requiring another match.
  useEffect(() => {
    if (initialState?.matchedPairIdx?.length === question.pairs.length) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ matchedPairIdx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedPairIdx]);

  const handleSelectLeft = (pairIdx) => {
    if (matchedPairIdx.includes(pairIdx)) return;
    setSelectedLeftIdx(pairIdx);
  };

  const handleAttemptAnswer = (entry, answerTileIdx) => {
    if (selectedLeftIdx === null) return;
    const isCorrect = entry.key === `p${selectedLeftIdx}`;

    if (!attemptedRef.current[selectedLeftIdx]) {
      attemptedRef.current[selectedLeftIdx] = true;
      onItemFirstAttempt(selectedLeftIdx, isCorrect);
    }

    if (isCorrect) {
      const next = [...matchedPairIdx, selectedLeftIdx];
      setMatchedPairIdx(next);
      setSelectedLeftIdx(null);
      if (next.length === question.pairs.length) onAllCorrect();
    } else {
      setWrongFlashIdx(answerTileIdx);
      setTimeout(() => setWrongFlashIdx(null), 400);
    }
  };

  return (
    <div>
      {question.pairs.length > 1 && (
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-6">
          {matchedPairIdx.length} de {question.pairs.length} emparejados
        </p>
      )}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          {pairs.map((pair, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSelectLeft(pIdx)}
              disabled={matchedPairIdx.includes(pIdx)}
              className={`w-full p-2 border rounded-xl text-left transition-all ${
                matchedPairIdx.includes(pIdx)
                  ? 'opacity-20 pointer-events-none bg-slate-950 border-slate-900'
                  : selectedLeftIdx === pIdx
                  ? 'border-sky-400 bg-sky-950'
                  : 'bg-slate-900 border-slate-700 hover:border-slate-500'
              }`}
            >
              <LeftTile left={pair.left} />
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {answerBank.map((entry, aIdx) => {
            const alreadyUsed = matchedPairIdx.some((pIdx) => `p${pIdx}` === entry.key);
            return (
              <button
                key={aIdx}
                onClick={() => handleAttemptAnswer(entry, aIdx)}
                disabled={alreadyUsed}
                className={`w-full p-3 border rounded-xl text-xs font-bold text-left transition-all ${
                  alreadyUsed
                    ? 'opacity-20 pointer-events-none bg-slate-950 border-slate-900 text-slate-700'
                    : wrongFlashIdx === aIdx
                    ? 'border-rose-500 bg-rose-950 text-rose-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400'
                }`}
              >
                <BankTile entry={entry} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Deferred mode trades instant-match-on-click for a reassignable "slot"
// per left item: click a left item, then an answer tile to assign it —
// freely changeable (picking a new answer for an already-assigned item
// just overwrites it, freeing its old answer back into the pool) and never
// locked, since the student may fix a wrong pairing and resubmit. An
// answer already assigned to a DIFFERENT pair is left out of the grid —
// same "spend once, free the moment you reassign" mechanic the word-bank
// cloze types use — rather than instant-correct/wrong feedback per click.
const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const pairs = question.pairs.map(normalizePair);
  const pairCount = pairs.length;
  const [assignments, setAssignments] = useState(() => initialState?.assignments || Array(pairCount).fill(null));
  const [selectedLeftIdx, setSelectedLeftIdx] = useState(null);
  const [answerBank] = useState(() => buildAnswerBank(question));

  useEffect(() => {
    onStateChange?.({ assignments });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments]);

  const correct = submitted ? gradeState(question, { assignments }) : Array(pairCount).fill(null);
  const completedCount = submitted ? correct.filter((c) => c === true).length : assignments.filter(Boolean).length;

  const handleAssign = (entry) => {
    if (selectedLeftIdx === null) return;
    setAssignments((prev) => prev.map((v, i) => (i === selectedLeftIdx ? entry.key : v)));
    setSelectedLeftIdx(null);
  };

  return (
    <div>
      {pairCount > 1 && (
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-6">
          {completedCount} de {pairCount} {submitted ? 'correctos' : 'emparejados'}
        </p>
      )}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          {pairs.map((pair, pIdx) => {
            const isCorrect = correct[pIdx];
            const assignedEntry = assignments[pIdx] ? answerBank.find((e) => e.key === assignments[pIdx]) : null;
            return (
              <button
                key={pIdx}
                onClick={() => setSelectedLeftIdx(pIdx)}
                className={`w-full p-2 border rounded-xl text-left transition-all ${
                  isCorrect === true
                    ? 'border-emerald-500 bg-emerald-950'
                    : isCorrect === false
                    ? 'border-rose-500 bg-rose-950'
                    : selectedLeftIdx === pIdx
                    ? 'border-sky-400 bg-sky-950'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                }`}
              >
                <LeftTile left={pair.left} />
                {assignedEntry && (
                  <div
                    className={`flex items-center gap-1 mt-1 text-[10px] font-black uppercase tracking-widest ${
                      isCorrect === true ? 'text-emerald-400' : isCorrect === false ? 'text-rose-400' : 'text-sky-300'
                    }`}
                  >
                    <span>→</span>
                    {assignedEntry.image && (
                      <img src={assignedEntry.image} alt="" className="w-6 h-6 object-cover rounded border border-slate-700" />
                    )}
                    {assignedEntry.text && <span>{assignedEntry.text}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {answerBank.map((entry, aIdx) => {
            const usedElsewhere = assignments.some((a, i) => i !== selectedLeftIdx && a === entry.key);
            if (usedElsewhere) return null;
            const isSelectedPairsAnswer = selectedLeftIdx !== null && assignments[selectedLeftIdx] === entry.key;
            return (
              <button
                key={aIdx}
                onClick={() => handleAssign(entry)}
                disabled={selectedLeftIdx === null}
                className={`w-full p-3 border rounded-xl text-xs font-bold text-left transition-all disabled:opacity-40 ${
                  isSelectedPairsAnswer
                    ? 'border-sky-400 bg-sky-950 text-slate-100'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400'
                }`}
              >
                <BankTile entry={entry} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Admin-facing editor ---
const PairSideFields = ({ side, label, onTextChange, onImageChange }) => (
  <div className="flex-1 min-w-0 space-y-1">
    <input
      type="text"
      value={side.text}
      onChange={(e) => onTextChange(e.target.value)}
      placeholder={label}
      className="w-full border border-slate-300 rounded-md p-1.5 text-xs"
    />
    <div className="flex items-center gap-1">
      {side.image && (
        <img src={side.image} alt="" className="w-8 h-8 object-cover rounded-md border border-slate-200 shrink-0" />
      )}
      <ImageUploadField
        value={side.image}
        onChange={onImageChange}
        folder="curiosidades"
        inputClassName="w-full border border-slate-300 rounded-md p-1 text-[9px] font-mono"
      />
    </div>
  </div>
);

export const Editor = ({ question: q, onChange }) => {
  const updatePair = (pIdx, patch) => {
    onChange({ pairs: q.pairs.map((p, j) => (j === pIdx ? { ...normalizePair(p), ...patch } : p)) });
  };
  const updatePairSide = (pIdx, side, patch) => {
    const pair = normalizePair(q.pairs[pIdx]);
    updatePair(pIdx, { [side]: { ...pair[side], ...patch } });
  };
  const addPair = () => onChange({ pairs: [...q.pairs, { left: { text: '', image: '' }, right: { text: '', image: '' } }] });
  const removePair = (pIdx) => onChange({ pairs: q.pairs.filter((_, j) => j !== pIdx) });

  return (
    <>
      <div className="space-y-2">
        {q.pairs.map((rawPair, pIdx) => {
          const pair = normalizePair(rawPair);
          return (
            <div key={pIdx} className="flex items-start gap-2 bg-white border border-slate-200 rounded-lg p-2">
              <PairSideFields
                side={pair.left}
                label="Texto (izquierda, opcional si hay imagen)"
                onTextChange={(text) => updatePairSide(pIdx, 'left', { text })}
                onImageChange={(image) => updatePairSide(pIdx, 'left', { image })}
              />

              <span className="text-slate-300 shrink-0 mt-2">→</span>

              <PairSideFields
                side={pair.right}
                label="Texto (respuesta, opcional si hay imagen)"
                onTextChange={(text) => updatePairSide(pIdx, 'right', { text })}
                onImageChange={(image) => updatePairSide(pIdx, 'right', { image })}
              />

              <button onClick={() => removePair(pIdx)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1 mt-2">
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <button onClick={addPair} className="mt-2 text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
        + Agregar par
      </button>

      <div className="mt-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Distractores extra (opcional, uno por línea)
        </label>
        <textarea
          value={q.distractorsText || ''}
          onChange={(e) => onChange({ distractorsText: e.target.value })}
          rows={2}
          className="w-full border border-slate-300 rounded-lg p-2 text-xs mt-1"
          placeholder="Respuestas incorrectas extra que aparecerán en el banco de opciones"
        />
      </div>
    </>
  );
};
