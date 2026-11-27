# Sitio de Español — Project Notes

Scott Scalici's classroom site for two Spanish courses: **s2** (Spanish II)
and **s4** (Spanish 4 / IB). Students belong to a section (`1B`, `4A`,
`4B`) which implies both a course and a cycle (`A`/`B`). React 19 + Vite +
Firebase (Firestore) + Tailwind v4 + react-router-dom v7. No TypeScript.

This file is for facts that would otherwise have to be rediscovered every
session — architecture, gotchas, and decisions already made on purpose.
It is not a changelog; keep it to things that actually bite again, and
prune/update entries once they're stale rather than letting them pile up.

## Branch & preview workflow

- `claude/theme-system-v2` is the single active branch carrying everything
  — Scott previews from here, not from per-feature branches or GitHub PR
  previews. He's explicitly said he wants one preview location, not several,
  so don't create a separate feature branch for a change unless asked.
- Push there when done; don't open a PR unless explicitly asked.

## Before every commit

1. `git stash` → `npx eslint <changed files>` → compare against the same
   lint run with the stash applied. The codebase has pre-existing lint
   errors (stale ones, not yours to fix in passing) — the stash-diff is
   how you confirm you introduced zero *new* ones rather than chasing an
   unrelated baseline.
2. `npx vite build` — must come back clean.
3. Only then commit + push.

## Landmine: no error boundary anywhere in the app

There is no React error boundary at any level. An uncaught exception
during render doesn't show an error — it blanks the entire page (React's
root unmounts). This is a **recurring root cause of "it's just a blank
screen" reports**. The usual trigger: an admin editor reads a Firestore
field assuming it's always an array/string (`.join`, `.includes`,
`.match`, `.replace`) when an older or hand-entered doc actually stored it
as a bare number, a comma-separated string, or an unexpected type.

When debugging a blank-screen report: suspect a type mismatch on a
directly-rendered field before suspecting routing/auth/data-existence.
When writing a new admin editor that reads Firestore docs directly,
normalize array-shaped fields on load (see `MusicaEditor.jsx`'s `toArray`
helper) rather than assuming the data was always saved in the current
expected shape.

## Shared systems

- **Question-type engine** (`src/shared/questionTypes/`): a pluggable
  catalog — `matching`, `imageSelect`, `dropdownCloze`, `wordBankCloze`,
  `lineBankCloze`, `textCloze`, `multipleChoice`, `write`, `listen`,
  `ordering`, `hotspot`, `trueFalse`, `openEnded`. Every consumer
  (Curiosidades, Practice Cards, Música's comprehension questions, etc.)
  dispatches purely on `question.type`, never imports a type's internals
  directly. Each module exports `{Renderer, Editor, getItemCount,
  emptyQuestion, finalizeQuestion, reconstructQuestion, gradeState,
  TYPE_LABEL}`. `Renderer` has two modes: `'retry'` (grades as you go,
  locks on correct) and `'deferred'` (whole-card submit-at-the-end, no
  locking). Full contract is documented at the top of
  `src/shared/questionTypes/index.js`.
- **Lesson plan section order**: single source of truth is
  `src/utils/lessonPlanSections.js` (`SECTION_DEFS`), shared by
  `LessonPlanPage.jsx` (daily view) and `LessonPlanFormalPage.jsx` (print
  view). Don't hardcode section ordering independently in either page —
  edit `SECTION_DEFS` and both pick it up.
- **Destacado del Día body text**: the real field is
  `d.content?.spanish || d.body_es`. `d.spanish` does not exist on real
  docs — looks plausible, silently renders nothing.
- **Admin Hub links** (`src/admin/MasterDashboard/components/adminLinks.js`):
  `ADMIN_SECTIONS` (the grid) and `DEFAULT_FAVORITES` (starred shortcuts).
  **Editing `DEFAULT_FAVORITES` in code never changes what an existing
  user already sees** — favorites are overridden per-browser by
  `localStorage['adminHubFavorites']` the first time a user visits. A code
  change only affects someone with no saved localStorage yet. Tell Scott
  he needs to re-star manually after a favorites change.
- **Pod/segment generation** (`src/utils/podGenerator.js`): vocab
  word-introduction segments are sized `Math.round(wordCount / 5)` (not
  `/4` — changed deliberately). `generateSectionPods` returns
  `[introPod, bossPod]`. Sentence-to-word pinning
  (`distributeSentencesToSegments`) is a **two-pass match**: exact
  whole-phrase match across every concept first, fuzzy substring fallback
  second. Don't collapse this to a single pass — a short word (e.g.
  "idioma") can lose its own exact-matching sentence to a longer phrase
  that merely contains it ("idioma oficial") if fuzzy matching runs before
  every word has had a shot at an exact match.
- **Vocab Vault bulk import** (`src/admin/MasterDashboard/components/VocabVault.jsx`,
  route `/admin-secret-portal-vocabvault`): the Importer tab takes a
  **pasted JSON array**, not pipe-delimited lines like Sentence Manager.
  One object per word:
  ```json
  {
    "palabra": "brindar", "traduccion": "to toast (drink)",
    "definiciones": { "nivel1": [...], "nivel2": [...], "nivel3": [...] },
    "usage_tags": ["tema:celebraciones"],
    "alt_answers": [],
    "metadata": { "textbook": "Descubre 1", "secciones": ["9.1"],
      "tipo": "verbo", "evaluacion": true, "ib_tags": [...] }
  }
  ```
  `secciones` is an array of `"<chapter>.<subsection>"` strings (e.g.
  `"9.1"`); `"<chapter>.referencias"` marks a non-quizzed reference
  section. Omit `id`/`lastUpdated` (auto-generated). **No validation on
  bulk import** — a missing `palabra`/`textbook` still silently writes a
  malformed-id doc, and re-pasting an existing `textbook`+`palabra` pair
  **silently overwrites it** (`setDoc`, no existence check — unlike the
  single-word editor, which asks to confirm). The legacy
  `/admin-secret-portal-vocab` "Vocab Uploader" writes the same
  `vocabulary` collection but expects an entirely different
  nested-by-section wrapper shape and is stale/unmaintained — always use
  Vocab Vault, not that one.
- **Vocab Vault → Learning Path requires a manual sync step**: Learning
  Path's vocab lookup reads the *published* `vocab_bundles` collection,
  not `vocabulary` live — after bulk-importing new words, click Vocab
  Vault's "🚀 Sync Chapter Bundles" button (`publishChapters`) or the new
  words won't show up in the Pod Builder/Generator at all.
