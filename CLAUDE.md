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
  dropdown, never retype it from memory.
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
  (pinned_sentences, MC-or-reconstruction) count instead — don't conflate
  the two when a request is "type the answer" (`recall`) vs. "sentence/MC"
  (`sentence`).
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
  no shared helper between them yet.
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
- **Theme floating-particle species** (`src/components/ThemeParticles.jsx`,
  canvas-based): each species is `{ char, color, direction, speed, count,
  sizeRange }` for an emoji, or `{ url, direction, speed, count,
  sizeRange }` to float an uploaded image instead — `url` wins if both
  are set. A single-species fallback lives at `effectConfig` on the tema
  doc (editable via plain admin controls, including an image-upload
  field, in `FormTemas.jsx`'s "Efecto de Partículas"); multiple species
  at once is `styles.animatedLayer.particles` (an array of the same
  shape), JSON-paste-box only, no dedicated UI. An image species skips
  drawing for a frame rather than falling back to the emoji while it's
  still loading — never a flash-then-swap.
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
