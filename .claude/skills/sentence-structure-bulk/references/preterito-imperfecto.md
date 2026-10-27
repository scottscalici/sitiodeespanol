# Pretérito vs. Imperfecto — 19-segment layered curriculum

A fixed teaching sequence for practicing the preterite/imperfect contrast,
built one distinction at a time rather than throwing the full contrast at
students immediately. When the user asks for preterite/imperfect practice,
pretérito e imperfecto, or names a specific segment number from this
sequence, generate according to this structure rather than freelancing a
generic mix — the whole point is that each segment isolates exactly what
it claims to.

Every sentence in every segment uses `[[forma_conjugada|infinitivo]]`
(the conjugation-blank marker from the main SKILL.md), never `[[respuesta]]`
or any other marker — the drill is always "produce the correct conjugated
form," and that marker is the only one that renders as a typed-recall
exercise rather than multiple choice (a conjugation blank never becomes
multiple choice in the app, so `grupo_distractores`/`excluir_distractores`
are irrelevant here — leave them off entirely).

## The one rule every sentence must follow

**Every sentence needs an explicit cue that fixes which tense is correct.**
Without one, the choice between pretérito and imperfecto is genuinely
ambiguous to a student, which defeats the exercise. Never write a sentence
for this curriculum without a clear cue word or phrase (see the cue lists
under each use below) — if a sentence doesn't obviously need one because
of its own content, add a cue anyway rather than relying on implication.

## The segments

| # | Segment | Uses drilled |
|---|---|---|
| 1 | Preterite: completed action | Use A only |
| 2 | Imperfect: ongoing action | Use B only |
| 3 | Mix of 1 and 2 | A, B |
| 4 | Preterite: time stamp (ayer, anoche) | Use C only |
| 5 | Imperfect: habitual/repeated action | Use D only |
| 6 | Mix of 4 and 5 | C, D |
| 7 | Mix of 1, 2, 4, 5 | A, B, C, D |
| 8 | Preterite: stated duration (por tres horas) | Use E only |
| 9 | Imperfect: description (age, weather, time) | Use F only |
| 10 | Mix of 8 and 9 | E, F |
| 11 | Mix of 1, 2, 4, 5, 8, 9 | A, B, C, D, E, F |
| 12 | Preterite: sequence of events | Use G only |
| 13 | Imperfect: background/scene-setting (no interruption) | Use H only |
| 14 | Mix of 12 and 13 | G, H |
| 15 | Mix of everything so far | A–H |
| 16 | Interruption pattern, preterite blanked | Use I, preterite half |
| 17 | Same sentence set as 16, imperfect blanked instead | Use I, imperfect half |
| 18 | Final mix: 16 + 17 + simultaneous imperfect actions | Use I (both halves) + Use J |
| 19 | Full review | A–J |

If a batch runs long, 14+15 may be merged into one segment, and 17+18 may
be merged into one segment — only do this if the user asks for a shorter
set, or if a single segment's sentence count would otherwise be awkwardly
large. Don't merge by default.

## Each use, with cues and examples

Keep each use's cues distinct from its sibling uses so a segment's "only
two new uses" framing actually holds — e.g. use A (completed action) and
use C (time stamp) are both preterite, but use different cue styles so
mixing them later (segment 7) is meaningfully mixing two different signals,
not the same signal twice.

- **A — Completed action (general).** A single finished event, cued
  without a literal clock/calendar reference (those are reserved for C).
  Cues: *una vez, de repente, por fin, finalmente,* or a context that's
  clearly one discrete event. Ex: *De repente, [[sonó|sonar]] la alarma.*
- **B — Ongoing action (imperfect).** A single action in progress at a
  specific moment — not habitual (that's D), not a description (that's F).
  Cues: *en ese momento, a esa hora, en aquel entonces* paired with an
  action verb. Ex: *En ese momento, los niños [[jugaban|jugar]] en el patio.*
