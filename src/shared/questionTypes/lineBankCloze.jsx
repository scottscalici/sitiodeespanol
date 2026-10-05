import React, { useState } from 'react';
import ImageUploadField from '../../admin/shared/ImageUploadField';
import { renderClozeText, sameWord, buildWordBank } from './clozeShared';
import { parseLines, parseAnswerTokens } from './text';

// Like word_bank_cloze, but several independent rows (each its own optional
// photo + one short line of text) instead of one shared passage — e.g. a
// roster of athlete photos, each captioned "Amon-Ra St. {{Café}}", all
// pulling from one shared, alphabetized word bank. Blanks are numbered
// globally across every row for grading (onItemFirstAttempt/getItemCount),
// but each row's own {{blank}} tokens are local to that row's text.
//
// `allowRepeats` (default false, so existing saved questions keep their
// original depleting behavior): when true, a word stays available in every
// row's dropdown even after it's been used correctly elsewhere — e.g. a
// direct-object-pronoun drill where "lo" is legitimately the right answer
// for several different sentences at once, unlike a roster where each
// correct surname is only ever used once.
export const TYPE_KEY = 'line_bank_cloze';
export const TYPE_LABEL = 'Líneas con Banco de Palabras';

export const emptyQuestion = () => ({ type: 'line_bank_cloze', prompt: '', lines: [{ img: '', rawText: '' }], distractorsText: '', allowRepeats: false });
export const getItemCount = (q) => q.answers.length;

// Converts each row's raw {{word}}-tagged text into its blank-tokenized
// form, concatenating every row's answers (in row order) into one flat
// `answers` array — same save-time conversion word_bank_cloze does, just
// repeated per row instead of once for a whole passage.
export const finalizeQuestion = (q) => {
  const { lines, distractorsText, ...rest } = q;
  let answers = [];
  const finalLines = (lines || []).map((line) => {
    const parsed = parseAnswerTokens(line.rawText || '');
    answers = answers.concat(parsed.answers);
    return { img: line.img || '', text: parsed.text };
  });
  const distractors = parseLines(distractorsText);
  const wordBank = buildWordBank(answers, distractors);
  return { ...rest, lines: finalLines, answers, wordBank };
};

// Reopening an already-saved question only has each row's final
// blank-tokenized text plus the flat `answers` array — walks that array in
// order, handing each row exactly as many answers as it has blanks.
export const reconstructQuestion = (q) => {
  if (q.lines?.[0]?.rawText !== undefined) return q;
  const answers = q.answers || [];
  let i = 0;
  const lines = (q.lines || []).map((line) => ({
    img: line.img || '',
    rawText: (line.text || '').replace(/\{\{blank\}\}/g, () => `{{${answers[i++] ?? ''}}}`),
  }));
  const distractorsText = (q.wordBank || []).filter((w) => !answers.includes(w)).join('\n');
  return { ...q, lines, distractorsText };
};

