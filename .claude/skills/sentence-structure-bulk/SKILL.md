---
name: sentence-structure-bulk
description: Generates Spanish practice sentences in the exact pipe-delimited format Sentence Manager's bulk importer (src/admin/managers/SentenceManager.jsx, the sentence_bank collection) expects, ready to paste directly into its bulk-import box. Use this whenever the user, a Spanish teacher, asks for sentences to practice a grammar point or structure (e.g. "give me 15 sentences practicing ser vs estar", "make some sentences for the subjunctive after ojalá", "I need sentences drilling direct object pronouns") OR for vocab-in-context example sentences (a specific vocab word used in a full sentence, e.g. "write 10 example sentences for these new words"), even if they only say something like "make me some sentences for chapter 8" or "give me a batch for [topic]". Do NOT use this for a plain list of vocabulary words with translations (that's the separate vocab-sentences-bulk skill, a different uploader/format), or for Curiosidades, Atando Cabos, Eslabones, or Grammar Notes imports (each has its own skill/format). Always generate the finished plain-text lines directly — never hand back a template with placeholders.
---

# Sentence Manager bulk-import generator

Generates ready-to-paste lines for the "Importar en Lote" box in Sentence
Manager (`src/admin/managers/SentenceManager.jsx`), which writes into the
`sentence_bank` Firestore collection. This is the sentence bank Learning
Paths pull from for both grammar/structure drills and vocab-in-context
sentences — it is NOT the vocab-list importer (that's `vocab-sentences-bulk`,
a different tool with a different format entirely).

## Before generating, know the topic and count

Ask only if genuinely unclear from the request:
- The grammar point, structure, or vocab words to practice.
- How many sentences (default to what feels reasonable for the topic —
  10-15 is a typical batch — if the user doesn't say).
- The chapter/unit id, if they mention one (fine to leave blank otherwise).

Then generate the finished lines directly. Don't show the user a template
or ask them to fill in blanks — that defeats the point of the skill.

## Output format

One sentence per line, plain text (no numbering, no bullets, no code
block, no headers). Each line has columns separated by `" | "` — exactly
one space, one pipe, one space:

```
español | inglés | capítulo | etiquetas | grupo_distractores | excluir_distractores | respuesta_alterna_1 | respuesta_alterna_2 ...
```

The first 4 columns are required. Columns 5 onward are optional — if a
line doesn't need them, just end it after the tags column rather than
padding it with empty trailing columns.

### Marking the answer in the "español" column

Use exactly one of these per sentence, based on what the sentence is
actually drilling:

- `[[respuesta]]` — one blank. The app itself coin-flips this into either
  multiple choice or a scrambled-sentence reconstruction each time it's
  drawn, so one line already gives two question types for free.
  Example: `Yo [[fui]] a la tienda ayer.`
- `[[forma_conjugada|infinitivo]]` — a verb blank: the conjugated form, a
  bare pipe with NO spaces, then the infinitive, both inside the same
  double brackets. Example: `Ella [[comió|comer]] pizza.`
- `[[a]] ... [[b]] ... [[c]]` (two or more) — multiple blanks in one
  sentence. Example: `[[Fui]] a la tienda y [[compré]] pan.`
- `{{palabra}} ... {{palabra}}` (exactly two) — for Lógico/Ilógico
  practice. Example: `El hielo está {{caliente}} y el fuego está {{frío}}.`
- `Afirmación || ¿Pregunta correcta?` — two pipes together, NO spaces,
  for "form the question" practice. Example: `Tiene veinte años. || ¿Cuántos años tiene?`
- No marker at all — a plain sentence, for sentence-building/dictation.
  Example: `Ella vive en Madrid.`

Pick the marker that matches what's actually being drilled — don't
default to `[[respuesta]]` for everything. A verb-tense topic almost
always wants `[[forma|infinitivo]]`; a vocab-in-context sentence usually
wants a plain `[[palabra]]` single blank on the target word, or no marker
at all if it's just modeling the word in context rather than quizzing it.

### The remaining columns

- **inglés**: full English translation. Leave the column empty if it
  doesn't apply, but don't drop it — the columns after it would shift.
- **capítulo**: a chapter/unit id (e.g. `8`), or empty.
- **etiquetas**: comma-separated keywords (e.g. `pretérito, viajes`) for
  organizing/filtering in the Learning Path builder. These do NOT limit
  where distractors come from — see the next two columns for that.
- **grupo_distractores** (optional): a single, narrower tag than the
  topic tags, used only to *prefer* a tighter pool of sentences as this
  one's multiple-choice distractors. This does not guarantee any specific
  sentence gets excluded — for that, use excluir_distractores.
- **excluir_distractores** (optional, comma-separated): exact answers
  that must NEVER be offered as a wrong-answer option for this sentence.
  Use this for near-synonyms a student could reasonably defend as correct
  — e.g. if a batch includes "a menudo", "con frecuencia", and "muchas
  veces", each of those three sentences needs its OWN line excluding the
  other two, since without it the app may pit true synonyms against each
  other as if only one were right.
- **respuesta_alterna_N** (optional, one full sentence per column, can
  repeat): another complete sentence that's equally correct but phrased
  differently (different word order, an optional subject pronoun dropped
  or included, etc.) — accepted as correct in addition to the main one.

## Empty middle columns

Leaving the **capítulo** or **grupo_distractores** column empty when a
later column (tags, exclude list, alt answers) is still used is fine —
write it as `" | | "` or `" |  | "`, either works, since the real parser
no longer depends on exact spacing to find column breaks. (An earlier
version of the parser DID require two spaces for this, and a collapsed
double-space — easy to trigger via a word processor or some clipboard
tools — used to silently corrupt every column after the empty one. That's
fixed now, but it's worth knowing in case an older line ever looks wrong.)

## Important

- Never generate sentences with verb-contrast pairs (binary/quad verb
  distractor modes) — those need to be configured by hand in the app
  against its own verb data, not authored as plain text.
- Output nothing but the sentence lines. No intro, no explanation, no
  summary — the user is going to select-all and paste this directly into
  a textarea.

## Worked example

Request: "give me 5 sentences practicing a menudo, con frecuencia, and
muchas veces as near-synonyms, plus despacio and pronto, for Descubre 2
chapter 6"

```
Mi abuelo va al mercado [[a menudo]]. | My grandfather goes to the market often. |  | Descubre 2, adverbios |  | con frecuencia, muchas veces
Mis primos nos visitan [[con frecuencia]]. | My cousins visit us frequently. |  | Descubre 2, adverbios |  | a menudo, muchas veces
Hemos ido a esa playa [[muchas veces]]. | We have gone to that beach many times. |  | Descubre 2, adverbios |  | a menudo, con frecuencia
Por favor, habla más [[despacio]]. | Please speak more slowly. |  | Descubre 2, adverbios
El tren sale [[pronto]]. | The train leaves soon. |  | Descubre 2, adverbios
```

Notice the synonym trio each excludes the other two, on their own line,
and the chapter column was left blank by choice (since the user didn't
ask for a numeric chapter id, "Descubre 2" went into tags instead).
