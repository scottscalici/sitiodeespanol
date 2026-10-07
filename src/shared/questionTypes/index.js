// A neutral, pluggable catalog of question types — any consumer (currently
// Curiosidades and Practice Cards) picks a question's behavior purely
// by its `type` string, never by importing a type's internals directly.
// Each entry: { Renderer, Editor, getItemCount, emptyQuestion, finalizeQuestion, reconstructQuestion, TYPE_LABEL }.
//
// Renderer contract: <Renderer question={q} onItemFirstAttempt={(itemIdx, isCorrect) => void} onAllCorrect={() => void} initialState={state?} onStateChange={(state) => void} />
//   Self-contained — owns its own interaction state, remounts fresh when the
//   caller changes its `key` (e.g. navigating to a different question).
//   Calls onItemFirstAttempt once per gradable item's first attempt, and
//   onAllCorrect once every item in the question is correct. The caller
//   builds its own grading keys/points from those two callbacks; nothing
//   type-specific leaks out.
//   `initialState`/`onStateChange` are optional and only used by Practice
//   Cards to resume an interrupted session: `initialState`, when given,
//   hydrates the Renderer's own internal state instead of starting blank
//   (and fires onAllCorrect() once on mount if that restores an
//   already-fully-correct question), and `onStateChange` is called with a
//   plain, type-owned snapshot of that same internal state on every change,
//   for the caller to persist. A caller that doesn't care about resuming
//   (Curiosidad) simply never passes them.
//
// Editor contract: <Editor question={q} onChange={(patch) => void} instanceId={...} showCategory={...} />
//   Renders the admin authoring UI for one question; calls onChange with a
//   partial update to merge in. `instanceId` must be unique per rendered
//   question (scopes radio-group names). `showCategory` is only read by
//   multiple_choice, for Jeopardy-mode category tagging.
//
// finalizeQuestion(q): converts raw, freely-typed editing fields (e.g. a
//   textarea's raw text) into the final persisted shape at save time.
// reconstructQuestion(q): the inverse, run once when loading an
//   already-saved question back into the editor.

import * as matching from './matching';
import * as imageSelect from './imageSelect';
import * as dropdownCloze from './dropdownCloze';
import * as wordBankCloze from './wordBankCloze';
import * as lineBankCloze from './lineBankCloze';
import * as multipleChoice from './multipleChoice';
import * as write from './write';
import * as listen from './listen';

export const QUESTION_TYPES = {
  [matching.TYPE_KEY]: matching,
  [imageSelect.TYPE_KEY]: imageSelect,
  [dropdownCloze.TYPE_KEY]: dropdownCloze,
  [wordBankCloze.TYPE_KEY]: wordBankCloze,
  [lineBankCloze.TYPE_KEY]: lineBankCloze,
  [multipleChoice.TYPE_KEY]: multipleChoice,
  [write.TYPE_KEY]: write,
  [listen.TYPE_KEY]: listen,
};

export const TYPE_LABELS = Object.fromEntries(
  Object.entries(QUESTION_TYPES).map(([key, mod]) => [key, mod.TYPE_LABEL])
);

export const getItemCount = (q) => QUESTION_TYPES[q.type]?.getItemCount(q) ?? 1;
export const finalizeQuestion = (q) => QUESTION_TYPES[q.type]?.finalizeQuestion(q) ?? q;
export const reconstructQuestion = (q) => QUESTION_TYPES[q.type]?.reconstructQuestion(q) ?? q;

export { parseBulkRow, parseBulkRowPlain } from './multipleChoice';
export { parseBulkSections } from './lineBankCloze';
export { shuffle } from './clozeShared';
