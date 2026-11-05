---
name: practice-exercises-importer
description: Converts a worksheet, textbook page, or handout (PDF, screenshot, or photo) into importer-ready JSON for Sitio de Español's Practice Cards bulk uploader (the practice_cards collection). Use whenever a Spanish teacher shares an image or PDF of exercises and asks to turn them into practice, build a practice library, or get it ready to import — even just a photo with "make these into practice." This is NOT Practice Hub/Círculos de Práctica scheduling — it makes standalone cards (unassigned to any día by default, a "banco" item) a teacher later schedules or keeps as a library. Do NOT use for Curiosidades, Grammar Notes, Sentence Manager, Atando Cabos, or Eslabones imports (each has its own skill). Always produce the finished JSON array directly — never a template with placeholders.
---

# Practice Cards bulk-import generator

Converts a worksheet's exercises into a JSON array ready to paste into the
"Importar en Lote" box at `/admin-practice-cards-upload`, which writes into
the `practice_cards` Firestore collection — the same collection the regular
Practice Card Creator and Practice Hub/Círculos de Práctica read from. A
card built here just isn't assigned to a día yet by default, so it sits in
the 📦 Banco until the teacher (or a separate request) schedules it.

Photos work exactly like PDFs or screenshots — read the image directly.
There's no OCR step or format-specific handling; whatever is legible in the
picture is the source material.

## Before generating

Ask only if genuinely unclear from the request or the material itself:
- Which course the worksheet is for (`s2` or `s4`) — the material's own
  level/vocabulary usually makes this obvious; ask only if it's a toss-up.
- Roughly how many exercises/cards to produce — default to one card per
  worksheet page or per clearly-separated exercise section, whichever the
  material suggests, if the teacher doesn't say.
- Whether this should land directly on a specific día (then set `dia` to
  that number) or stay in the 📦 Banco as a library item (`dia: null`,
  the default — this is the normal case for "build a library").

Then generate the finished JSON directly.

## Top-level shape

A plain JSON array, each entry one practice card:

```json
{
  "id": "practica_s2_preterito_verbos_irregulares",
  "title": "Pretérito — Verbos Irregulares",
  "course": "s2",
  "dia": null,
  "questions": [ /* one or more question objects — see below */ ]
}
```

- **id**: required, teacher-meaningful and durable (e.g.
  `practica_<course>_<topic>_<detail>`), never an auto-numbered
  placeholder — this importer never overwrites an id that already exists
  in Firestore, so a collision just gets rejected rather than silently
  replacing the teacher's real card.
- **title**: short, human-readable (shows in the Creator's card list and
  on the Dashboard).
- **course**: `"s2"` or `"s4"`.
- **dia**: a number to assign it to a specific class day, or `null` to
  leave it in the 📦 Banco — default to `null` unless told a day.