- **C — Time stamp (preterite).** Explicit calendar/clock-relative cues.
  Cues: *ayer, anoche, la semana pasada, el año pasado, esta mañana.*
  Ex: *Anoche [[terminé|terminar]] mi proyecto de ciencias.*
- **D — Habitual/repeated action (imperfect).** Cues: *todos los veranos,
  siempre, cada día, generalmente, los sábados.*
  Ex: *Todos los veranos, mi familia [[viajaba|viajar]] a la playa.*
- **E — Stated duration (preterite).** The duration is viewed as a
  completed whole, so it's preterite despite the time span. Cues: *por
  tres horas, durante dos años, toda la noche, todo el día.*
  Ex: *[[Estudié|Estudiar]] por tres horas anoche.*
- **F — Description: age, weather, time (imperfect).** Cues: age phrases
  (*tenía ___ años*), weather (*hacía frío/calor/sol*), clock time (*eran
  las ___*), or scene conditions (*había mucha gente*).
  Ex: *[[Hacía|Hacer]] mucho frío esa noche.*
- **G — Sequence of events (preterite + preterite).** Two or more
  preterite verbs chained in order — no imperfect pairing needed, since
  this is about preterite-with-preterite sequencing. Cues: *primero,
  luego, después, finalmente* connecting the steps.
  Ex: *Primero [[me desperté|despertarse]], luego me duché y salí para
  la escuela.*
- **H — Background/scene-setting (imperfect, no interruption).** Pure
  description setting a scene — deliberately with NO interrupting
  preterite action in the same sentence, to keep this distinct from the
  interruption pattern (use I) introduced later. Cues: scene-setting
  phrases like *el cielo estaba, las calles estaban, todo parecía.*
  Ex: *El cielo [[estaba|estar]] gris y las calles estaban vacías.*
- **I — Interruption pattern (imperfect + preterite in one sentence).**
  An ongoing imperfect action interrupted by a completed preterite action.
  Cue: *mientras, cuando* joining the two clauses. This use produces TWO
  lines per underlying sentence (see "Segments 16 and 17" below).
  Ex: *Yo dormía cuando sonó el teléfono.*
- **J — Simultaneous imperfect actions (imperfect + imperfect).** Two
  actions happening at the same time, both ongoing — no preterite
  involved. Cue: *mientras* joining two imperfect clauses. Blank either
  one of the two verbs (vary which one across the set).
  Ex: *Mientras yo cocinaba, ella leía un libro.*

## Segments 16 and 17: one sentence set, two passes

Write one set of interruption-pattern (use I) sentences. For segment 16,
blank the preterite verb and show the imperfect verb already conjugated.
For segment 17, use the EXACT SAME sentences again, but blank the
imperfect verb instead and show the preterite verb already conjugated.
Both passes go into the output as separate lines, tagged for their own
segment.

Example pair from one underlying sentence:
```
Yo dormía cuando [[sonó|sonar]] el teléfono. | I was sleeping when the phone rang. |  | Pretérito-Imperfecto, Segmento 16, interrupción
Yo [[dormía|dormir]] cuando sonó el teléfono. | I was sleeping when the phone rang. |  | Pretérito-Imperfecto, Segmento 17, interrupción
```

## Tagging

Use `etiquetas` consistently across every segment: the textbook/course tag
the user gives (or omit if none), `Pretérito-Imperfecto`, `Segmento N`,
and the use letter or a short label for it (e.g. `uso A`, `interrupción`,
`simultáneo`). This lets the teacher filter the Learning Path builder down
to one segment at a time. `capítulo` follows whatever the user says, or is
left empty.

## Generating a request

The user will typically ask for one segment, a range ("segments 1
through 7"), or everything. Default to a reasonable count per segment
(6-10 sentences) unless told otherwise, and always cover the uses listed
for that segment — don't substitute in a use from a later segment early,
and don't quietly drop a use a mix segment calls for.
