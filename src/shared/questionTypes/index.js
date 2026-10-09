// A neutral, pluggable catalog of question types — any consumer (currently
// Curiosidades and Practice Cards) picks a question's behavior purely
// by its `type` string, never by importing a type's internals directly.
// Each entry: { Renderer, Editor, getItemCount, emptyQuestion, finalizeQuestion, reconstructQuestion, gradeState, TYPE_LABEL }.
//
// Renderer contract — two modes, selected by the `mode` prop:
//
//   mode: 'retry' (default, Curiosidad's only mode):
//     <Renderer question={q} onItemFirstAttempt={(itemIdx, isCorrect) => void} onAllCorrect={() => void} initialState={state?} onStateChange={(state) => void} />
//     Self-contained — owns its own interaction state, remounts fresh when
//     the caller changes its `key` (e.g. navigating to a different
//     question). Grades as the student goes (instantly, or via the type's
//     own Revisar/Comprobar step) and locks an item once it's correct.
//     Calls onItemFirstAttempt once per gradable item's first attempt, and
//     onAllCorrect once every item in the question is correct — the caller
//     builds its own grading keys/points from those two callbacks; nothing
//     type-specific leaks out. `initialState`/`onStateChange` are optional,
//     only used by Practice Cards' own 'retry'-era resume support: when
//     given, `initialState` hydrates the Renderer's internal state instead
//     of starting blank (firing onAllCorrect() once on mount if that
//     restores an already-fully-correct question), and `onStateChange`
//     reports a plain, type-owned snapshot of that state on every change,
//     for the caller to persist. A caller that doesn't care (Curiosidad)
//     simply never passes them.
//
//   mode: 'deferred' (Practice Cards, whole-card submit-at-the-end):
//     <Renderer mode="deferred" question={q} submitted={bool} initialState={state?} onStateChange={(state) => void} />
//     No grading feedback, no locking, while `submitted` is false — the
//     student can freely answer every question before grading happens at
//     all. Once `submitted` is true, every item's current answer is colored
//     live (green/red) via that type's own `gradeState`, recomputed on
//     every edit — so fixing a wrong answer re-colors it immediately,
//     with no extra step. Nothing is ever locked: an already-correct item
//     stays editable, since the student may resubmit (Enviar) many times
//     for a better score. Doesn't call onItemFirstAttempt/onAllCorrect at
//     all — the caller grades the whole card itself, from every question's
//     latest onStateChange snapshot, via gradeState (below), whenever the
//     student clicks its own single Enviar control.
//
// gradeState(question, state): pure, given one question and a state
//   snapshot in that type's own shape (the same shape onStateChange
//   reports), returns a per-item boolean[] of correctness — the single
//   source of truth deferred mode's own live coloring AND the caller's
//   whole-card grading both read from, so there's exactly one place each
//   type's "what counts as correct" logic lives.
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