- **Textbook name must match exactly, not just whitespace-tolerantly**:
  canonical names live in `src/utils/textbookAccess.js`'s
  `TEXTBOOK_ORDER` (`['Descubre 1', 'Descubre 2', 'Descubre 3',
  'Reporteros 4']`). Only a few call sites (`podGenerator.js`'s
  `sentenceTaggedForSection`, `textbookAccess.js`'s own helpers) are
  whitespace/case-tolerant — `FormLearningPath.jsx`'s book dropdown,
  Baking Station's bake logic, and `publishChapters`'s bundle grouping
  all do **exact or only-trim string matching**. Typing a new spelling of
  an existing book (e.g. "Reporteros4" instead of "Reporteros 4") creates
  an invisible second "book" in several of those places — always copy the
  existing name from `TEXTBOOK_ORDER` or Vocab Vault's own Library tab
  dropdown, never retype it from memory. **A rename also breaks every
  `vocab_bundles` doc id already built from the old spelling**:
  `publishChapters`'s doc id is `${book.replace(/\s+/g,'_').toLowerCase()}_ch${chap}`,
  so a retag changes the id on the next Sync, orphaning the old one (fixed
  to rewrite-then-prune so a failed/slow sync never leaves the collection
  empty — see `VocabVault.jsx`'s `publishChapters`) AND leaving any day
  already scheduled in `curriculum_tracks/vocab_master` (via Vocab
  Sequencer) pointing at the now-dead old id — nothing re-syncs that
  independently. `VocabSequencer.jsx`'s "🔧 Reparar IDs Obsoletos" button
  fixes it by matching old→new ids with underscores stripped (so a rename
  that only changed spacing still resolves) and re-saving those days.
- **Learning Path / Practice Circle content types** (`contentType`:
  `vocab`/`grammar`/`verb`, set at the path level): segment shape is
  identical across all three (`id, total_questions, questionMix,
  isSpeedRound, timeLimit, targetTense, introduced_concepts,
  pinned_sentences, reviewMode, masteryThreshold, speakingOnly` —
  `FormLearningPath.jsx`'s `makeDefaultSegment`/`sanitizeSegment`); only
  what goes *into* `introduced_concepts` differs. `grammar` segments
  always have `introduced_concepts: []` and drive everything off
  `pinned_sentences` (self-contained snapshot sentences with `[[blank]]`
  markup, never live-linked to `sentence_bank`). `vocab` segments'
  `introduced_concepts` carry `{id, label, tags, fullData:{palabra,
  traduccion, metadata,...}}`. `verb` segments carry `{id, label, tags,
  tenses:[...], isGroup, verbIds?, fullData}` where `id` **must match a
  real doc id in the `verbs` collection** — at runtime `WorkoutEngine.jsx`
  re-fetches that verb live from Firestore and uses *its* `tenses` data;
  whatever `fullData` you hand-author is only a fallback. If the targeted
  tense/subject cell is empty on the live doc, that verb silently
  contributes zero questions — no error shown. **`vocab` concepts do the
  same live re-fetch** (`WorkoutEngine.jsx:313-315`,
  `getCachedDoc('vocabulary', c.id)`) — editing a word's `palabra`,
  `traduccion`, or `metadata` (e.g. a textbook-name retag) after a path is
  already built and assigned is safe and transparent to students, as long
  as the word's doc id doesn't change; the pod never replays a frozen
  snapshot. (`grammar`'s `pinned_sentences` are the one real exception —
  those are genuinely frozen snapshots, never live-linked.) `targetTense` (verb-only,
  single value, not a list — e.g. `imperativo_afirmativo`,
  `imperativo_negativo`, `presente`, `ALL`) picks which tense a `verb`
  segment draws from; there's no way to mix two tenses in one segment, so
  "affirmative + negative commands mixed" needs two segments in one pod.
  `questionMix.recall` is the typed-answer "conjugate" count (same feel
  as Calentamiento, but graded by `checkAnswerLeniently` in
  `src/utils/checkAnswer.js` — accent-insensitive, unlike Calentamiento's
  strict `handleCheckVerbs`); `questionMix.sentence` is the oraciones
  count instead — don't conflate the two when a request is "type the
  answer" (`recall`) vs. "sentence" (`sentence`). **`questionMix.recall`
  is dead weight on a `grammar` segment specifically** — `introduced_concepts`
  is always `[]` there, so `WorkoutEngine.jsx`'s `isGrammarTurn` check
  (`concepts.length === 0`) is always true and every draw becomes a
  grammar turn regardless of what the mix asked for; only
  `questionMix.sentence`/`total_questions` actually matter. A
  `pinned_sentences` entry's markup also picks a genuinely different
  question mechanic, not just cosmetic: `[[respuesta]]` (single blank)
  is a 50/50 coin-flip between click-an-option MC and
  drag-the-word-tiles reconstruction — the student never types anything
  either way. `[[forma|infinitivo]]` (verb blank) is a **build-then-type
  hybrid** instead — arrange word tiles (including the bare infinitive
  as one tile) into the sentence, THEN type the actual conjugated answer
  as free text, graded leniently. Reach for `[[forma|infinitivo]]`
  whenever the point is drilling a specific conjugation (as every
  subjuntivo/mandatos/por-para sentence pod does), not `[[respuesta]]`.
- **Informal (tú) commands in verb data**: `imperativo_afirmativo` /
  `imperativo_negativo` are real tense slots on a verb doc
  (`src/utils/verbTenses.js`), each a per-subject map including `tú`, and
  `VerbEditor.jsx` already has editable cells for them — but **there's no
  auto-deriver for the informal ones** (only formal usted/ustedes, via
  `VerbAudit.jsx`'s `deriveFormalCommands`, and only on manual run). If a
  verb's `tú` command cells look empty, they were never hand-entered —
  that's expected, not a bug.
- **Binary-contrast grammar pods** (por/para, ser/estar, etc.): mix both
  sides of the contrast into *every* segment's `pinned_sentences` pool,
  never "all-por in pod 1, all-para in pod 2" — a segment that's 100% one
  answer lets a student ace it by picking the same option every time
  without discriminating anything. Learned the hard way building the
  por/para Learning Path; fixed by pairing each rule with its natural
  contrast (movement-por ↔ destination-para, duration-por ↔ deadline-para,
  etc.) within the same segment.
- **A `grammar` segment's `pinned_sentences` pool can and often should be
  bigger than its `total_questions`, but know what that actually buys
  you**: `WorkoutEngine.jsx` draws each question independently at
  random from the pool every single attempt — there's no `vocab`-style
  `fullCoverage` guarantee here (that only kicks in for vocab/verb
  concepts when `total_questions === concepts.length`), and no "show
  unseen ones first" or "don't repeat a passed one" memory across
  attempts. A pool of 18 with `total_questions: 10` just lowers the odds
  of seeing an identical set twice in a row — it's probabilistic
  variety, not deterministic rotation. Separately, "spiral review" in
  this engine means `sentenceHistory`/`reviewMode` pulling sentences in
  from **earlier pods already completed in the same path**
  (`StudentLearningPath.jsx`, right where it builds `sentenceHistory` by
  walking every prior segment) — it has nothing to do with the leftover,
  unused sentences in a segment's own pool. Built the subjuntivo-de-cláusulas-sustantivas
  path on this basis: several segments in the same pod (e.g. 3 segments
  of "Emoción") deliberately share the exact same pinned_sentences pool
  verbatim rather than each needing fresh content — repeated exposure
  with variation, no extra authoring.
- **Practice Circle generator** (`src/admin/FormLearningPath/CircleGeneratorModal.jsx`)
  writes straight to Firestore (pod + its `reassessment_configs` doc,
  atomically) — unlike `VocabPodGeneratorModal.jsx`, which only returns
  pods for the surrounding form to save later. Auto-generates a Path ID
  (`${course}_${slugifyTextbook}_cap${chapter}`) when none is set yet.
- **Evaluación día resolution** (`src/utils/evaluaciones.js`,
  `resolveCurrentEvalDia`): plain exact-label-string match against a live,
  *never cached* list from `fetchEvaluacionOptions(course)`. If a día
  looks wrong or duplicated somewhere, it is almost always a data-entry
  mistake (a practice circle linked to the wrong quiz) — check the actual
  `evalLink` on the pod before assuming a caching or matching bug.
- **Reassessment Config verb-group subject targeting**
  (`src/admin/MasterDashboard/components/ReassessmentConfigManager.jsx`,
  `src/utils/verbQuestionGenerator.js`'s `getRandomSubject`): each verb
  group row has a `targetSubject` ('any' or one grammatical person —
  `tú`, `nosotros`, `él_ella_ud`, `ellos_ellas_uds`, `vosotros`, `yo`),
  now exposed as a dropdown next to the tense selector — added because a
  tense like `imperativo_afirmativo` has both `tú` and `nosotros`/formal
  forms populated per verb, and "any" draws from all of them.
  **`WorkoutEngine.jsx`'s Learning Path/Circle verb segments got the same
  capability right after**: `segment.targetSubject` ('any' or one
  person), a matching dropdown in `PathBuilder.jsx` next to Verb Tense,
  and the actual filter in the subject-draw step
  (`WorkoutEngine.jsx`, right where `availableSubjects` is computed) — a
  verb missing the requested subject for that tense just contributes no
  question for that pick, same silent-skip as an empty tense. Two
  independent implementations of the same idea (reassessment's
  `getRandomSubject` vs. Learning Path's inline filter) — if this drifts
  or needs a third subject-aware spot, keep both in sync by hand, there's
  no shared helper between them yet. That third spot already bit once:
  `ReassessmentEngine.jsx`'s `handleStart` rebuilds its own blocks from
  the saved config and had `targetSubject` hardcoded to `'any'` instead
  of reading `r.targetSubject` — so a teacher's "restrict to tú" choice
  saved correctly and even showed right in the admin's own Preview, but
  silently never applied to the actual student-facing reevaluación.
  Fixed, but a reminder this config is read from more than one place.
- **Learning Path archiving is gated behind a per-tarea opt-in flag,
  not automatic**: `src/utils/learningPathProgress.js`'s
  `isPastEffectiveDueDate(task, ...)` checks `task.enforceDueDate` FIRST
  and returns `false` immediately if it's missing/falsy — the due date
  (`task.day_due`, resolved through the academic calendar) is never even
  looked at. `task` here is a Dominio entry in
  `curriculum_tracks/tareas_master.s2`/`.s4` (edited in
  `TareasSequencer.jsx`), a different doc from `learning_paths` entirely
  — `learning_paths`/`path_id`/pods play no role in archiving at all.
  `TareasSequencer.jsx`'s `handleCreateTask` only sets
  `enforceDueDate: true` on tasks created after that feature shipped;
  older tareas were never migrated, so they silently never archive no
  matter how overdue. A "🔄 Migrar Tareas Antiguas" button now exists in
  Tareas Sequencer to backfill the flag (+ a default
  `latePenaltyPerDay: 10`) onto any Dominio tarea missing it, staged in
  local state same as every other edit there — still needs "Guardar
  Cambios" after. **This flag also gates late-grading penalties**
  (`TeacherGradebook.jsx`, `StudentLearningPath.jsx`), not just
  archiving — turning it on for an already-overdue tarea can
  retroactively start penalizing it, worth a gradebook glance after a
  migration. The "📦 Rutas Archivadas" dashboard card only shows paths
  overdue **30 days or less** (`isArchivedAndVisible` in
  `learningPathProgress.js`, the single source of truth also used by
  `Dashboard.jsx`'s check for whether to render that card's header at
  all) — a path beyond that is still graded correctly and still
  reachable by its direct link, it just drops off the dashboard so the
  list doesn't grow forever.
- **A `learning_paths`/`practice_pods` doc's own `course` field is
  informational, never an access filter — assigning across courses is
  supported by design, not a loophole.** `TareasSequencer.jsx`'s Dominio
  path-picker explicitly groups the dropdown into "Esta clase" and "Otra
  clase" optgroups (with a code comment calling out "assigning S2
  content as an S4 tarea on purpose") and only shows a non-blocking
  warning when you pick a cross-course one. `StudentLearningPath.jsx`
  fetches a path by `path_id` alone with no comparison to the student's
  own course at all — once a `path_id` is in a student's assigned list,
  the path's own `course` tag plays no role in whether it loads. Safe to
  build one shared path (no course suffix in the title) and assign it to
  tareas in both s2 and s4 sections, same as the subjuntivo-de-cláusulas-sustantivas
  path.
- **Theme floating-particle species** (`src/components/ThemeParticles.jsx`,
  canvas-based): each species is `{ char, color, direction, speed, count,
  sizeRange }` for an emoji, or `{ url, direction, speed, count,
  sizeRange }` to float an uploaded image instead — `url` wins if both
  are set. `direction` is `'down'` (default), `'up'`, `'left'`, or
  `'right'` — whichever pair ISN'T a species' main axis gets the small
  per-particle wobble on the other axis (up/down wobble horizontally,
  left/right wobble vertically). A single-species fallback lives at `effectConfig` on the tema
  doc (editable via plain admin controls, including an image-upload
  field, in `FormTemas.jsx`'s "Efecto de Partículas"); multiple species
  at once is `styles.animatedLayer.particles` (an array of the same
  shape), JSON-paste-box only, no dedicated UI. An image species skips
  drawing for a frame rather than falling back to the emoji while it's
  still loading — never a flash-then-swap. Size normally adds to speed
  (`speed + size/20`, a cheap depth cue) — this puts a floor under how
  slow a large particle can ever look, since a low `speed` barely
  registers next to the size term. `fixedSpeed: true` on a species opts
  it out of that boost so `speed` is taken literally; exposed in
  `FormTemas.jsx` as the "Velocidad exacta (ignora tamaño)" checkbox next
  to Velocidad (its number input is `step="any"`, not `"0.1"`, so it
  actually accepts sub-0.1 values like 0.001), and settable per-species
  in the JSON paste-box too. The per-particle cross-axis wobble is
  scaled to `min(speed, 1)` for the same reason — it's a fixed ±1/tick
  accent meant to be small next to the main-axis speed, which used to
  always be true thanks to the old size floor; at a `fixedSpeed` value
  well below 1, an unscaled wobble would swamp the set direction
  entirely (a "left" species visibly just drifting up/down with no real
  leftward motion).
- **Calentamiento grading** (`src/student/CalentamientoEngine.jsx`,
  `handleCheckVerbs`): plain `.trim().toLowerCase()` string match against
  `forma`, with `/|;,` as alternate-answer separators. No cross-validation
  against Verb Vault — whoever authors the JSON is fully responsible for
  `forma` being correct. Negative tú commands pre-fill "No " into the
  input (locked against edit/delete) — `forma` for those must itself start
  with `"no "` (e.g. `"no lo toques"`) since the full typed string is what
  gets compared.

## Scope decisions made on purpose (don't "fix" these without asking)

- **Preferred name** (`src/utils/studentDisplay.js`, `getDisplayName`) is
  wired into the Seating Chart family ONLY (manager, print view, seat-pick
  prompt) — explicitly not the Gradebook, leaderboards, or Schoology
  export. If a future request wants it elsewhere, that's a new scope
  decision, not a bug.
- **Admin preview-as-student** (`Dashboard.jsx`, `PREVIEW_SECTIONS`) only
  offers `1B`, `4A`, `4B` even though Scott's roster has other sections —
  those three are the only ones that matter for previewing.

## Firestore collections (the ones that come up most)

Full field-level shapes, required vs. optional fields, and a real example
document per collection live in **"Firestore data shapes"** below — read
that before generating JSON to write via `scripts/firestore-write.js`. This
table stays as a quick index.

| Collection | Keyed by | Notes |
|---|---|---|
| `musica` | doc id (song) | `dias`/`course` *should* be arrays — see the blank-screen landmine above |
| `practice_pods` | path id | `pods[]`, each with `segments[]` |
| `learning_paths` | path id | graded "Dominio" pods |
| `reassessment_configs` | `${pathId}__${podId}` | gate + reassessment content config |
| `reassessment_attempts` | `${uid}__${circleId}` | includes `enteredInGradebook` flag |
| `curriculum_tracks/evaluaciones_master` | single doc | the Evaluaciones Sequencer |
| `users` | uid | `course`, `section`, `independent`, `preferredName` |
| `calentamientos` | doc id | verb warm-ups, see schema above |
| `sentence_bank` | doc id | grammar/vocab-in-context sentences, tagged for Learning Path distractor pools |
| `verbs` | bucketed (`items.<verbId>`) | conjugation tables; `tenses.<tense>.<subject>.{target,english}`; informal tú commands often empty (no auto-deriver, see above) |
| `verbGroups` | doc id | named verb groups (e.g. "ar stem-changers") a Learning Path `verb` segment can assign as a whole via `verbIds` |

## Firestore data shapes

This section documents the on-disk shape of every Firestore collection the
app actually reads/writes, as ground-truthed against the admin
uploader/manager that writes each one, cross-checked against the
student-facing engine that reads it. It exists so a script can validate
generated JSON against real shapes before writing to Firestore. Where a
collection is a singleton doc holding a nested map rather than one-doc-per-item,
that's called out explicitly.

**Bucketing schemes in play** (two different ones — don't conflate them):
1. **Hash-bucketed** (`src/utils/firestoreCache.js`'s `getBucketId`): used only by
   `verbs`. An item's bucket doc id is deterministic — `bucket_${hash(itemId) % 64}`
   — and the bucket doc holds `{ items: { [itemId]: {...data} } }`. A writer must
   write a real nested object (`{ items: { [id]: payload } }`), never a dot-string
   key (`{ [\`items.${id}\`]: payload }`) — under `setDoc(..., {merge:true})` a
   dotted top-level key is taken literally as one field name, not a path into
   `items` (that only happens with `updateDoc`). Read via
   `getCachedBucketedCollection`/`getCachedBucketedItem`.
2. **Single-bundle-doc** (`fetchBundledArray` pattern): used by `destacado_diario`,
   `curiosidades`, `image_cards`, `juego_senordle` — ALL items live in one doc with
   id `_bundle`, shaped `{ items: { [itemId]: {...data} } }`. No hashing, no
   64-way split — genuinely one document for the whole collection. Same
   dot-string-key footgun as above applies here too. All four of these
   collections carry a repair tool (`repairSplitBucketFields`) for exactly that
   mistake.

---

### Vocab & Verbs

### `vocabulary`
**Keyed by:** `${slugify(textbook)}_${slugify(palabra)}` (e.g. `descubre_1_brindar`) — built by `buildWordId` in `VocabVault.jsx`. Re-pasting the same textbook+palabra pair **silently overwrites** the existing doc (`setDoc`, no existence check), unlike the single-word editor which confirms first.
**Required fields:**
- `palabra` (string) — the Spanish word/phrase
- `traduccion` (string) — English translation
- `definiciones` (object) — `{ nivel1: string[], nivel2: string[], nivel3: string[] }`, each a list of alternate-phrasing definitions at that reading level
- `metadata` (object):
  - `textbook` (string) — must exactly match (or Vocab Vault/`textbookAccess.js`'s whitespace-tolerant helpers only) one of `TEXTBOOK_ORDER` in `src/utils/textbookAccess.js`: `'Descubre 1'`, `'Descubre 2'`, `'Descubre 3'`, `'Reporteros 4'`. Retyping a new spelling silently creates an invisible second "book" everywhere else that does exact/trim-only matching (`FormLearningPath.jsx` book dropdown, Baking Station, `publishChapters`).
  - `secciones` (string[]) — e.g. `["9.1"]`. **Array, not a string.** `"<chapter>.referencias"` marks a non-quizzed reference section (excluded from bakes/Learning Path).
  - `tipo` (string) — e.g. `"verbo"`, `"sustantivo"`
  - `evaluacion` (boolean) — `false` excludes the word from graded bakes; missing/undefined still bakes in (only an explicit `false` excludes).
**Optional fields:**
- `usage_tags` (string[]) — e.g. `["tema:celebraciones"]`
- `alt_answers` (string[]) — accepted synonym answers
- `metadata.ib_tags` (string[])
- `lastUpdated` (server timestamp) — auto-set on import
**Example:**
```json
{
  "palabra": "brindar",
  "traduccion": "to toast (drink)",
  "definiciones": {
    "nivel1": ["To toast. Raising a glass to say cheers.", "To toast. Queremos brindar por la felicidad de los novios."],
    "nivel2": ["Es la acción de levantar tu vaso de champán o vino para celebrar la salud y la alegría de otras personas."],
    "nivel3": ["Manifestar, al ir a beber, el bien que se desea a alguien o la satisfacción por algo."]
  },
  "usage_tags": ["tema:celebraciones", "tema:interacciones"],
  "alt_answers": [],
  "metadata": {
    "textbook": "Descubre 1",
    "secciones": ["9.1"],
    "tipo": "verbo",
    "evaluacion": true,
    "ib_tags": ["Organización social"]
  },
  "lastUpdated": "2026-09-14T13:02:11.000Z"
}
```
No validation on bulk import (`VocabVault.jsx`'s Importer tab) — a missing `palabra`/`textbook` still writes a malformed-id doc. Omit `id`/`lastUpdated` on import (auto-generated). The legacy `/admin-secret-portal-vocab` "Vocab Uploader" (`src/admin/uploaders/VocabUploader.jsx`) writes the same collection but expects an entirely different nested-by-section wrapper shape and is stale/unmaintained — never use it.

### `vocab_bundles`
**Keyed by:** `${book.replace(/\s+/g,'_').toLowerCase()}_ch${chapter}` (e.g. `reporteros_4_ch1`). Published (not hand-authored) by `VocabVault.jsx`'s "🚀 Sync Chapter Bundles" button (`publishChapters`), which compiles `vocabulary` into one read-optimized doc per textbook+chapter.
**Required fields (all auto-generated, never hand-written):**
- `textbook` (string), `chapter` (string), `wordCount` (number)
- `words` (array) — full snapshot of every matching `vocabulary` doc (including its `id`)
- `lastUpdated` (server timestamp)
**Example:**
```json
{
  "textbook": "Descubre 1",
  "chapter": "9",
  "wordCount": 2,
  "words": [
    { "id": "descubre_1_brindar", "palabra": "brindar", "traduccion": "to toast (drink)", "metadata": { "textbook": "Descubre 1", "secciones": ["9.1"] } }
  ],
  "lastUpdated": "2026-09-14T13:05:00.000Z"
}
```
**Learning Path's vocab lookup only reads this published collection, never `vocabulary` live** — bulk-importing new words with no Sync afterward means they never show up in the Pod Builder/Generator. A textbook rename changes this doc's id on the next Sync, orphaning the old one (mitigated by rewrite-then-prune) and can leave `curriculum_tracks/vocab_master` pointing at a dead id (fixed by VocabSequencer's "🔧 Reparar IDs Obsoletos").

### `vocabPaths`
**Keyed by:** `path_${Date.now()}` (admin-chosen on create).
**Required fields:**
- `name` (string)
- `steps` (array) — `{ textbook: string, section: string ('all'|'chapter_N'|a subsection id), id: number }`
- `lastUpdated` (server timestamp)
**Example:**
```json
{ "name": "New Class Cohort", "steps": [{ "textbook": "Descubre 1", "section": "chapter_9", "id": 1732650000000 }], "lastUpdated": "2026-09-14T13:10:00.000Z" }
```
Used only as a Vocab Vault "preset sequence" convenience for baking Calentamientos — not read by any student-facing engine.

### `dailyVocabWarmups`
**Keyed by:** auto-id (`addDoc`).
**Required fields:**
- `name` (string)
- `course` (string) — `'s2'`|`'s4'`
- `sequence` (array) — `{ vocabId, palabra, traduccion, textbook, secciones (comma-joined string) }` per word drawn
**Optional fields:**
- `dia` (number|null) — `null` = unscheduled "banco" item (never shown to students until a teacher assigns a día)
- `pathId` (string) — associated `vocabPaths` id
- `createdAt` / `lastUpdated` (server timestamp)
**Example:**
```json
{
  "dia": 12,
  "name": "Descubre 1 Cap. 9 — Repaso",
  "course": "s2",
  "pathId": "",
  "sequence": [{ "vocabId": "descubre_1_brindar", "palabra": "brindar", "traduccion": "to toast (drink)", "textbook": "Descubre 1", "secciones": "9.1" }],
  "createdAt": "2026-09-10T12:00:00.000Z",
  "lastUpdated": "2026-09-14T13:12:00.000Z"
}
```

### `verbs`
**Keyed by:** hash-bucketed (see top of section) — `bucket_${getBucketId(verbId) % 64}` holding `{ items: { [verbId]: {...} } }`. `verbId = slugify(infinitivo)`, e.g. `tener`. **Always write through the bucket** (`VerbEditor.jsx`'s save path never creates a standalone doc for a new verb).
**Required fields (per verb item):**
- `palabra` (string) — the infinitive, as typed
- `translations.infinitivo` (object) — `{ target: string, english: string }`
- `tenses` (object) — `{ [tenseId]: { [subjectId]: { target: string, english: string } } }`. `tenseId` must be one of `VERB_TENSES` in `src/utils/verbTenses.js` (19 ids: `presente`, `pretérito`, `imperfecto`, `futuro`, `condicional`, `pretérito_perfecto`, `pluscuamperfecto`, `futuro_perfecto`, `condicional_perfecto`, `presente_progresivo`, `imperfecto_progresivo`, `subjuntivo_presente`, `subjuntivo_imperfecto_ra`, `subjuntivo_imperfecto_se`, `subjuntivo_perfecto`, `pluscuamperfecto_subjuntivo_ra`, `pluscuamperfecto_subjuntivo_se`, `imperativo_afirmativo`, `imperativo_negativo` — plus `participio_pasado`, accepted ONLY by the Calentamiento bulk uploader, not a real conjugation paradigm). `subjectId` must be one of `VERB_SUBJECTS`: `yo`, `tú`, `él_ella_ud`, `nosotros`, `vosotros`, `ellos_ellas_uds`. A cell with a blank `target` is dropped entirely at save time rather than stored empty.
**Optional fields:**
- `tags` (string[]) — lowercased, deduped
- `lastUpdated` (ISO string)
**Example (one verb item, i.e. one entry inside a bucket doc's `items` map):**
```json
{
  "id": "tener",
  "palabra": "tener",
  "translations": { "infinitivo": { "target": "tener", "english": "to have" } },
  "tenses": {
    "presente": {
      "yo": { "target": "tengo", "english": "I have" },
      "tú": { "target": "tienes", "english": "you have" },
      "él_ella_ud": { "target": "tiene", "english": "he/she/you (formal) have" },
      "nosotros": { "target": "tenemos", "english": "we have" },
      "ellos_ellas_uds": { "target": "tienen", "english": "they/you all have" }
    },
    "imperativo_afirmativo": { "tú": { "target": "ten", "english": "have (command)" } }
  },
  "tags": ["irregular", "stem-change"],
  "lastUpdated": "2026-09-14T13:20:00.000Z"
}
```
Informal (tú) commands (`imperativo_afirmativo`/`imperativo_negativo`) have no auto-deriver — if empty, they were never hand-entered, not a bug (only formal usted/ustedes get auto-derived, via `VerbAudit.jsx`, on manual run).

### `verbGroups`
**Keyed by:** auto-id (`addDoc`) on create; same id reused on edit (`updateDoc`).
**Required fields:**
- `name` (string)
- `verbIds` (string[]) — **IMPORTANT GOTCHA:** populated from the verb's `palabra` string (`v.palabra`), not necessarily its real doc `id`. `WorkoutEngine.jsx` resolves each one via `getCachedBucketedItem('verbs', vid)`, which only works if `vid` equals the verb's actual bucketed doc id (`slugify(palabra)`). For a verb whose palabra is already id-shaped (a bare lowercase infinitive, which is the overwhelming majority) this is a no-op distinction; for any verb entered with accents/spaces/parens where `palabra !== slugify(palabra)`, a group referencing it silently resolves to nothing (empty `fullData`, zero questions drawn, no error surfaced anywhere) — when hand-authoring `verbIds`, always use the verb's real Verb Vault doc id, not its display spelling.
**Optional fields:**
- `hint` (string), `level` (string, e.g. `"Spanish II"`)
- `tenses` (string[]) — tense ids this group is tagged for (drives the admin's category groupings; not enforced against the verbs' own tense coverage)
**Example:**
```json
{ "name": "GER/GIR Present", "hint": "Present-tense g→j stem change before o/a", "level": "Spanish II", "verbIds": ["escoger", "proteger", "dirigir", "exigir"], "tenses": ["presente"] }
```

---

### Sentences

### `sentence_bank`
**Keyed by:** auto-id (`addDoc`), or hand-chosen on the single-sentence editor (`setDoc` with `merge:true`).
**Required fields:**
- `spanish` (string) — must contain exactly one of: `[[respuesta]]` (single blank), `[[forma|infinitivo]]` (verb blank — conjugated form, pipe, infinitive, no spaces around the inner pipe), two-or-more `[[a]]...[[b]]...` blanks, exactly two `{{palabra}}...{{palabra}}` markers (logical/illogical swap), or an `afirmación || ¿pregunta?` pair (question-formulation drill). A plain unmarked sentence is valid too (sentence-builder/dictation). Exactly one of cloze/swap/reverse markup (or none, for plain builder) — the editor refuses a sentence with none of the three AND no plain-sentence fallback intent.
**Optional fields:**
- `english` (string) — full translation
- `chapterId` (string)
- `grammarTags` (string[]) — organizational only, never limit distractor sourcing
- `distractorGroup` (string) — a narrower tag preferred for sourcing wrong-answer options
- `distractorExclude` (string[]) — exact answer strings that must never be offered as a distractor for this sentence (for near-synonyms a student could defend)
- `altAnswers` (string[]) — alternate full-sentence phrasings also accepted as correct
- `distractorMode` (string) — one of `'none'`, `'binary_verb'`, `'quad_verb'`, `'fixed_pool'` (see `src/utils/distractorConfig.js`)
- `pairTag` (string) — required if `distractorMode` is `binary_verb`/`quad_verb`; one of `PAIR_MAP`'s keys, e.g. `preterito_imperfecto`, `subjuntivo_presente_indicativo`, `subjuntivo_presente_futuro`, `pluscuamperfecto_subj_ra_indicativo`, `perfecto_subj_indicativo`
- `poolTag` (string) — required if `distractorMode` is `fixed_pool`
- `targetLemma` (string) — the verb's exact Verb Vault doc id (infinitive), required with binary/quad verb mode
- `targetTense` / `targetSubject` (string) — the tense/subject of the form already written inside the `[[...]]` blank
- `createdAt` / `lastUpdated` (server timestamp)
**Example:**
```json
{
  "spanish": "Nosotros [[teníamos|tener]] 15 años cuando pasó eso.",
  "english": "We were 15 years old when that happened.",
  "chapterId": "8",
  "grammarTags": ["Pretérito-Imperfecto"],
  "distractorGroup": "",
  "distractorExclude": [],
  "altAnswers": [],
  "distractorMode": "binary_verb",
  "pairTag": "preterito_imperfecto",
  "poolTag": "",
  "targetLemma": "tener",
  "targetTense": "imperfecto",
  "targetSubject": "nosotros",
  "createdAt": "2026-09-14T13:30:00.000Z",
  "lastUpdated": "2026-09-14T13:30:00.000Z"
}
```
Bulk-import format (Sentence Manager's paste box) is pipe-delimited, NOT this JSON shape — see the `sentence-structure-bulk` skill for that format.

### `sentence_sets`
**Keyed by:** `set-${crypto.randomUUID()}`. A completely separate, simpler feature from `sentence_bank` — plain sample sentences shown on the Lesson Plan page for a specific course+día, not consumed by the question-type engine.
**Required fields:**
- `lines` (string[]) — each a plain sentence with at most one `[[answer]]` blank (parsed by `src/utils/sentenceBlanks.js`'s `parseBlankSentence`; a line with no `[[...]]` just displays as-is with no blank)
- `assignments` (array) — `{ course: 's2'|'s4', dia: number }`, at least one
**Optional fields:**
- `title` (string)
- `createdAt` / `updatedAt` (ISO string)
**Example:**
```json
{
  "title": "Pretérito — oraciones de muestra",
  "lines": ["Ella [[tiene]] veinte años.", "Nosotros fuimos al cine ayer."],
  "assignments": [{ "course": "s2", "dia": 12 }, { "course": "s2", "dia": 13 }],
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-14T13:35:00.000Z"
}
```

---

### Learning Paths, Practice Pods & Reassessment

### `practice_pods` and `learning_paths`
**These two collections share the IDENTICAL document shape** — same save code (`FormLearningPath.jsx`'s `handleSavePathToFirestore`), the only difference being which collection name the UI targets (`practice_pods` for ungraded Practice Hub circles, `learning_paths` for graded "Dominio" paths).
**Keyed by:** `path_id` (admin-chosen slug, e.g. `s2_descubre_1_cap9`, or auto `${course}_${slugifyTextbook}_cap${chapter}` from the Circle Generator).
**Required fields:**
- `path_id` (string) — same as the doc id
- `title` (string)
- `course` (string) — `'s2'`|`'s4'` (informational tag only — **never an access filter**; assigning a path across courses is supported by design)
- `contentType` (string) — `'vocab'`|`'grammar'`|`'verb'`, set at the path level
- `total_pods` (number)
- `updated_at` (ISO string)
- `pods` (array) — see pod shape below
**Optional fields:**
- `textbook` / `chapter` (string) — only meaningful when `contentType === 'vocab'`
**Pod shape** (`pods[i]`):
- `id` (string), `title` (string), `isExpanded` (bool, UI-only), `isBonus` (bool)
- `badgeAward` (object|null) — `{ badgeId: string, tier: 'bronze'|'silver'|'gold'|null }` — `badgeId` references `config/gamification`'s `badges[].id`
- `evalLink` (object|null) — `{ dia: number, label: string }`, resolved from `curriculum_tracks/evaluaciones_master`
- `gateConfig` (object|null) — `{ questionCount: number, timeLimitSeconds: number, passThreshold: number }` (default `{50, 300, 90}`); meaningless without `evalLink`
- `segments` (array) — see segment shape below
**Segment shape** (`segments[i]`):
- `id` (string)
- `total_questions` (number)
- `questionMix` (object) — `{ recall, mc, matching, listen, speak, sentence }` (all numbers; default `{5,3,1,1,0,0}`). `recall` = typed-answer "conjugate"/write count (graded leniently via `checkAnswerLeniently`); `sentence` = oraciones count. **`questionMix.recall` is dead weight on a `grammar` segment** — grammar segments always have `introduced_concepts: []`, which makes `WorkoutEngine.jsx` treat every draw as a grammar turn regardless of the mix; only `sentence`/`total_questions` matter there.
- `isSpeedRound` (bool), `timeLimit` (number, seconds)
- `targetTense` (string) — verb segments only; one of `VERB_TENSES` ids or `'ALL'` — single value, not a list
- `targetTenses` (string[], optional) — verb segments only; checked FIRST, before `targetTense`. Lets a segment mix a FIXED SET of two+ specific tense ids (e.g. `['imperativo_afirmativo', 'imperativo_negativo']` for a combined affirmative+negative commands segment) instead of being locked to one tense or `'ALL'`. Purely additive — a segment that omits it falls through to the `targetTense`/`'ALL'` logic exactly as before. Built for the Nosotros/Vosotros commands content, where one segment is meant to draw from both command polarities at once.
- `targetSubject` (string) — one of `VERB_SUBJECTS` ids or `'any'`
- `introduced_concepts` (array) — shape depends on `contentType`:
  - `vocab`: `{ id, label, tags, fullData: { palabra, traduccion, metadata, ... } }` — `id` must be a real `vocabulary` doc id (live re-fetched every attempt, so editing the word later is safe/transparent)
  - `verb`: `{ id, label, tags, tenses: string[], isGroup?: bool, verbIds?: string[], fullData }` — `id` must be a real `verbs` doc id (live re-fetched); if `isGroup` + `verbIds` is set, each `verbIds` entry is independently re-fetched the same way (see the `verbGroups.verbIds` gotcha above)
  - `grammar`: always `[]` — grammar segments drive entirely off `pinned_sentences`
- `pinned_sentences` (array) — self-contained SNAPSHOT copies of `sentence_bank`-shaped sentences (never live-linked), used by `grammar` segments and vocab intro segments. `[[respuesta]]` (single blank) renders as a 50/50 coin-flip between MC and drag-tiles; `[[forma|infinitivo]]` renders as a build-then-type hybrid (arrange tiles including the bare infinitive, THEN type the conjugated form, graded leniently) — use the latter whenever the point is drilling a specific conjugation.
**Example:**
```json
{
  "path_id": "s2_descubre_1_cap9",
  "title": "Descubre 1 — Capítulo 9",
  "course": "s2",
  "contentType": "vocab",
  "textbook": "Descubre 1",
  "chapter": "9",
  "total_pods": 1,
  "updated_at": "2026-09-14T13:40:00.000Z",
  "pods": [
    {
      "id": "pod_1732650000000_a1b2c",
      "title": "Pod 1: Introducción",
      "isExpanded": true,
      "isBonus": false,
      "badgeAward": null,
      "evalLink": { "dia": 9, "label": "Vocabulario 9.1" },
      "gateConfig": null,
      "segments": [
        {
          "id": "seg_1732650000001_d3e4f",
          "total_questions": 10,
          "questionMix": { "recall": 5, "mc": 3, "matching": 1, "listen": 1, "speak": 0, "sentence": 0 },
          "isSpeedRound": false,
          "timeLimit": 60,
          "targetTense": "ALL",
          "targetSubject": "any",
          "introduced_concepts": [
            { "id": "descubre_1_brindar", "label": "brindar", "tags": "9.1", "fullData": { "palabra": "brindar", "traduccion": "to toast (drink)" } }
          ],
          "pinned_sentences": [
            { "spanish": "Queremos [[brindar]] por la felicidad de los novios.", "english": "We want to toast to the newlyweds' happiness." }
          ]
        }
      ]
    }
  ]
}
```

### `reassessment_configs`
**Keyed by:** `circleId` = `${path_id}__${pod.id}` (same id the recuperación gate uses).
**Required fields:**
- `circleId`, `course`, `evalLabel` (strings, copied from the circle at save time)
- `timeLimitSeconds` (number) — `Math.max(60, minutes*60)`
- At least one of `groups` / `sentenceBlocks` / `vocabBlocks` populated (all arrays, can be empty individually):
  - `groups[i]`: `{ groupId: string (a verbGroups id), tense: string, count: number, targetSubject: string ('any' or a VERB_SUBJECTS id) }`
  - `sentenceBlocks[i]`: `{ tag: string, count: number }` — draws from tagged `sentence_bank` `[[forma|infinitivo]]` entries
  - `vocabBlocks[i]`: `{ section: string, count: number }` — draws from `vocabulary.metadata.secciones`
- `updatedAt` (ISO string)
**Example:**
```json
{
  "circleId": "s2_descubre_1_cap9__pod_1732650000000_a1b2c",
  "course": "s2",
  "evalLabel": "Vocabulario 9.1",
  "groups": [{ "groupId": "abc123", "tense": "presente", "count": 3, "targetSubject": "any" }],
  "sentenceBlocks": [],
  "vocabBlocks": [{ "section": "9.1", "count": 5 }],
  "timeLimitSeconds": 900,
  "updatedAt": "2026-09-14T13:45:00.000Z"
}
```

### `reassessment_attempts`
**Keyed by:** `${uid}__${circleId}`. Written only through `src/utils/reassessmentData.js` helpers (never ad hoc) — treat those as the schema's single source of truth.
**Required fields (on a started attempt):**
- `uid`, `course`, `studentName`, `circleId`, `evalLabel` (strings)
- `status` (string) — `'in_progress'`|`'finished'`|`null` (cleared)
- `questions` (array) — the exact live-generated question set the student saw, saved verbatim so grading later never re-generates a different draw
- `answers` (object) — `{ [questionIndex]: string }`
- `score` (number|null) — 0-100
- `startedAt` / `expiresAt` / `finishedAt` (ISO string|null)
- `tabSwitchLog` (array) — `{ type: string, timestamp: ISO string }`, appended via `arrayUnion` on tab-blur/visibility-change during `in_progress`
**Optional fields:**
- `override` (object) — `{ openUntil: ISO string, grantedAt: ISO string }` — teacher's "🔓 Abrir Ahora" bypass
- `enteredInGradebook` (bool) / `enteredInGradebookAt` (ISO string|null) — pure checklist flag, never read by grading logic
- `history` (array) — archived prior attempts, each `{ status, score, finishedAt, questions, answers, tabSwitchLog }`, appended on a teacher-initiated retake
**Example:**
```json
{
  "uid": "abc123uid",
  "course": "s2",
  "studentName": "María G.",
  "circleId": "s2_descubre_1_cap9__pod_1732650000000_a1b2c",
  "evalLabel": "Vocabulario 9.1",
  "status": "finished",
  "questions": [{ "forma": "tengo", "subject": "yo", "infinitive": "tener" }],
  "answers": { "0": "tengo" },
  "score": 100,
  "startedAt": "2026-09-14T13:50:00.000Z",
  "expiresAt": "2026-09-14T14:05:00.000Z",
  "finishedAt": "2026-09-14T13:58:00.000Z",
  "tabSwitchLog": [],
  "enteredInGradebook": false,
  "enteredInGradebookAt": null
}
```
The site-wide lockout flag this writes alongside itself lives on `users/{uid}.activeReassessment = { circleId, expiresAt }`, not on this doc.

### `recuperaciones`
**Keyed by:** `${uid}__${circleId}`. Written only through `src/utils/recuperacionData.js` helpers. Never awards points and never advances any progress pointer — reflection text + a gate-attempt history only.
**Required fields:**
- `uid`, `course`, `studentName`, `circleId`, `evalLabel` (strings)
- `reflection` (object|null) — free-form Q&A answers plus `submittedAt` (ISO string)
- `attempts` (array) — `{ score: number, passed: bool, timestamp: ISO string }`
- `bestScore` (number), `passed` (bool), `passedAt` (ISO string|null)
- `updated_at` (ISO string)
**Optional fields:**
- `history` (array) — archived `{ reflection, attempts, bestScore, passed, passedAt }` snapshots from a prior full retake cycle
**Example:**
```json
{
  "uid": "abc123uid", "course": "s2", "studentName": "María G.",
  "circleId": "s2_descubre_1_cap9__pod_1732650000000_a1b2c", "evalLabel": "Vocabulario 9.1",
  "reflection": { "q1": "Me confundí con los verbos irregulares.", "submittedAt": "2026-09-13T10:00:00.000Z" },
  "attempts": [{ "score": 65, "passed": false, "timestamp": "2026-09-13T10:05:00.000Z" }, { "score": 92, "passed": true, "timestamp": "2026-09-13T10:20:00.000Z" }],
  "bestScore": 92, "passed": true, "passedAt": "2026-09-13T10:20:00.000Z",
  "updated_at": "2026-09-13T10:20:00.000Z"
}
```

---

### Warm-ups & standalone practice content

### `calentamientos`
**Keyed by:** admin-chosen id (`calId`), required on bulk import (never auto-generated).
**Required fields:**
- `id` (string, matches doc id), `title` (string), `course` (`'s2'`|`'s4'`)
- `bakedQuestions` (array, non-empty) — each: `{ palabra: string (infinitive), tense: string (a VERB_TENSES id or 'participio_pasado'), rawSubject: string (a VERB_SUBJECTS id), sujeto: string (display form, e.g. "él"/"Uds."), forma: string (correct conjugated answer — grading is plain `.trim().toLowerCase()` with `/|;,` as alternate-answer separators; a negative-tú-command `forma` must itself start with `"no "`), traducción: string }`
**Optional fields:**
- `dia` (number|null) — `null` = unassigned "banco" item
- `configBlocks` (array) — `{ label, tense, allowedVerbs: string[], count, specificVerb: 'any'|a verb id, targetSubject: 'any'|a VERB_SUBJECTS id }` — the generator config that produced `bakedQuestions`; a bulk-imported calentamiento has no `configBlocks` (no "redo draws a fresh set" behavior)
- `includeVosotros` (bool)
- `excused` (bool) — excluded entirely from the calentamiento average
- `createdAt` (ISO string)
**Example:**
```json
{
  "id": "cal_s2_dia12",
  "title": "Pretérito — Día 12",
  "dia": 12,
  "course": "s2",
  "configBlocks": [{ "label": "Pretérito regular", "tense": "pretérito", "allowedVerbs": ["hablar", "comer", "vivir"], "count": 5, "specificVerb": "any", "targetSubject": "any" }],
  "includeVosotros": false,
  "excused": false,
  "bakedQuestions": [
    { "palabra": "hablar", "tense": "pretérito", "rawSubject": "yo", "sujeto": "yo", "forma": "hablé", "traducción": "I spoke" }
  ],
  "createdAt": "2026-09-14T14:00:00.000Z"
}
```

### `practice_cards`
**Keyed by:** admin-chosen `id` (required, never auto-generated). A `course: "both"`/array expands to one doc per course, id suffixed `_s2`/`_s4`.
**Required fields:**
- `id`, `title` (string), `course` (`'s2'`|`'s4'`)
- `questions` (array, non-empty) — each run through `finalizeQuestion` (shared question-type engine, see `src/shared/questionTypes/index.js`); shape depends on `type` (`multiple_choice`, `matching`, `ordering`, `write`, `listen`, `dropdown_cloze`, `word_bank_cloze`, `line_bank_cloze`, `text_cloze`, `image_select`, `hotspot`, `true_false`, `open_ended`)
**Optional fields:**
- `dia` (number|null) — `null` = unassigned "banco" item
- `gradeWeight` (number, default 1), `excused` (bool)
- `topic` (string)
- `createdAt` (ISO string)
**Example:**
```json
{
  "id": "pc_preterito_1",
  "title": "Pretérito — Práctica 1",
  "course": "s2",
  "dia": null,
  "gradeWeight": 1,
  "excused": false,
  "topic": "Pretérito regular",
  "questions": [
    { "type": "multiple_choice", "prompt": "Yo ___ (hablar) con mi mamá ayer.", "options": ["hablé", "hablo", "hablaba"], "answer": "hablé" }
  ],
  "createdAt": "2026-09-14T14:05:00.000Z"
}
```
Bulk importer never overwrites an existing id (unlike `vocabulary`/`calentamientos`).

### `reading_cards`
**Keyed by:** admin-chosen `id` (required). Never overwrites an existing id.
**Required fields:**
- `id`, `title` (string), `course` (`'s2'`|`'s4'`)
- `passage.text` (string)
- `questions` (array, non-empty — same shared question-type engine as `practice_cards`)
**Optional fields:**
- `passage.images` (string[] — a reading can show several, unlike Curiosidades' single `img`), `passage.audio` (string)
- `dia` (number|null)
- `gradeWeight` (number, default 1), `excused` (bool)
- `createdAt` (ISO string)
**Example:**
```json
{
  "id": "rc_cultura_peru_1",
  "title": "Lectura: Machu Picchu",
  "course": "s4",
  "dia": 20,
  "passage": { "text": "Machu Picchu es una ciudadela inca...", "images": ["https://.../machu1.jpg"], "audio": "" },
  "questions": [{ "type": "true_false", "prompt": "Machu Picchu está en Bolivia.", "answer": "false" }],
  "gradeWeight": 1,
  "excused": false,
  "createdAt": "2026-09-14T14:10:00.000Z"
}
```

### `image_cards`
**Keyed by:** single bundle doc, id `_bundle`, shaped `{ items: { [itemId]: {...} } }`. Starts bundled — no legacy one-doc-per-item history to migrate.
**Required fields (per item):**
- `course` (`'s2'`|`'s4'`), `images` (string[], at least one non-empty URL — empty slots are filtered out on save)
**Optional fields:**
- `dia` (number|null), `caption` (string), `text` (string)
**Example (one item inside `items`):**
```json
{ "course": "s2", "dia": 15, "caption": "El mercado de Otavalo", "text": "Fotos del mercado indígena más grande de Ecuador.", "images": ["https://.../otavalo1.jpg", "https://.../otavalo2.jpg"] }
```
A lightweight "share a photo" card, distinct from Curiosidades (interactive questions) and Destacado (one themed highlight/day).

### `question_pool`
**Keyed by:** auto-id (`addDoc`). A reusable bank of atomic trivia facts, independent of any one curiosidad — written automatically whenever a `multiple_choice` question is created elsewhere (one entry per clue).
**Required fields:**
- `clue` (string), `answer` (string)
**Optional fields:**
- `distractors` (string[], default `[]`)
- `category` (string)
- `sourceCuriosidadId` (string) — a breadcrumb only; editing a pool entry never touches the original curiosidad
- `image` (string) — per-entry override
- `createdAt` (server timestamp)
**Example:**
```json
{ "clue": "¿Capital de Perú?", "answer": "Lima", "distractors": ["Cusco", "Arequipa", "Trujillo"], "category": "Geografía", "sourceCuriosidadId": "las-fallas-k3j9f2", "createdAt": "2026-09-14T14:15:00.000Z" }
```

### `question_pool_categories`
**Keyed by:** single doc, id `_defaults`.
**Shape:** flat map `{ [categoryName]: imageUrl }` — sets one default image per category (e.g. "Cultura" → one URL) that applies to every pool entry in that category unless overridden per-entry.
**Example:** `{ "Geografía": "https://.../geo-icon.png", "Cultura": "https://.../cultura-icon.png" }`

---

### Grammar, Curiosidades & Conversación

### `grammar_pages`
**Keyed by:** admin-chosen id, e.g. `"imperfecto:notas_generales"` (never auto-generated).
**Required fields:**
- `title` (string), `type` (`'subtopic'`|`'landing'`)
- if `type === 'subtopic'`: `blocks` (array, non-empty) — each a typed block: `rule` (`{text, image?}`), `example` (`{items: [{es, en?}]}`), `aside` (`{text?, items?}`), `link` (`{label, targetId|url}`), `media` (`{kind:'video'|'slides', url}`), `comparison` (`{columns: [{label, items[]}], 2+}`), `question` (`{question: <shared question-type object>}`), `digdeeper` (`{text}`), `drill` (`{contextColumns: string[], rows: [{context: string[] (len===contextColumns.length), answer}]}`)
- if `type === 'landing'`: `subtopics` (array, non-empty) — `{id, label?}`; `blocks` optional here too
**Optional fields:**
- `category` (string), `topic` (string)
**Example:**
```json
{
  "title": "El Imperfecto — Notas Generales",
  "category": "Gramática",
  "topic": "Tiempos pasados",
  "type": "subtopic",
  "blocks": [
    { "type": "rule", "text": "El imperfecto describe acciones habituales o en progreso en el pasado." },
    { "type": "example", "items": [{ "es": "Yo jugaba fútbol todos los días.", "en": "I used to play soccer every day." }] }
  ]
}
```

### `curiosidades`
**Keyed by:** single bundle doc, id `_bundle`, shaped `{ items: { [itemId]: {...} } }` (hash of title + timestamp generated by the uploader if no id supplied).
**Required fields (per item):**
- `title` (string)
**Optional fields:**
- `img` (string), `audio` (string)
- `student_note` (string), `teacher_notes` (string)
- `s2_dia` (number|null), `s4_dia` (number|null) — **per-course día fields, not a shared `dia`+`course` pair like other collections**
- `questions` (array — shared question-type engine, same `finalizeQuestion` pass as practice_cards)
- `minSeconds` (number), `gradeWeight` (number), `excused` (bool)
**Example (one item inside `items`):**
```json
{
  "title": "Las Fallas de Valencia",
  "img": "https://.../fallas.jpg",
  "audio": "",
  "student_note": "Festival de fuego en marzo.",
  "teacher_notes": "Conectar con el vocabulario de fiestas.",
  "s2_dia": null,
  "s4_dia": 30,
  "questions": [{ "type": "multiple_choice", "prompt": "¿En qué mes son las Fallas?", "options": ["Marzo", "Julio", "Diciembre"], "answer": "Marzo" }]
}
```

### `conversaciones`
**Keyed by:** auto-id.
**Required fields:**
- `titulo` (string)
- `courses` (string[] — `'s2'`/`'s4'`), `dias` (number[])
**Optional fields** (rich content, written by the paste-parser flow — `src/utils/conversacionPasteParser.js`):
- `subtitulo` (string, "tema"), `imagen` (string), `tag` (string)
- `escenario` (string)
- `instrucciones` (string[], fixed length 2)
- `modelo` (string), `extracto` (string)
- `preguntas` (object) — `{ "1": string[], "2": string[], "3": string[] }` (one array per difficulty level)
- `descripcion` (string), `relacion_tema` (string)
- `conexion_cultural` (string[]), `preguntas_interpretativas` (string[]), `preguntas_personales` (string[]), `conexion_personal` (string[]), `expansion_tema` (string[]), `banco_palabras` (string[]), `autoevaluacion` (string[])
- Legacy "oral_ia" variant (older MasterDashboard path) also used: `etiquetas`, `enlaces`, `prep_seconds` (number, default 600), `presentation_segments`, `notas: {type, bullets, pregunta}`, `activity_type: "oral_ia"`
- **"oral_ia" literary-passage (IO) fields** (added for the Marina/Como Agua Individual Oral migration, rendered by `ActivityPage.jsx`'s `ConversacionLayout`, parsed by `conversacionPasteParser.js`'s `pdf`/`traduccion del extracto`/`preguntas de apoyo` headers):
  - `pdf_url` (string) — link to the original literary-passage PDF (e.g. hosted on `raw.githubusercontent.com`); rendered as a "📄 Ver PDF Original" button under the `extracto`.
  - `extracto_traduccion` (string) — English translation/summary of `extracto`, teacher-only by default (gated by `visibilidad.extracto_traduccion`, same convention as every other teacher-only field). **Prefix with `"[Resumen, no traducción literal]"` when the source material only gives a paraphrase/summary, not a literal line-by-line translation** — don't let that distinction get silently lost.
  - `preguntas_apoyo` (array) — `{ pregunta: string, respuesta: string }` pairs, a FIXED list shown after the prep timer ends (distinct from the random-draw `preguntas` levels) — the paste-parser's `qa-pairs` type splits each line on the first `|` (pregunta before, respuesta after; respuesta optional). `respuesta` is teacher-only, gated by `visibilidad.preguntas_apoyo`.
**Example:**
```json
{
  "titulo": "Un día en Madrid",
  "subtitulo": "La vida urbana",
  "tag": "IB",
  "courses": ["s4"],
  "dias": [22],
  "escenario": "Estás describiendo tu rutina diaria en Madrid a un amigo.",
  "instrucciones": ["Describe tu rutina.", "Usa el presente y el pretérito."],
  "modelo": "Normalmente me levanto a las siete...",
  "preguntas": { "1": ["¿A qué hora te levantas?"], "2": ["¿Qué haces los fines de semana?"], "3": ["¿Cómo cambiaría tu rutina si vivieras en el campo?"] },
  "banco_palabras": ["madrugar", "trasnochar", "el metro"]
}
```

### `conversacion_notes`
**Keyed by:** `${uid}_${activityId}`. **Student-authored** (private per-student notes on a conversación activity), not admin content.
**Fields:** `uid`, `activityId` (strings), `bulletNotes` (string[], padded/truncated to the activity's configured bullet count), `blockNotes` (string), `tuPregunta` (string), `updatedAt` (ISO string).

---

### Daily content: Música, Video, Cultura, Destacado, Lecturas, Anuncios

### `musica`
**Keyed by:** auto-id, or admin-chosen on direct Firestore entry.
**Required fields:**
- `titulo` (string), `artista` (string)
**Optional fields:**
- `course` (string[] — e.g. `["s2","s4"]`; **older docs can store this as a bare string/number — always normalize with a `toArray` helper before `.includes`/`.join`, see the blank-screen landmine note below**)
- `dias` (number[] — same normalization caveat)
- `imagen` (string), `youtube_url` (string), `spotify_url` (string)
- `letras` (string) — lyrics
- `questions` (array — shared question-type engine)
- `notas` (string) — teacher-only, never shown to students
**Example:**
```json
{
  "titulo": "Color Esperanza",
  "artista": "Diego Torres",
  "course": ["s2", "s4"],
  "dias": [58, 59],
  "imagen": "https://.../color-esperanza.jpg",
  "youtube_url": "https://youtube.com/watch?v=...",
  "spotify_url": "",
  "letras": "Sé que hay en tus ojos solo cosas buenas...",
  "questions": [{ "type": "write", "prompt": "Completa: 'Sé que hay en tus ojos solo ___ buenas'", "answer": "cosas" }],
  "notas": "Buena para practicar el subjuntivo."
}
```
**Landmine:** the real body-text field used elsewhere in this codebase for similar "daily content" collections is `d.content?.spanish || d.body_es`, not a bare `d.spanish` (that field doesn't exist on real docs and silently renders nothing) — see `destacado_diario` below, which actually has this exact pattern; `musica` itself uses `letras`, not `content.spanish`. Don't conflate the two collections' field names.

### `videos`
**Keyed by:** admin-chosen id via the generic MasterDashboard save (`setDoc` merge).
**Required fields:** `title` (string), `video_url` (string)
**Optional fields:** `dia` (number|string), `tags` (string[]), `thumbnail_url` (string), `page_url` (string), `is_short` (bool), `description` (string), `internal_notes` (string)
**Example:**
```json
{ "title": "Short: El subjuntivo en 60 segundos", "dia": "", "tags": ["subjuntivo"], "video_url": "https://youtube.com/shorts/...", "thumbnail_url": "", "page_url": "", "is_short": true, "description": "", "internal_notes": "" }
```

### `audio_clips`
**Keyed by:** admin-chosen id via `AudioManager.jsx`'s grid (`writeBatch`/`batch.set(ref, data, {merge:true})` per row — same pattern as `videos`, new collection added alongside it as a sibling day-sequencer, not a rewrite of any existing tool).
**Required fields:** `title` (string), `audio_url` (string — via the existing-but-previously-unused `AudioUploadField`/`AudioPickerModal` shared components, `src/admin/shared/`)
**Optional fields:** `dia` (number|null), `tags` (string[] — course scoping, `'s2'`/`'s4'`/etc., identical convention to `videos.tags`), `description` (string), `thumbnail_url` (string, via `ImageUploadField`), `questions` (array — shared question-type engine, same optional pattern as `musica.questions`, managed via its own `AudioQuestionsModal.jsx`, default `[]`)
**Example:**
```json
{ "title": "Entrevista: un día típico", "audio_url": "https://.../entrevista.mp3", "dia": 14, "tags": ["s2"], "description": "Escucha y responde.", "thumbnail_url": "", "questions": [{ "type": "multiple_choice", "prompt": "¿A qué hora se despierta?", "options": ["6:00", "7:00", "8:00"], "answer": "7:00" }] }
```

### `culture` *(Firestore collection name — rendered on-site as "Cultura")*
**Keyed by:** admin-chosen id via the generic MasterDashboard save.
**Required fields:** `titulo` (string, generic base field), `mainText` (string)
**Optional fields:**
- `subtitulo`, `imagen` (generic base fields)
- `metadata` (object) — `{ country: string, type: string }`
- `header` (object) — `{ image: string, caption: string }`
- `location` (object) — `{ region: string, description: string, coordinates: { lat: number, lng: number } }`
- `subTopics` (array) — `{ title: string, text: string, image: string }`
**Example:**
```json
{
  "titulo": "Machu Picchu",
  "metadata": { "country": "Perú", "type": "General Overview" },
  "header": { "image": "https://.../machu-header.jpg", "caption": "La ciudadela inca al amanecer" },
  "location": { "region": "Sudamérica", "coordinates": { "lat": -13.1631, "lng": -72.5450 }, "description": "En la cordillera de los Andes, región del Cusco." },
  "mainText": "Machu Picchu es una antigua ciudad inca...",
  "subTopics": [{ "title": "Historia", "text": "Construida en el siglo XV...", "image": "" }]
}
```
*Note: I could not confirm from code alone how/whether `culture` docs get a día/course assignment for scheduling — no dia/course field appears in its own editor form (`FormCultura.jsx`) or default object; flagged below.*

### `destacado_diario`
**Keyed by:** single bundle doc, id `_bundle`, shaped `{ items: { [itemId]: {...} } }`. Item id scheme (from the uploader): `${type}_${cleanLocation}_${cleanTopic}` — stable even if `dia` changes later.
**Required fields (per item):**
- `type` (string, e.g. `"destino"`/`"persona"`), `location` (string)
- `content` (object) — `{ spanish: string, english: string }` — **the real body-text field is `content.spanish`, read as `item.content?.spanish || item.body_es` (the `body_es` side is a legacy fallback for older docs; a bare `item.spanish` does not exist and silently renders nothing)**
**Optional fields:**
- `header` (string, e.g. `"DESTINO DEL DÍA"`), `image_url` (string)
- `dia` (number), `course` (string or string[] — filtered with `Array.isArray(d.course) ? d.course.includes(course) : d.course === course`)
- `word_of_the_day` (object) — `{ word, translation, sample_sentence, sentence_translation }` (all strings)
- `lastUpdated` (server timestamp)
**Example (one item inside `items`):**
```json
{
  "type": "destino", "location": "Valencia, España",
  "header": "DESTINO DEL DÍA",
  "image_url": "https://.../valencia.jpg",
  "content": { "spanish": "Valencia es famosa por sus Fallas y su paella.", "english": "Valencia is famous for its Fallas festival and paella." },
  "dia": 30, "course": ["s2", "s4"],
  "word_of_the_day": { "word": "la hoguera", "translation": "bonfire", "sample_sentence": "Quemaron la falla en una hoguera enorme.", "sentence_translation": "They burned the falla in a huge bonfire." },
  "lastUpdated": "2026-09-14T14:30:00.000Z"
}
```

### `lecturas`
**Keyed by:** admin-chosen id (IB Paper-2-style reading exercises; this is the collection `LecturaPage.jsx`/`CulturalLecturaExercise.jsx` actually read live via `doc(db,'lecturas',id)` — NOT bundled, despite other "daily content" collections being bundled).
**Required fields:**
- `subtitulo` (string, used as title display), `test_id` (string), `text_id` (string, e.g. `"A"`)
- `paragraphs` (array of strings)
- `question_sections` (array) — `{ type: string (not `"correction"` — those are stripped on import), questions: [{..., answer: string (joined with ", " if originally an array, e.g. multiple_select)}] }`
**Optional fields:**
- `dia` (number|string), `type` (string, e.g. `"ib_paper_2"`)
**Example:**
```json
{
  "subtitulo": "La inmigración en España",
  "test_id": "ib_paper2_mock_1", "text_id": "A", "dia": 40, "type": "ib_paper_2",
  "paragraphs": ["España ha sido históricamente un país de emigrantes...", "En las últimas décadas, esta tendencia se ha invertido..."],
  "question_sections": [{ "type": "multiple_choice", "questions": [{ "prompt": "¿Qué tendencia se describe?", "options": ["A", "B", "C", "D"], "answer": "B" }] }]
}
```

### `lectura` *(singular — a SEPARATE collection from `lecturas`)*
**Keyed by:** admin-chosen id via the generic MasterDashboard save; fed into the Dashboard's activity grid (`type === 'lectura'` → `LecturaLayout`), scheduled by `dia`/`course` like other daily activities.
**Shape:** same base fields as `lecturas`'s IB-Paper-2 shape (`test_id`, `text_id`, `paragraphs`, `question_sections`, `type: "ib_paper_2"`) plus the generic base (`titulo`/`subtitulo`/`imagen`) and a `dia` field.
*Flagged below — I could not confirm from code alone whether this is a deliberately distinct "daily activity" feed or a stale duplicate of `lecturas` from before a rename.*

### `anuncios`
**Keyed by:** admin-chosen id via the generic MasterDashboard save.
**Required fields:** `text` (string)
**Optional fields:** `type` (string, default `"standard"`), `courses` (string[]), `start_date`/`end_date` (date strings), `thumbnail` (string), `link` (string)
**Example:**
```json
{ "text": "Galería de Arte – Seniors IB 2026", "type": "standard", "courses": ["s2", "s4"], "start_date": "2026-09-20", "end_date": "2026-09-27", "thumbnail": "", "link": "" }
```

### `lectura_completions`
**Keyed by:** `${uid}_${lecturaId}`. Student-side completion marker, written once per student per `lecturas` item.
**Fields:** `uid`, `lecturaId` (strings), `completedAt` (ISO string).

### `faq_entries`
**Keyed by:** `faq_${Date.now()}` (or reused on edit).
**Required fields:** `question` (string), `answer` (string)
**Optional fields:** `course` (string, default `'all'`), `order` (number, default 0 — controls display sort)
**Example:** `{ "question": "¿Cómo reinicio mi contraseña?", "answer": "Pídele a tu profesor que...", "course": "all", "order": 3 }`

---

### Recreo (games)

### `juego_senordle`
**Keyed by:** single bundle doc, id `_bundle`, shaped `{ items: { [dateOrWordId]: wordData } }` — but the uploader's input format keys by **course then date**: top-level keys `s2`/`s4`, each `{ "YYYY-MM-DD": "word" }`.
**Example input JSON (uploader paste box):** `{ "s2": { "2026-09-29": "hablar", "2026-09-30": "comer" }, "s4": { "2026-09-29": "vivir" } }`

### `juego_silabas`
**Keyed by:** auto-id.
**Required fields:** `palabra` (string), `silabas` (string[], at least 2), `clue` (string)
**Optional fields:** `createdAt` (ISO string)
**Example:** `{ "palabra": "panadería", "silabas": ["pa", "na", "de", "rí", "a"], "clue": "Donde se compra pan", "createdAt": "2026-09-14T14:40:00.000Z" }`

### `juego_atandocabos`
**Keyed by:** `ac-${course}-${date}` (e.g. `ac-s2-2026-09-29`).
**Required fields:** `id` (matches doc id), `course` (string), `fecha` (`YYYY-MM-DD` string), `categories` (array, exactly 4) — `{ title: string, items: string[] (exactly 4) }`
**Optional fields:** `createdAt` (ISO string)
**Example:**
```json
{
  "id": "ac-s2-2026-09-29", "course": "s2", "fecha": "2026-09-29",
  "categories": [
    { "title": "Falsos amigos", "items": ["embarazada", "éxito", "sensible", "actualmente"] },
    { "title": "Sinónimos de \"feliz\"", "items": ["contento", "alegre", "dichoso", "jubiloso"] },
    { "title": "Palabras con \"ñ\"", "items": ["niño", "año", "español", "mañana"] },
    { "title": "Verbos irregulares", "items": ["ser", "ir", "tener", "hacer"] }
  ],
  "createdAt": "2026-09-14T14:45:00.000Z"
}
```
See the `anthropic-skills:atando-cabos` skill for the actual plain-text authoring format fed into this importer.

### `juego_eslabones`
**Keyed by:** `es-${course}-${date}`.
**Required fields:** `id`, `course`, `fecha` (`YYYY-MM-DD`), `chain` (string[], typically 8-10, min 2, each uppercased)
**Optional fields:** `createdAt` (ISO string)
**Example:** `{ "id": "es-s2-2026-09-29", "course": "s2", "fecha": "2026-09-29", "chain": ["PAN", "PANADERO", "PANADERÍA", "CERCANÍA", "CERCA"], "createdAt": "2026-09-14T14:50:00.000Z" }`

### `trivia_rooms`, `impostor_rooms`, `zas_rooms` *(runtime only — not admin-authored content)*
No admin writer exists for any of these anywhere in the codebase — they are pure **live multiplayer session state**, created by a student/teacher starting a game, keyed by a random room code, each with `players`/`messages`/`answers` subcollections written directly by `TriviaRoomPage.jsx`/`ImpostorRoomPage.jsx` during play (scores, turn state, chat messages, per-question answers). Out of scope for a content-generation validator; not documented further here.

---

### Site configuration & curriculum tracks (singleton docs)

All of these live under the `config` or `curriculum_tracks` collections as ONE doc per key — never one-doc-per-item.

### `config/academic_year_<YYYY_YYYY>`
e.g. `config/academic_year_2026_2027`. **Shape:** `{ map: [{ fecha: "YYYY-MM-DD", status: "school"|other, dia: number|null, ciclo: "A"|"B"|"", note: string, manualOverride: bool }] }`. This is the master day-number ↔ calendar-date mapping every other sequencer reads to resolve a día.

### `config/class_schedule`
**Shape:** `{ blocks: [{ section: string (must match a student's `section` field case-insensitively, e.g. "1B","4A","4B"), start: "HH:MM", end: "HH:MM" }], updatedAt: ISO string }` — 24-hour time, bell-schedule windows used for reassessment timing.

### `schedule_overrides/{YYYY-MM-DD}`
**Shape:** `{ blocks: [{ section, start, end }], updatedAt: ISO string }` — a partial override for one specific date (only the sections that actually change that day need an entry); merged on top of `config/class_schedule`.

### `config/gamification`
**Shape:** `{ titleTiers: [{ minPoints: number, title: string }], badges: [{ id: string, name: string, icon: string (emoji), tiered: bool }], lastUpdated: ISO string }`. `badges[].id` is what `pods[].badgeAward.badgeId` references.

### `config/impostor_themes`
**Shape:** `{ s2: string[], s4: string[], lastUpdated: ISO string }` — plain line-separated theme prompts per course for the Impostor game.

### `config/conectores_practica`
**Shape:** `{ items: [{ texto: string (must contain a literal `_` blank marker), respuesta: string, courses: string[] ('s2'/'s4') }] }`.
**Example:** `{ "items": [{ "texto": "Estudié mucho, _ no aprobé el examen.", "respuesta": "sin embargo", "courses": ["s2", "s4"] }] }`

### `curriculum_tracks/evaluaciones_master`
**Shape:** `{ s2: [{ dia: number, label: string }], s4: [{ dia: number, label: string }] }` — the quiz/exam calendar per course, read live (never cached) by `resolveCurrentEvalDia` in `src/utils/evaluaciones.js`.

### `curriculum_tracks/gramatica_master`
**Shape:** `{ s2: [{ dia: number, introText: string, repasoText: string, enlaces: string, recursos: string }], s4: [...] }` — `enlaces`/`recursos` are formatted-id strings referencing other collections (e.g. `grammar_pages`/`culture` ids), rows with all four fields empty are pruned on save.

### `curriculum_tracks/tareas_master`
**Shape:** `{ s2: [<task>], s4: [<task>] }`. Task: `{ id: string, day_assigned: number, day_due: number, tipo: string (one of "Dominio","VHL","KWL","Schoology","Escuchar","Leer","Hablar","Escribir","Proyecto","Práctica","Examen de IB","Señor+"), titulo: string, notas_opcionales: string, path_id: string (a `learning_paths` id, only meaningful when `tipo === "Dominio"` — a cross-course `path_id` is intentional and supported), url: string, enforceDueDate: bool, latePenaltyPerDay: number }`.
**Gotcha:** `enforceDueDate` gates BOTH archiving and late-grading penalties (`src/utils/learningPathProgress.js`'s `isPastEffectiveDueDate` checks it first and skips the due-date check entirely if falsy/missing) — older tareas created before this flag existed were never migrated and silently never archive no matter how overdue, unless backfilled via Tareas Sequencer's "🔄 Migrar Tareas Antiguas" button.

### `curriculum_tracks/vocab_master`
**Shape:** `{ s2: { [dia: string]: string[] (vocab_bundles ids) }, s4: { ... } }` — maps a día number (as an object key) to which vocab_bundles chapters are "live" through that day. Entries can go stale after a textbook rename changes `vocab_bundles` doc ids (see `vocab_bundles`'s gotcha above).

---

### Theming

### `temas`
**Keyed by:** admin-chosen id/slug.
**Required fields:** `name` (string), `styles.header` (string — a Tailwind gradient class string, or a raw CSS value parsed by `parseHeaderGradientStyle`)
**Optional fields:**
- `start` / `end` (`"MM-DD"` strings) — the theme's active date window within the school year
- `styles.accent` (hex color), `styles.fontHeading` (string), `styles.cardOverrides` (object, per-activity-type hex color map), `styles.textures`, `styles.imageOverrides`, `styles.accentShades`, `styles.fonts`, `styles.textEffects.{presets,assignments}`, `styles.pageBackgroundImage`
- `styles.animatedLayer.particles` (array, JSON-paste-box only) — each `{ char?, url?, color?, direction: 'down'|'up'|'left'|'right', speed: number, fixedSpeed?: bool, count: number, sizeRange: [number, number] }` (`url` wins over `char` if both set)
- `effectConfig` (object) — single-species fallback particle config, same per-species shape as above, editable via plain admin controls
**Example:**
```json
{
  "name": "Otoño",
  "start": "10-01", "end": "10-31",
  "styles": {
    "header": "bg-gradient-to-r from-orange-800 to-amber-600",
    "fontHeading": "Inter",
    "accent": "#c2410c",
    "cardOverrides": { "evaluacion": "#c2410c", "calentamiento": "#dc2626" }
  },
  "effectConfig": { "char": "🍂", "color": "#d97706", "direction": "down", "speed": 1, "count": 40, "sizeRange": [12, 27] }
}
```

---

### Users & classroom ops

### `users`
**Keyed by:** Firebase Auth `uid`.
**Required fields (set at registration):**
- `uid`, `email`, `firstName`, `lastName` (strings)
- `role` (string) — `'student'`|`'admin'`
- `course` (string) — `'s2'`|`'s4'`
- `section` (string|null) — `'1B'`/`'4A'`/`'4B'`/etc., `null` if `independent`
- `highest_pod_reached` (number, starts 0), `current_path_points` (number, starts 0)
- `created_at` (ISO string)
**Optional fields** (accumulate over the student's lifetime, written by many different engines — not an exhaustive list, but the commonly-referenced ones):
- `independent` (bool) — opts the student out of the live roster/gradebook/leaderboard
- `preferredName` (string) — wired into the Seating Chart family ONLY (manager, print view, seat-pick prompt); NOT the Gradebook, leaderboards, or Schoology export
- `weekly_points`/`weekKey`, `monthly_points`/`monthKey` (number/string) — reset each period; see `leaderboard_history` for the only durable past-period record
- `activeReassessment` (object|null) — `{ circleId, expiresAt }`, the site-wide reassessment lockout flag
- `schoologyId` (string)
- `specialTrophies` (array, via `arrayUnion`/`arrayRemove`)
- `featuredBadgeId` (string)
- `rewardsSeen` (object) — `{ title: string, badges: object }`
- `seatPickGrant` (object, deleted via `deleteField` once used)
- `avatarConfig` (object|null) — `{ style: 'adventurer', options: {...}, accessoryId: string|null, accessoryImageUrl: string|null }`, written by `src/student/AvatarBuilderPage.jsx` (route `/mi-avatar`). `style`/`options` drive `src/utils/avatarCatalog.js`'s self-hosted DiceBear generation (`@dicebear/core` + `@dicebear/adventurer`, no hosted-API calls); `options` is a flat `{hair, hairColor, eyebrows, eyes, mouth, skinColor, glasses, earrings, features}` map — every DiceBear built-in part is free/ungated for all students (curating "which of the 45 hair variants are free" wasn't worth the admin busywork). `accessoryImageUrl` is a **denormalized snapshot** of an `unlockables` doc's `imageUrl` at save time (see below) — not live-linked, so replacing that image later doesn't retroactively update students who already saved with the old one. A student with no `avatarConfig` yet (or missing `.options`) renders `DEFAULT_AVATAR_OPTIONS` seeded off their own `uid`, so nobody ever shows a broken avatar. Rendered via the shared `src/components/StudentAvatar.jsx` in Header.jsx and LeaderboardCard.jsx (LeaderboardCard's `rows.map` must carry `avatarConfig` through explicitly — it doesn't flow through automatically, see its row-shape code).
- **Chest system** (`src/utils/chests.js`): every full 100 points earned on one calendar day grants a chest (a 350-point day grants 3, not 1), rarity rolled at grant time as `min(50%, streak_count × 1%)`.
  - `chestPoints` (number) / `chestDayKey` (string, `YYYY-MM-DD`) — the real "points earned today" counter, reset correctly per day. **Deliberately a separate field from the pre-existing `daily_points`**, which despite its name and despite being shown to students as "📅 Hoy" in `StudentLearningPath.jsx` has **never actually reset daily anywhere in this codebase** — every writer (`pointsHelper.js`'s `awardPoints`, and the 3 engines below) just accumulates it forever like `total_points`. Reusing it for chests would have meant every long-tenured student instantly crossing hundreds of 100-point thresholds the moment this shipped. Left `daily_points` as-is (not in scope of what was asked) rather than silently changing its long-standing, if misleading, behavior.
  - `pendingChests` (array) — `{ id, rarity: 'common'|'rare', earnedAt }`, unopened chests. Opened via `/mis-cofres` (`MisCofresPage.jsx`), which removes the exact chest object via `arrayRemove(chest)` (relies on having the literal object instance from the read, not a reconstructed one — `arrayRemove` needs a deep-equal match) and rolls one accessory from the matching rarity's `unlockables` pool (`pickRandomItem`, a plain top-level function — NOT an inline `Math.random()` in the component body, which the `react-hooks/purity` lint rule flags even inside an event handler).
  - `ownedAccessoryIds` (string[]) — permanent ownership from a chest pull, **independent of `unlockables.unlockPoints`**: `AvatarBuilderPage.jsx`'s accessory-unlock check is `totalPoints >= unlockPoints || ownedAccessoryIds.includes(item.id)`, so a lucky chest pull sticks even for an accessory a student's current points haven't reached yet. A dupe pull (already-owned accessory rolled again) converts to bonus points instead (`DUPE_BONUS_POINTS`: 50 common / 150 rare) rather than doing nothing.
  - **Integration point — 4 places, not 1**: despite `pointsHelper.js`'s `awardPoints()` looking like the universal point-award chokepoint, 3 major engines (`CalentamientoEngine.jsx`, `CuriosidadQuizEngine.jsx`, `StudentLearningPath.jsx`) maintain their own hand-rolled copy of the same weekly/monthly/streak logic and never call it at all. `computeChestAward(existingData, pointsEarnedThisSave, bumpedStreakCount)` had to be wired into all 4 separately, spread into each one's existing write payload the same way `bumpStreak(data)` already was — a 5th point-earning engine built the same way (its own inline Firestore write, not calling `awardPoints`) needs the same addition by hand; there's no single shared hook that would catch it automatically.
**Example:**
```json
{
  "uid": "abc123uid", "email": "student@uticak12.org", "firstName": "María", "lastName": "González",
  "role": "student", "course": "s2", "section": "1B",
  "highest_pod_reached": 3, "current_path_points": 1250,
  "created_at": "2026-08-20T12:00:00.000Z",
  "preferredName": "Mari"
}
```

### `seating_charts`
**Keyed by:** `${course}_${section}` (e.g. `s2_1B`) — see `chartIdFor` in `src/utils/seatingLayout.js`.
**Shape:** `{ course, section (strings), assignments: { [podId]: uid[] }, updatedAt: ISO string }`.

### `seating_notes`
**Keyed by:** `uid` (one per student).
**Shape:** `{ note: string, preferFront: bool, avoidIds: string[] (other student uids to seat away from) }`.

### `unlockables`
**Keyed by:** auto-id.
**Required fields:** `label` (string), `type` (string — `'theme'` or `'avatar_accessory'`), `targetId` (string — e.g. a theme's unlock-toggle target; for `avatar_accessory` just a human-chosen slug, not read by anything), `unlockPoints` (number)
**Optional fields:** `imageUrl` (string) — only meaningful for `type: 'avatar_accessory'`; the overlay art a student's avatar renders on top of the DiceBear base once unlocked (see `users.avatarConfig` above), uploaded via `ImageUploadField` in `UnlockablesManager.jsx`. Unlock is a live `totalPoints >= unlockPoints` check (same pattern as the Calma theme toggle) — there's no per-student "ownership" write for the points-threshold path, so raising/lowering `unlockPoints` later instantly re-locks or unlocks it for everyone, there's no "grandfathering" a student who already had it unlocked at a lower threshold. `rarity` (string, `'common'`|`'rare'`) — also only `avatar_accessory`; which chest rarity's loot pool this accessory can be pulled from (`src/utils/chests.js`, `MisCofresPage.jsx`). **Completely independent of `unlockPoints`** — a chest pull grants permanent ownership via `users.ownedAccessoryIds` regardless of the student's current points, it doesn't check or care about `unlockPoints` at all. An accessory with no `rarity` set is simply never in either chest's pool (still reachable via the points threshold, just never chest-droppable).
**Examples:**
```json
{ "label": "Tema Calma", "type": "theme", "targetId": "calma", "unlockPoints": 10000 }
{ "label": "Corona Dorada", "type": "avatar_accessory", "targetId": "corona_dorada", "imageUrl": "https://.../corona.png", "unlockPoints": 5000 }
```
A starter set of 10 `avatar_accessory` docs (medalla, dos banderas, calabaza, loro, trofeo/copa/gemas/dragón/corona) was seeded directly into Firestore — not checked into the repo as files, so a future session should query the live collection rather than assume what's there from code. Art is from two open-source sources requiring attribution (credited in `FaqPage.jsx`'s footer, not elsewhere): [game-icons.net](https://game-icons.net/) (Lorc/Delapouite, CC BY 3.0 — the 5 "loot badge" icons had their raw-export black background square stripped and the white fill recolored gold before uploading) and [OpenMoji](https://openmoji.org/) (CC BY-SA 4.0 — the flags/mascot/seasonal ones, used as-is). Uploaded to Firebase Storage under `avatar_accessories/` via firebase-admin directly (not through `ImageUploadField`), with a manually-generated `firebaseStorageDownloadTokens` metadata value so the resulting URL matches the same public download-URL shape the client SDK produces.

### `leaderboard_history`
**Keyed by:** `${period}-${key}-${course}` (e.g. `weekly-2026-09-21-s2`, `monthly-2026-09-s2`). Written automatically (never by hand) the first time anyone in a course earns points in the FOLLOWING period — a one-time snapshot, never re-written once it exists.
**Shape:** `{ period: 'weekly'|'monthly', key: string, course: string, top: [{ uid, name, points }] (up to 3), createdAt: ISO string }`.

### `lesson_plan_notes`
**Keyed by:** `${course}_d${dia}` (e.g. `s2_d12`). Three different lesson-plan pages write DIFFERENT fields onto the SAME doc via `merge:true` — never overwrite wholesale.
**Shape:** `{ course, dia, notes: object (per-section free text keyed by `SECTION_DEFS` keys + 'tarea'), objectives: string, materialesExtra: string, overviewNote: string, updatedAt: ISO string }` (all fields optional/independent).

---

### Legacy / sandbox — flagged, not current primary content

- **`kpractice_vocab_bundles` / `kpractice_verbs` / `kpractice_sentence_bank`** — a parallel set of collections mirroring `vocab_bundles`/`verbs`/`sentence_bank` shapes exactly, fed only through one bulk-JSON import box inside `FormLearningPath.jsx` ("K-Practice" pool), seeded from `src/utils/kpracticeSeedData.js`. I could not determine their actual purpose/audience from code alone (a second test-student profile? a staging/preview copy?) — confirm with Scott before building a generator against these.
- **Legacy `/admin-secret-portal-vocab` "Vocab Uploader"** (`src/admin/uploaders/VocabUploader.jsx`) — writes the same `vocabulary` collection as Vocab Vault but with an entirely different nested-by-section wrapper shape; stale/unmaintained. Always use Vocab Vault's importer, never this one.

---

### Unclear / needs the teacher's input

- **`lectura` vs `lecturas`** — two separate, both-currently-written-and-read collections with near-identical IB-Paper-2 reading shapes. `lecturas` is the standalone Reading Library (`LecturaPage.jsx`, `CulturalLecturaExercise.jsx`, its own Sequencer/Editor pages). `lectura` (singular) is fed through the generic MasterDashboard form and surfaces as a Dashboard activity-grid card (`type === 'lectura'`). I could not confirm from code alone whether `lectura` is a deliberately distinct "daily reading activity" feed or a stale duplicate left over from an earlier rename — worth asking directly before writing a single shared validator for "a reading."
- **`culture`** — no `dia`/`course` scheduling field appears anywhere in its own editor (`FormCultura.jsx`) or default object, yet it's clearly meant to be a dated/assignable activity type (it has its own icon/color in `ActivityGrid.jsx` and `FormTemas.jsx`'s per-type card color list). How a `culture` doc actually gets attached to a specific día/course could not be traced from code alone — possibly via `curriculum_tracks/gramatica_master`'s `recursos` field, but that's inference, not confirmed.
- **`trivia_rooms` / `impostor_rooms` / `zas_rooms`** — confirmed to have no admin writer at all; purely runtime multiplayer-session state. Documented above only at a high level from the student engine code; not a target for a content-generation validator, but flagging in case the validator is expected to cover ALL collections including runtime ones.
- **`config/arcade_tiles`** (referenced from `src/utils/arcadeTiles.js`, used by `ArcadeTilesManager.jsx`) — only a thumbnail-image override map for Recreo's tile icons; I did not trace its exact field shape in depth since it's purely cosmetic and unlikely to need content-generation validation.
- **A full field-by-field spec for `users`** was deliberately not attempted — points/badges/streak/calendar fields accumulate from a very large number of independent call sites (`pointsHelper.js`, `CalentamientoEngine.jsx`, `PracticeCardEngine.jsx`, `ReadingCardEngine.jsx`, `MusicaEngine.jsx`, `CuriosidadQuizEngine.jsx`, `StudentLearningPath.jsx`, etc.) and `users` is never bulk-imported/admin-authored the way every other collection above is — if a future script specifically needs to validate a progress-write against this collection, that's worth a dedicated follow-up pass rather than folding into this content-shapes document.
