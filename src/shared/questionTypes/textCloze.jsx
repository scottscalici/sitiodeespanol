import React, { useState, useEffect } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { renderClozeTextInputs, ClozeChrome } from './clozeShared';
import { parseAnswerTokens, parseLines } from './text';
import { checkAnswerLeniently } from '../../utils/checkAnswer';

// Like word_bank_cloze, but every blank is free-typed instead of picked from
// a shared bank — a whole paragraph in context, one input per blank, graded
// with the same lenient Spanish-answer checker `write` uses (accents/
// articles/variants). Use this instead of word_bank_cloze when the original
// material (e.g. a worksheet import) never offered a word bank at all — the
// student types the same way they would on paper.
export const TYPE_KEY = 'text_cloze';
export const TYPE_LABEL = 'Cloze de Texto Libre';

export const emptyQuestion = () => ({ type: 'text_cloze', prompt: '', img: '', rawText: '', verbBankText: '', requireAccents: false });
export const getItemCount = (q) => q.answers.length;

// Converts the raw, freely-typed {{answer}}-tagged passage into the final
// blank-tokenized `text` + ordered `answers` the Renderer reads — same
// save-time conversion word_bank_cloze does, minus the word-bank step.
// `verbBankText` (optional, one infinitive per line) becomes `verbBank` —
// a plain reference list shown above the passage, NOT a clickable bank of
// answers like word_bank_cloze's: free typing means there's no "spend a
// word once" mechanic to support, just a hint of which verbs to use.
export const finalizeQuestion = (q) => {
  const { rawText, verbBankText, ...rest } = q;
  const { text, answers } = parseAnswerTokens(rawText);
  return { ...rest, text, answers, verbBank: parseLines(verbBankText) };
};

// Reopening an already-saved question only has the final blank-tokenized
// shape — reconstructs the {{word}}-tagged passage and verb bank text for
// editing.
export const reconstructQuestion = (q) => {
  if (q.rawText !== undefined) return q;
  const answers = q.answers || [];
  let i = 0;
  const rawText = (q.text || '').replace(/\{\{blank\}\}/g, () => `{{${answers[i++] ?? ''}}}`);
  const verbBankText = (q.verbBank || []).join('\n');
  return { ...q, rawText, verbBankText };
};

// Pure, given a {values} snapshot — see dropdownCloze.jsx's gradeState for
// why this is the one place "what counts as correct" lives.
export const gradeState = (question, state) => {
  const values = state?.values || [];
  return question.answers.map((answer, i) => checkAnswerLeniently(values[i] || '', answer, !!question.requireAccents).correct);
};

// --- Student-facing renderer ---
// Dispatches on `mode` — see src/shared/questionTypes/index.js for the full
// contract.
export const Renderer = (props) => (props.mode === 'deferred' ? <DeferredRenderer {...props} /> : <RetryRenderer {...props} />);

// Grading is deferred to an explicit "Revisar" click (not on every
// keystroke) — same submit-then-grade model as dropdown_cloze/
// word_bank_cloze, so a student can fill in every blank before anything is
// checked.
const RetryRenderer = ({ question, onItemFirstAttempt, onAllCorrect, initialState, onStateChange }) => {
  const blankCount = question.answers.length;
  const [values, setValues] = useState(() => initialState?.values || Array(blankCount).fill(''));
  const [correct, setCorrect] = useState(() => initialState?.correct || Array(blankCount).fill(false));
  const [wrongAttempted, setWrongAttempted] = useState(() => initialState?.wrongAttempted || Array(blankCount).fill(false));
  const attemptedRef = React.useRef({});

  useEffect(() => {
    if (initialState?.correct?.length && initialState.correct.every(Boolean)) onAllCorrect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ values, correct, wrongAttempted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, correct, wrongAttempted]);

  const handleChange = (blankIdx, value) => {
    if (correct[blankIdx]) return;
    setValues((prev) => prev.map((v, i) => (i === blankIdx ? value : v)));
    setWrongAttempted((prev) => prev.map((w, i) => (i === blankIdx ? false : w)));
  };

  const handleRevisar = () => {
    const nextCorrect = [...correct];
    const nextWrong = [...wrongAttempted];

    question.answers.forEach((answer, i) => {
      if (nextCorrect[i]) return; // already locked correct — nothing to re-check
      const isCorrect = checkAnswerLeniently(values[i] || '', answer, !!question.requireAccents).correct;

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

  return (
    <div>
      <ClozeChrome img={question.img} completed={correct.filter(Boolean).length} total={blankCount} verbBank={question.verbBank}>
        {renderClozeTextInputs(question.text, values, correct, wrongAttempted, handleChange)}
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

// Freely editable at all times (never locks, even once correct — the
// student may resubmit for a better score), with no Revisar step: grading
// only ever shows once the caller says the whole card has been submitted,
// and re-colors live from then on as the student keeps editing.
const DeferredRenderer = ({ question, submitted, initialState, onStateChange }) => {
  const blankCount = question.answers.length;
  const [values, setValues] = useState(() => initialState?.values || Array(blankCount).fill(''));

  useEffect(() => {
    onStateChange?.({ values });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const handleChange = (blankIdx, value) => {
    setValues((prev) => prev.map((v, i) => (i === blankIdx ? value : v)));
  };

  const correct = submitted ? gradeState(question, { values }) : Array(blankCount).fill(null);
  const wrong = correct.map((c) => c === false);
  const completedCount = submitted ? correct.filter((c) => c === true).length : values.filter(Boolean).length;

  return (
    <ClozeChrome img={question.img} completed={completedCount} total={blankCount} prompt={question.prompt} verbBank={question.verbBank} light>
      {renderClozeTextInputs(question.text, values, correct, wrong, handleChange, { lockOnCorrect: false })}
    </ClozeChrome>
  );
};

// --- Admin-facing editor ---
export const Editor = ({ question: q, onChange }) => {
  const preview = parseAnswerTokens(q.rawText);
  return (
    <>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
        Escribe el párrafo y pon la respuesta correcta entre llaves dobles, como{' '}
        <code className="bg-slate-200 px-1 rounded">{'{{hablé}}'}</code>, donde va cada espacio en blanco — el
        estudiante escribe cada respuesta libremente, sin banco de palabras.
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
        rows={4}
        placeholder={'Eran las ocho cuando Francisca y Elena {{se levantaron}} para ir al centro.'}
        className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
      />

      {preview.answers.length === 0 ? (
        <p className="text-xs text-slate-400 italic mt-2">
          Agrega al menos una respuesta entre llaves dobles, como {'{{hablé}}'}.
        </p>
      ) : (
        <p className="text-xs text-slate-500 mt-2">
          {preview.answers.length} espacio{preview.answers.length === 1 ? '' : 's'} en blanco: {preview.answers.join(', ')}
        </p>
      )}

      <div className="mt-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Banco de verbos (opcional, un infinitivo por línea — solo de referencia, el estudiante igual escribe la
          respuesta conjugada)
        </label>
        <textarea
          value={q.verbBankText || ''}
          onChange={(e) => onChange({ verbBankText: e.target.value })}
          rows={2}
          className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono mt-1"
          placeholder={'hablar\ncomer\nvivir'}
        />
      </div>

      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 mt-3">
        <input
          type="checkbox"
          checked={!!q.requireAccents}
          onChange={(e) => onChange({ requireAccents: e.target.checked })}
        />
        Requerir acentos correctos (si no, solo se avisa)
      </label>
    </>
  );
};
