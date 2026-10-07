import React, { useState, useEffect } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { shuffle } from './clozeShared';

export const TYPE_KEY = 'matching';
export const TYPE_LABEL = 'Emparejar';

export const emptyQuestion = () => ({
  type: 'matching',
  prompt: '',
  pairs: [{ left: { type: 'text', value: '' }, answer: '' }],
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
// array — reconstructs the editable raw text once on load.
export const reconstructQuestion = (q) =>
  q.distractorsText !== undefined ? q : { ...q, distractorsText: (q.distractors || []).join('\n') };

// Pure, given an {assignments} snapshot (deferred mode's own shape — see
// DeferredRenderer below) — see dropdownCloze.jsx's gradeState for why this
// is the one place "what counts as correct" lives.
export const gradeState = (question, state) => {
  const assignments = state?.assignments || [];
  return question.pairs.map((pair, i) => pair.answer === assignments[i]);
};

// --- Student-facing renderer ---
// Dispatches on `mode` — see src/shared/questionTypes/index.js for the full
// contract.
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

// Self-contained: owns its own interaction state, remounts fresh whenever
// the caller changes its `key` (e.g. on navigating to a different question).
// Calls onItemFirstAttempt(pairIdx, isCorrect) once per pair's first attempt,
// and onAllCorrect() once every pair has been matched.
const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const [matchedPairIdx, setMatchedPairIdx] = useState(() => initialState?.matchedPairIdx || []);
  const [selectedLeftIdx, setSelectedLeftIdx] = useState(null);
  const [shuffledAnswers] = useState(() =>
    shuffle(question.pairs.map((p) => p.answer).concat(question.distractors || []))
  );
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

  const handleAttemptAnswer = (answer, answerTileIdx) => {
    if (selectedLeftIdx === null) return;
    const pair = question.pairs[selectedLeftIdx];
    const isCorrect = pair.answer === answer;

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
          {question.pairs.map((pair, pIdx) => (
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
              {pair.left.type === 'image' ? (
                <img src={pair.left.value} alt="" className="w-full h-32 object-contain bg-slate-950 rounded-lg" />
              ) : (
                <span className="text-xs font-bold text-slate-200">{pair.left.value}</span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {shuffledAnswers.map((answer, aIdx) => {
            const alreadyUsed = matchedPairIdx.some((pIdx) => question.pairs[pIdx].answer === answer);
            return (
              <button
                key={aIdx}
                onClick={() => handleAttemptAnswer(answer, aIdx)}
                disabled={alreadyUsed}
                className={`w-full p-3 border rounded-xl text-xs font-bold text-left transition-all ${
                  alreadyUsed
                    ? 'opacity-20 pointer-events-none bg-slate-950 border-slate-900 text-slate-700'
                    : wrongFlashIdx === aIdx
                    ? 'border-rose-500 bg-rose-950 text-rose-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400'
                }`}
              >
                {answer}
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
  const pairCount = question.pairs.length;
  const [assignments, setAssignments] = useState(() => initialState?.assignments || Array(pairCount).fill(null));
  const [selectedLeftIdx, setSelectedLeftIdx] = useState(null);
  const [shuffledAnswers] = useState(() =>
    shuffle(question.pairs.map((p) => p.answer).concat(question.distractors || []))
  );

  useEffect(() => {
    onStateChange?.({ assignments });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments]);

  const correct = submitted ? gradeState(question, { assignments }) : Array(pairCount).fill(null);
  const completedCount = submitted ? correct.filter((c) => c === true).length : assignments.filter(Boolean).length;

  const handleAssign = (answer) => {
    if (selectedLeftIdx === null) return;
    setAssignments((prev) => prev.map((v, i) => (i === selectedLeftIdx ? answer : v)));
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
          {question.pairs.map((pair, pIdx) => {
            const isCorrect = correct[pIdx];
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
                {pair.left.type === 'image' ? (
                  <img src={pair.left.value} alt="" className="w-full h-32 object-contain bg-slate-950 rounded-lg" />
                ) : (
                  <span className="text-xs font-bold text-slate-200">{pair.left.value}</span>
                )}
                {assignments[pIdx] && (
                  <span
                    className={`block mt-1 text-[10px] font-black uppercase tracking-widest ${
                      isCorrect === true ? 'text-emerald-400' : isCorrect === false ? 'text-rose-400' : 'text-sky-300'
                    }`}
                  >
                    → {assignments[pIdx]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {shuffledAnswers.map((answer, aIdx) => {
            const usedElsewhere = assignments.some((a, i) => i !== selectedLeftIdx && a === answer);
            if (usedElsewhere) return null;
            const isSelectedPairsAnswer = selectedLeftIdx !== null && assignments[selectedLeftIdx] === answer;
            return (
              <button
                key={aIdx}
                onClick={() => handleAssign(answer)}
                disabled={selectedLeftIdx === null}
                className={`w-full p-3 border rounded-xl text-xs font-bold text-left transition-all disabled:opacity-40 ${
                  isSelectedPairsAnswer
                    ? 'border-sky-400 bg-sky-950 text-slate-100'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400'
                }`}
              >
                {answer}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Admin-facing editor ---
export const Editor = ({ question: q, onChange }) => {
  const updatePair = (pIdx, patch) => {
    onChange({ pairs: q.pairs.map((p, j) => (j === pIdx ? { ...p, ...patch } : p)) });
  };
  const addPair = () => onChange({ pairs: [...q.pairs, { left: { type: 'text', value: '' }, answer: '' }] });
  const removePair = (pIdx) => onChange({ pairs: q.pairs.filter((_, j) => j !== pIdx) });

  return (
    <>
      <div className="space-y-2">
        {q.pairs.map((pair, pIdx) => (
          <div key={pIdx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
            <select
              value={pair.left.type}
              onChange={(e) => updatePair(pIdx, { left: { type: e.target.value, value: '' } })}
              className="text-xs border border-slate-300 rounded-md p-1.5 font-bold shrink-0"
            >
              <option value="text">Texto</option>
              <option value="image">Imagen</option>
            </select>

            {pair.left.type === 'image' ? (
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {pair.left.value && (
                  <img
                    src={pair.left.value}
                    alt=""
                    className="w-10 h-10 object-cover rounded-md border border-slate-200 shrink-0"
                  />
                )}
                <ImageUploadField
                  value={pair.left.value}
                  onChange={(url) => updatePair(pIdx, { left: { type: 'image', value: url } })}
                  folder="curiosidades"
                  inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
                />
              </div>
            ) : (
              <input
                type="text"
                value={pair.left.value}
                onChange={(e) => updatePair(pIdx, { left: { type: 'text', value: e.target.value } })}
                placeholder="Elemento (izquierda)"
                className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs min-w-0"
              />
            )}

            <span className="text-slate-300 shrink-0">→</span>

            <input
              type="text"
              value={pair.answer}
              onChange={(e) => updatePair(pIdx, { answer: e.target.value })}
              placeholder="Respuesta correcta"
              className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs min-w-0"
            />

            <button onClick={() => removePair(pIdx)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1">
              ✕
            </button>
          </div>
        ))}
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
