// A pluggable catalog of grammar-note content block types, mirroring the
// shared question-type registry's pattern (src/shared/questionTypes/index.js)
// — any consumer picks a block's behavior purely by its `type` string.
// Every block type's raw shape === stored shape (no finalize step), so a
// standalone importer can write them directly.
//
// Contract per block module: { TYPE_KEY, TYPE_LABEL, emptyBlock, Renderer, Editor }
//
// Renderer({ block, showEnglish, existingIds }): read-only student-facing
//   display. `showEnglish` is the page-level EN toggle (rule/example use
//   it); `existingIds` is a Set of every grammar_pages doc id, used only by
//   the `link` type to render a forward reference safely.
//
// Editor({ block, onChange, instanceId }): admin authoring UI for one
//   block; calls onChange with a partial update to merge in. `instanceId`
//   is passed through to `question` blocks' nested type Editor (radio-group
//   scoping), same as the question registry's own contract.

import * as rule from './rule';
import * as example from './example';
import * as aside from './aside';
import * as link from './link';
import * as media from './media';
import * as question from './question';
import * as comparison from './comparison';
import * as drill from './drill';

export const BLOCK_TYPES = {
  [rule.TYPE_KEY]: rule,
  [example.TYPE_KEY]: example,
  [aside.TYPE_KEY]: aside,
  [link.TYPE_KEY]: link,
  [media.TYPE_KEY]: media,
  [question.TYPE_KEY]: question,
  [comparison.TYPE_KEY]: comparison,
  [drill.TYPE_KEY]: drill,
};

export const BLOCK_LABELS = Object.fromEntries(Object.entries(BLOCK_TYPES).map(([key, mod]) => [key, mod.TYPE_LABEL]));
