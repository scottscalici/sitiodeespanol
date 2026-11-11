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
- **course**: `"s2"`, `"s4"`, `"both"`, or an array like `["s2","s4"]` — the
  latter two write ONE card per course (ids suffixed `_s2`/`_s4`
  automatically), so a card meant for both classes only needs to be
  generated once, not pasted twice under two different ids.
- **dia**: a number to assign it to a specific class day, or `null` to
  leave it in the 📦 Banco — default to `null` unless told a day.
- **gradeWeight**/**excused**: omit unless the teacher says otherwise
  (default to 1 and false).
- **topic** (optional): a short free-text label for the whole card's
  grammar point (e.g. `"pretérito vs. imperfecto"`, `"por vs. para"`) —
  add it whenever the worksheet's own heading/unit title makes one
  obvious; otherwise omit it rather than guessing.
- **questions**: non-empty array, each one a question object — a single
  worksheet page/exercise almost always becomes several question objects,
  not one.

### Sections — when a worksheet has several lettered/labeled exercise groups

A worksheet that's visibly split into separate exercises (A, B, C...,
or named groups like "Noticias") can have each question tagged with an
optional `"section"` field matching that label, directly on the question
object — alongside `"type"` and everything else:
```json
{ "type": "write", "section": "A", "prompt": "...", "answer": "..." }
```
This lets the teacher later assign only SOME sections of the card on a
given día (via the Creator's "Asignaciones Adicionales" panel or the
Practice Cards Sequencer) instead of the whole card every time. Tag
every question with its section whenever the worksheet shows clear,
labeled groups; leave `section` off entirely for a worksheet with no
such grouping (a single flowing exercise, or just a handful of unrelated
items) — don't invent section labels where the source material doesn't
have any.

## Question types — pick the one that matches what's actually on the page

Every question needs a `"type"` field. These nine are good candidates for
extraction from a worksheet. **Every type below accepts an optional
`"explanation"` field** (feedback text shown once the student has answered,
right or wrong) — not just `multiple_choice`; add it whenever the worksheet
or answer key has a note explaining WHY an answer is correct, not just what
it is.

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

## Pictures on the worksheet: cropping them out of a photo

If the teacher already has a FINISHED image file (already cropped, a PDF's
own embedded image already saved, a diagram with no cropping needed at
all), none of this section applies — just reference it by filename in the
question's image field like normal (e.g. `"promptImage": "rivera_mural.png"`)
and tell the teacher to select that exact file in the uploader's regular
file picker. The crop tool below is only for the specific case of pulling
ONE piece out of a LARGER photo.

A PDF's own embedded images can be referenced directly once uploaded, but a
**photo of a printed worksheet** is one flat image — any picture a question
needs (a promptImage, an `image_select` option's `img`, etc.) has to be
*cropped* out of that photo instead. The Practice Cards uploader has a
built-in crop tool (`ImageCropAssist`, under "✂️ Recortar imágenes" on the
`/admin-practice-cards-upload` page) for exactly this: it takes a crop
instructions JSON, lets the teacher fine-tune each box over the real photo,
then produces real cropped files the main JSON references by filename —
nothing here requires the teacher to crop/upload anything by hand first.

Whenever a worksheet **photo** has a picture a question needs, produce a
**second JSON array**, separate from the cards array, one entry per picture:

```json
{
  "sourcePhoto": "hoja1.jpg",
  "crop": { "x": 0.11, "y": 0.355, "width": 0.26, "height": 0.21 },
  "targetFilename": "pic_a.png",
  "role": "question"
}
```

- **sourcePhoto**: the exact filename the teacher will select for that
  photo in the crop tool's file picker — since this has to match exactly
  (including the extension, e.g. `.jpg` vs `.jpeg`), ALWAYS tell the
  teacher explicitly what to save/rename the photo as, right before the
  JSON blocks (e.g. "Save this photo as `hoja1.jpg` before uploading it.").
  Never guess at a filename she hasn't told you and silently hope it
  matches — state it as an instruction.
- **crop**: `{x, y, width, height}`, each a fraction from 0 to 1 of the
  *whole photo's* width/height (not pixels) — estimate this by eye from
  where the picture sits on the page. It only needs to be reasonably
  close: the teacher gets an interactive box to drag/resize over the real
  photo before confirming, so this is a starting point, not a final
  answer. Err toward a slightly tight box that excludes any surrounding
  chrome (a lettered circle badge like "a", "b", answer blanks, borders)
  the teacher wouldn't want baked into the picture — those stay visible if
  included, and for a shuffled exercise (matching, image_select) a visible
  "a/b/c" badge can look confusing once the pictures are reordered.
- **targetFilename**: a plain, teacher-meaningful name (e.g.
  `pic_a.png`) — this is exactly what you then reference in the main
  cards JSON's `promptImage`/`img` field, as if it were any other local
  filename.
- **role**: `"question"` for a picture a question actually uses,
  `"decorative"` otherwise — purely descriptive for your own bookkeeping
  when writing the crop list; the app doesn't treat them differently.

When a worksheet exercise is fundamentally "match each word/picture to its
image" (one picture per word/item, picked from a photo), `matching` is
usually the right type, with the image side as `right: { "image":
"pic_a.png" }` (no `text` needed on that side) — see the example above.
`image_select` also now works from a worksheet photo this way, with each
option's own cropped `img`.

Output order when crops are involved: the cards JSON array first, then a
line telling the teacher what to save the source photo(s) as, then the
crop instructions array, each clearly labeled. This is the one case where
more than a bare JSON array is expected in the output — see "Important"
below.

## One type still NOT to generate from a worksheet

`hotspot` (click a spot on an image) needs hand-picked click coordinates a
cropped picture alone doesn't give you — even with its image cropped out
via the method above, the click target still has to be placed by the
teacher afterward in the Creator. Don't generate `hotspot` questions from a
worksheet; `image_select` (pick the right whole picture, no click-target
needed) covers the vast majority of what a worksheet actually asks for
image-wise.

## Important

- Output nothing but the JSON array — no intro, no explanation, no
  markdown code fence commentary beyond the code block itself. The teacher
  is going to copy it straight into the importer's paste box. The one
  exception is when crop instructions are involved (see above): then the
  cards JSON, a one-line filename instruction, and the crop JSON are all
  expected, since the teacher needs to paste two different things into two
  different boxes on the same page.
- Split a worksheet's distinct exercises into separate question objects
  inside one card's `questions` array (one card per worksheet page is the
  usual grain) rather than cramming everything into a single question.
- Keep prompts and answers in the exact Spanish/English the worksheet
  uses — don't "improve" or rephrase the source material.
- If a worksheet exercise doesn't cleanly fit any of the types above
  (e.g. an open-ended essay prompt), skip it rather than forcing a bad fit,
  and say so in one line after the JSON.