// Bulk-imports MULTIPLE separate line_bank_cloze questions ("sections") in
// one paste, splitting on divider lines instead of dumping everything into
// one question's `lines` — pasting two sections back-to-back used to
// silently merge them into one oversized question with no way to tell
// where one ended and the next began. A divider is a line starting with
// "---" (plain) or "#"/"##"/"###" (optionally followed by a title, which
// becomes that section's `prompt`, shown to students above the question).
// Content before the first divider is its own section with no prompt.
// Returns questions in their raw, editable shape (ready to drop straight
// into admin state next to any other question), each defaulting to
// allowRepeats: false same as emptyQuestion().
const DIVIDER_RE = /^(?:-{3,}|#{1,3})\s*(.*)$/;
export const parseBulkSections = (text) => {
  const lines = (text || '').split('\n').map((l) => l.trim());
  const sections = [];
  let current = { prompt: '', rawLines: [] };
  lines.forEach((line) => {
    if (!line) return;
    const divider = line.match(DIVIDER_RE);
    if (divider) {
      if (current.rawLines.length > 0) sections.push(current);
      current = { prompt: divider[1].trim(), rawLines: [] };
    } else {
      current.rawLines.push(line);
    }
  });
  if (current.rawLines.length > 0) sections.push(current);

  return sections.map((s) => ({
    type: TYPE_KEY,
    prompt: s.prompt,
    lines: s.rawLines.map((rawText) => ({ img: '', rawText })),
    distractorsText: '',
    allowRepeats: false,
  }));
};

// --- Student-facing renderer ---
// Same "shared word bank, word disappears once correctly placed elsewhere"
// mechanic as word_bank_cloze, just spread across several rows. Each row
// gets a slice of the global selections/correct arrays (and the global
// wrongFlash index, translated to that row's local blank numbering) so
// renderClozeText — which only knows about ONE text string's own blanks —
// can be reused unmodified per row.
export const Renderer = ({ question, onItemFirstAttempt, onAllCorrect }) => {
  const blankCount = question.answers.length;
  const [selections, setSelections] = useState(() => Array(blankCount).fill(''));
  const [correct, setCorrect] = useState(() => Array(blankCount).fill(false));
  const [wrongFlash, setWrongFlash] = useState(null);
  const attemptedRef = React.useRef({});

  const handleSelect = (globalIdx, value) => {
    if (correct[globalIdx]) return;
    const isCorrect = sameWord(question.answers[globalIdx], value);

    if (!attemptedRef.current[globalIdx]) {
      attemptedRef.current[globalIdx] = true;
      onItemFirstAttempt(globalIdx, isCorrect);
    }

    setSelections((prev) => prev.map((v, i) => (i === globalIdx ? value : v)));
    if (isCorrect) {
      const next = correct.map((c, i) => (i === globalIdx ? true : c));
      setCorrect(next);
      if (next.every(Boolean)) onAllCorrect();
    } else {
      setWrongFlash(globalIdx);
      setTimeout(() => setWrongFlash(null), 400);
    }
  };

  const optionsForBlank = (globalIdx) => {
    if (question.allowRepeats) return question.wordBank || [];
    const usedElsewhere = question.answers.filter((_, j) => j !== globalIdx && correct[j]);
    return (question.wordBank || []).filter((w) => !usedElsewhere.some((a) => sameWord(a, w)));
  };

  let offset = 0;

  return (
    <div>
      {blankCount > 1 && (
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-6">
          {correct.filter(Boolean).length} de {blankCount} completados
        </p>
      )}
      <div className="space-y-3">
        {question.lines.map((line, lIdx) => {
          const lineBlankCount = (line.text.match(/\{\{blank\}\}/g) || []).length;
          const start = offset;
          offset += lineBlankCount;
          return (
            <div key={lIdx} className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-xl p-3">
              {line.img && (
                <img src={line.img} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-700 shrink-0" />
              )}
              <p className="text-base text-slate-200 leading-loose text-left flex-1">
                {renderClozeText(
                  line.text,
                  selections.slice(start, start + lineBlankCount),
                  correct.slice(start, start + lineBlankCount),
                  wrongFlash !== null && wrongFlash >= start && wrongFlash < start + lineBlankCount ? wrongFlash - start : null,
                  (localIdx, value) => handleSelect(start + localIdx, value),
                  (localIdx) => optionsForBlank(start + localIdx)
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Admin-facing editor ---
export const Editor = ({ question: q, onChange }) => {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [copied, setCopied] = useState(false);

  const updateLine = (lIdx, patch) => {
    onChange({ lines: q.lines.map((l, j) => (j === lIdx ? { ...l, ...patch } : l)) });
  };
  const addLine = () => onChange({ lines: [...q.lines, { img: '', rawText: '' }] });
  const removeLine = (lIdx) => onChange({ lines: q.lines.filter((_, j) => j !== lIdx) });

  // Pasting several lines at once creates one row per non-blank line, each
  // with no photo yet (added individually afterward if wanted) — if the
  // question is still just its single untouched starter row, the paste
  // replaces it instead of leaving an empty row at the top.
  const handleBulkAdd = () => {
    const newLines = parseLines(bulkText).map((rawText) => ({ img: '', rawText }));
    if (newLines.length === 0) return;
    const onlyBlankStarterRow = q.lines.length === 1 && !q.lines[0].rawText.trim() && !q.lines[0].img;
    onChange({ lines: onlyBlankStarterRow ? newLines : [...q.lines, ...newLines] });
    setBulkText('');
    setBulkOpen(false);
  };

  // Lets the admin pull this question's lines back out as plain text — to
  // fix a typo in bulk, reorder rows, split this question in two, or move
  // some lines into a different question — by copying them out, editing
  // them as text, and pasting back in (here, or into another question's
  // own paste box, or into the section importer above the question list).
  const copyAsText = async () => {
    try {
      await navigator.clipboard.writeText(q.lines.map((l) => l.rawText).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying lines as text:', err);
    }
  };

  const allAnswers = (q.lines || []).flatMap((l) => parseAnswerTokens(l.rawText || '').answers);

  return (
    <>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
        Una línea por elemento (foto opcional + texto). Escribe la respuesta correcta entre llaves dobles, como{' '}
        <code className="bg-slate-200 px-1 rounded">{'{{Café}}'}</code> — todas las líneas comparten un banco de palabras.
      </p>

      <div className="space-y-2">
        {q.lines.map((line, lIdx) => (
          <div key={lIdx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
            <div className="flex items-center gap-2 shrink-0">
              {line.img && (
                <img src={line.img} alt="" className="w-10 h-10 object-cover rounded-md border border-slate-200" />
              )}
              <ImageUploadField
                value={line.img}
                onChange={(url) => updateLine(lIdx, { img: url })}
                folder="curiosidades"
                placeholder="Foto opcional"
                inputClassName="w-28 border border-slate-300 rounded-md p-1.5 text-[10px] font-mono"
              />
            </div>
            <input
              type="text"
              value={line.rawText}
              onChange={(e) => updateLine(lIdx, { rawText: e.target.value })}
              placeholder="Amon-Ra St. {{Café}}"
              className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs font-mono min-w-0"
            />
            <button onClick={() => removeLine(lIdx)} className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1">
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button onClick={addLine} className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
          + Agregar línea
        </button>
        <button onClick={() => setBulkOpen((v) => !v)} className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
          📋 Pegar varias líneas
        </button>
        {q.lines.length > 0 && (
          <button onClick={copyAsText} className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
            {copied ? '✅ Copiado' : '📤 Copiar como texto'}
          </button>
        )}
      </div>

      {bulkOpen && (
        <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-1">
            Una línea por fila, con la respuesta entre llaves dobles — se agregan sin foto (puedes añadirla después).
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={4}
            placeholder={'Tengo el libro. → {{Lo}} tengo.\nVeo a María. → {{La}} veo.\nTengo los libros. → {{Los}} tengo.'}
            className="w-full border border-indigo-300 rounded-md p-2 text-xs font-mono bg-white"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleBulkAdd}
              disabled={!bulkText.trim()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
            >
              Agregar líneas
            </button>
          </div>
        </div>
      )}

      {allAnswers.length === 0 ? (
        <p className="text-xs text-slate-400 italic mt-2">
          Agrega al menos una respuesta entre llaves dobles, como {'{{Café}}'}.
        </p>
      ) : (
        <p className="text-xs text-slate-500 mt-2">
          {allAnswers.length} espacio{allAnswers.length === 1 ? '' : 's'} en blanco: {allAnswers.join(', ')}
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
          placeholder={'campo\nduro'}
        />
      </div>

      <label className="flex items-start gap-2 mt-3 text-xs text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={!!q.allowRepeats}
          onChange={(e) => onChange({ allowRepeats: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          <span className="font-bold">Permitir repetir opciones</span> — cada opción sigue disponible en todas las
          líneas aunque ya se haya usado (útil para algo como pronombres de objeto directo, donde "lo" puede ser la
          respuesta correcta varias veces). Si está desmarcado, cada opción desaparece del banco una vez usada
          correctamente, como en Cloze con Banco de Palabras.
        </span>
      </label>
    </>
  );
};
