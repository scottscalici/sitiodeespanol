import React, { useState } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { renderClozeText, ClozeChrome, sameWord, buildWordBank } from './clozeShared';
import { parseLines, parseAnswerTokens } from './text';

export const TYPE_KEY = 'word_bank_cloze';
export const TYPE_LABEL = 'Cloze con Banco de Palabras';

export const emptyQuestion = () => ({ type: 'word_bank_cloze', prompt: '', img: '', rawText: '', distractorsText: '' });
export const getItemCount = (q) => q.answers.length;

// Converts the raw, freely-typed editing fields into the final shape the
// Renderer reads: blank-tokenized `text`, ordered `answers`, and a single
// `wordBank` merging answers + distractors (deduped, alphabetized).
export const finalizeQuestion = (q) => {
  const { rawText, distractorsText, ...rest } = q;
  const { text, answers } = parseAnswerTokens(rawText);
  const distractors = parseLines(distractorsText);
  const wordBank = buildWordBank(answers, distractors);
  return { ...rest, text, answers, wordBank };
};

// Reopening an already-saved question only has the final (blank-tokenized)
// shape — reconstructs the {{word}}-tagged passage and distractors list.
export const reconstructQuestion = (q) => {
  if (q.rawText !== undefined) return q;
  const answers = q.answers || [];
  let i = 0;
  const rawText = (q.text || '').replace(/\{\{blank\}\}/g, () => `{{${answers[i++] ?? ''}}}`);
  const distractorsText = (q.wordBank || []).filter((w) => !answers.includes(w)).join('\n');
  return { ...q, rawText, distractorsText };
};

// --- Student-facing renderer ---
// Every blank shares the SAME word bank; a word already correctly placed in
// one blank disappears from the others (same as a paper word bank), while
// distractors (never correct anywhere) stay available throughout. Grading is
// deferred to an explicit "Revisar" click (not on every selection), same
// submit-then-grade model as dropdown_cloze — a word only leaves the shared
// bank once Revisar actually confirms it's correct, not the instant it's
// picked.
export const Renderer = ({ question, onItemFirstAttempt, onAllCorrect }) => {
  const blankCount = question.answers.length;
  const [selections, setSelections] = useState(() => Array(blankCount).fill(''));
  const [correct, setCorrect] = useState(() => Array(blankCount).fill(false));
  const [wrongAttempted, setWrongAttempted] = useState(() => Array(blankCount).fill(false));
  const attemptedRef = React.useRef({});

  const handleSelect = (blankIdx, value) => {
    if (correct[blankIdx]) return;
    setSelections((prev) => prev.map((v, i) => (i === blankIdx ? value : v)));
    setWrongAttempted((prev) => prev.map((w, i) => (i === blankIdx ? false : w)));
  };

  const handleRevisar = () => {
    const nextCorrect = [...correct];
    const nextWrong = [...wrongAttempted];

    question.answers.forEach((answer, i) => {
      if (nextCorrect[i]) return; // already locked correct — nothing to re-check
      const isCorrect = sameWord(answer, selections[i]);

      if (!attemptedRef.current[i]) {
        attemptedRef.current[i] = true;
        onItemFirstAttempt(i, isCorrect);
      }

      if (isCorrect) {
        nextCorrect[i] = true;
        nextWrong[i] = false;
      } else {
        nextWrong[i] = true;
      }
    });

    setCorrect(nextCorrect);
    setWrongAttempted(nextWrong);
    if (nextCorrect.every(Boolean)) onAllCorrect();
  };

  const allCorrect = correct.every(Boolean);

  const optionsForBlank = (blankIdx) => {
    const usedElsewhere = question.answers.filter((_, j) => j !== blankIdx && correct[j]);
    return (question.wordBank || []).filter((w) => !usedElsewhere.some((a) => sameWord(a, w)));
  };

  return (
    <div>
      <ClozeChrome img={question.img} completed={correct.filter(Boolean).length} total={blankCount}>
        {renderClozeText(question.text, selections, correct, wrongAttempted, handleSelect, optionsForBlank)}
      </ClozeChrome>
      {!allCorrect && (
        <div className="mt-6 text-center">
          <button
            onClick={handleRevisar}
            className="bg-sky-600 hover:bg-sky-700 text-white font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl transition-colors"
          >
            Revisar
          </button>
        </div>
      )}
    </div>
  );
};

// --- Admin-facing editor ---
export const Editor = ({ question: q, onChange }) => {
  const preview = parseAnswerTokens(q.rawText);
  return (
    <>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
        Escribe el párrafo y pon la respuesta correcta entre llaves dobles, como{' '}
        <code className="bg-slate-200 px-1 rounded">{'{{agua}}'}</code>, donde va cada espacio en blanco — todos
        comparten un banco de palabras generado automáticamente.
      </p>

      <div className="flex items-start gap-2 mb-3">
        {q.img && <img src={q.img} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 shrink-0" />}
        <ImageUploadField
          value={q.img}
          onChange={(url) => onChange({ img: url })}
          folder="curiosidades"
          placeholder="Imagen opcional"
          inputClassName="w-full border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
        />
      </div>

      <textarea
        value={q.rawText || ''}
        onChange={(e) => onChange({ rawText: e.target.value })}
        rows={3}
        placeholder={'El pato nada en {{agua}} y come {{pan}}. Vive cerca del {{lago}}.'}
        className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
      />

      {preview.answers.length === 0 ? (
        <p className="text-xs text-slate-400 italic mt-2">
          Agrega al menos una respuesta entre llaves dobles, como {'{{agua}}'}.
        </p>
      ) : (
        <p className="text-xs text-slate-500 mt-2">
          {preview.answers.length} espacio{preview.answers.length === 1 ? '' : 's'} en blanco: {preview.answers.join(', ')}
        </p>
      )}

      <div className="mt-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Distractores extra (opcional, uno por línea — palabras incorrectas que también aparecerán en el banco)
        </label>
        <textarea
          value={q.distractorsText || ''}
          onChange={(e) => onChange({ distractorsText: e.target.value })}
          rows={2}
          className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono mt-1"
          placeholder={'sol\nnube'}
        />
      </div>
    </>
  );
};