- **gradeWeight**/**excused**: omit unless the teacher says otherwise
  (default to 1 and false).
- **questions**: non-empty array, each one a question object — a single
  worksheet page/exercise almost always becomes several question objects,
  not one.

## Question types — pick the one that matches what's actually on the page

Every question needs a `"type"` field. These nine are good candidates for
extraction from a worksheet:

### `write` — one blank, free-typed answer
The default for a simple fill-in-the-blank or "conjugate this verb" item.
```json
{ "type": "write", "prompt": "Escribe el pretérito: yo (hablar)", "answer": "hablé" }
```
Add `"requireAccents": true` only if the worksheet is specifically testing
accent placement; otherwise leave it off (a missed accent still warns the
student but doesn't mark it wrong).

### `multiple_choice` — the worksheet already shows answer choices
```json
{ "type": "multiple_choice", "prompt": "¿Qué significa 'madrugar'?", "options": ["despertarse temprano", "trabajar de noche", "llegar tarde", "dormir la siesta"], "answer": "despertarse temprano" }
```
`answer` must be one of the exact strings in `options` (2-5 options total, so a
textbook's A-E format fits). Add `"explanation"` (optional) for feedback text
shown after the student answers, right or wrong.

### `matching` — two columns meant to be paired up
```json
{
  "type": "matching",
  "prompt": "Empareja el verbo con su significado",
  "pairs": [
    { "left": { "text": "madrugar" }, "right": { "text": "to wake up early" } },
    { "left": { "text": "trasnochar" }, "right": { "text": "to stay up late" } }
  ],
  "distractorsText": "to take a nap\nto arrive late"
}
```
`distractorsText` (optional, newline-separated) adds extra wrong answers to
the right-side bank beyond the real pairs — use it if the worksheet's
answer bank has more entries than pairs.

### `ordering` — put steps/words/events in the correct sequence
Items go in already in their CORRECT order (the app shuffles them for the
student):
```json
{ "type": "ordering", "prompt": "Pon las oraciones en orden cronológico", "items": [{ "text": "Me desperté." }, { "text": "Me duché." }, { "text": "Desayuné." }] }
```

### `text_cloze` — DEFAULT for a paragraph with several blanks, free-typed
A worksheet asking the student to conjugate/fill in a flowing passage
(the most common "Práctica" worksheet shape) renders as ONE continuous
paragraph with a free-text input per blank — not as several disjointed
one-sentence `write` questions out of context, and not as a clickable word
bank even if the paper worksheet printed one (typing is the default; a
word bank on paper was just a hint for the student, not something students
should be able to click through digitally). Mark each answer inline with
double curly braces in `rawText`. If the worksheet's own word bank lists
infinitives (the usual case for a verb-conjugation paragraph), include
them as `verbBankText` — a plain, non-clickable reference list shown above
the paragraph, newline-separated, one infinitive per line (not the
conjugated answers):
```json
{
  "type": "text_cloze",
  "prompt": "Completa el párrafo con el pretérito o el imperfecto",
  "rawText": "Ayer yo {{fui}} al mercado y {{compré}} fruta.",
  "verbBankText": "ir\ncomprar"
}
```
Add `"requireAccents": true` only if the worksheet is specifically testing
accent placement.

### `word_bank_cloze` — one passage, several blanks, clickable shared word bank
Same passage-with-blanks shape as text_cloze, but the student picks from a
word bank instead of typing — use this ONLY when explicitly asked for a
word-bank/selection style instead of free typing. Mark each answer inline
with double curly braces in `rawText` — don't pre-compute a separate
blanked version:
```json
{ "type": "word_bank_cloze", "prompt": "Completa el párrafo", "rawText": "Ayer yo {{fui}} al mercado y {{compré}} fruta.", "distractorsText": "fue\ncompró" }
```
`distractorsText` (optional, newline-separated) adds wrong-answer words to
the shared bank beyond the real answers.

### `line_bank_cloze` — several SEPARATE short lines sharing one word bank
Like word_bank_cloze, but for a worksheet with a list of independent
captioned items (not one flowing paragraph) pulling from one shared bank:
```json
{
  "type": "line_bank_cloze",
  "prompt": "Completa cada oración",
  "lines": [
    { "rawText": "Ella {{se levanta}} a las siete." },
    { "rawText": "Nosotros {{nos acostamos}} tarde." }
  ],
  "distractorsText": "se acuesta\nnos levantamos"
}
```

### `dropdown_cloze` — a cloze where EACH blank has its own answer choices
Use this instead of word_bank_cloze when the worksheet gives a different
small set of options per blank (not one shared bank):
```json
{
  "type": "dropdown_cloze",
  "prompt": "Elige la forma correcta",
  "text": "Yo {{blank}} español y mi hermano {{blank}} francés.",
  "blanks": [
    { "answer": "hablo", "options": ["hablo", "habla", "hablas"] },
    { "answer": "habla", "options": ["hablo", "habla", "hablan"] }
  ]
}
```
The literal token `{{blank}}` (not the word itself) marks each blank in
`text` — `blanks` must have exactly one entry per `{{blank}}`, in order.

### `listen` — only if the teacher explicitly wants a listening exercise
Not something a worksheet page itself suggests (there's no audio on a
printed page) — only generate this type if asked for it directly. `prompt`
is the Spanish text that gets converted to speech, not shown to the student:
```json
{ "type": "listen", "prompt": "Buenos días, ¿cómo estás?", "answer": "Buenos días, ¿cómo estás?" }
```

## Two types NOT to generate from a worksheet

`image_select` (pick the right picture) and `hotspot` (click a spot on an
image) both need a real, already-hosted image URL and — for hotspot —
hand-picked click coordinates. A photo or PDF of a worksheet gives no such
hosted image to point to, so don't generate these two unless the teacher
supplies actual image URLs themselves; the importer will accept them
without an image either way, but the resulting card is unusable until
someone uploads one by hand in the Creator.

## Important

- Output nothing but the JSON array — no intro, no explanation, no
  markdown code fence commentary beyond the code block itself. The teacher
  is going to copy it straight into the importer's paste box.
- Split a worksheet's distinct exercises into separate question objects
  inside one card's `questions` array (one card per worksheet page is the
  usual grain) rather than cramming everything into a single question.
- Keep prompts and answers in the exact Spanish/English the worksheet
  uses — don't "improve" or rephrase the source material.
- If a worksheet exercise doesn't cleanly fit any of the eight types above
  (e.g. an open-ended essay prompt), skip it rather than forcing a bad fit,
  and say so in one line after the JSON.
