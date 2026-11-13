---
name: schoology-grade-converter
description: Converts a grade export from VHL (Vista Higher Learning) and/or KWL Hub (Klett World Languages) — plus a Schoology roster export for ID matching — into a single CSV ready to paste into Schoology's bulk grade importer. Use whenever the teacher attaches a VHL or KWL Hub grade export and asks to get it into Schoology, convert/prepare it for import, or push it to the gradebook, even if they only say "turn this into something I can upload." Do NOT use for this site's own Gradebook export (a different, already-built button) — this is only for third-party textbook-platform grades that never touch this site.
---

# Schoology grade import converter

Converts a grade export from VHL (Vista Higher Learning) and/or KWL Hub
(Klett World Languages) into a single CSV ready to paste into Schoology's
bulk grade importer. Use this whenever the teacher attaches a VHL or KWL
Hub grade export and asks to get it into Schoology, convert it, prepare
it for import, or push it to the gradebook — even if they only say
something like "can you turn this into something I can upload."

This is NOT the same as this site's own Gradebook "📤 Exportar CSV"
button (`src/admin/MasterDashboard/TeacherGradebook.jsx`) — that one
exports THIS site's own Dominio/Práctica grades to Schoology. This skill
is for grades earned on a third-party textbook platform (VHL, KWL Hub)
that never touch this site at all.

## What Schoology's import actually requires

Schoology's bulk grade importer matches students by **Unique User ID**
(the student's Schoology-internal ID, a value like `1_154548`) and
updates scores on assignments that must **already exist**, by **exact
title match**, in that course's Schoology gradebook. The importer never
creates an assignment or category from the CSV — it only writes into
ones the teacher already made. So the output CSV always has this shape:

```
Unique User ID,<Assignment Title 1>,<Assignment Title 2>,...
1_154548,95,88
...
```
Plain numbers, no `%` sign, blank for "leave this assignment ungraded
for this student" — this matches the convention this site's own export
already uses successfully.

## The three kinds of input file

### 1. A Schoology roster export (the ID lookup — always needed)
Exported from Schoology itself: Course Gradebook → the "⋮" more menu →
Export → **Gradebook as CSV**. Columns: `First Name, Last Name, Unique
User ID, ...(assignment columns)..., Username`. This skill only ever
reads the `First Name`/`Last Name`/`Unique User ID` columns from it — it
exists purely so every VHL/KWL row (which has a name but no ID) can be
matched to a real Schoology ID. The teacher may attach more than one of
these (one per class section) — merge them all into one lookup table.

**Match by exact First+Last name** (case-insensitive, trimmed) against
this lookup. If a VHL/KWL row's name doesn't match exactly one roster
row, do NOT guess — leave that student out of the output CSV and call
them out by name in your reply, e.g. "⚠️ No exact roster match for
'Jon Smith' — check the spelling or whether they're in a section you
didn't attach a roster for." A wrong or blank Unique User ID either
silently fails to update that student or (worse) updates the wrong one.

### 2. A VHL export ("lesson_grade_to_activities" style)
Columns: `Last Name, First Name, Lesson Grade, Repaso, Repaso, Repaso,
<some "Prueba de..." column>` — note the **Repaso columns are all
literally named the same thing** and are **not individually meaningful**
here. Only `Lesson Grade` matters: it's VHL's own computed average
across however many sub-activities made up that lesson, and it's the
ONLY number that goes to Schoology — one combined score per lesson, not
one per sub-activity. Ignore every other column in this file entirely.

**The grading rule** (confirmed with the teacher, Nov 2026 — ask if it
still applies before reusing this on a much later request, since grading
policies can change): the Schoology score is the Lesson Grade percentage
**plus 10, capped at 100**:
```
schoology_score = min(100, lesson_grade_percent + 10)
```
e.g. 90.6% → 100 (100.6 capped). 83.4% → 93.4. 0% stays 0 (not negative,
never below the raw value — the +10 only ever helps).

This produces exactly **one** output column. Ask the teacher what that
assignment is actually titled in Schoology (it changes every
chapter/lesson — e.g. "Lección 1 Práctica", "Lección 2 Práctica") if they
haven't already said, since the header must match that title exactly.

**Encoding**: VHL's own export is routinely **not valid UTF-8** — it's
Windows-1252/Latin-1, so accented characters come out corrupted
("Práctica" → "Pr�ctica") if read naively as UTF-8. Detect and decode it
correctly so names and output stay accurate.

### 3. A KWL Hub export ("Student_Summary_Report" style)
Columns: `First Name, Last Name, Student Average, <Assignment 1>,
<Assignment 2>, ...` — one row per student, one column per **real
assignment already in Schoology** (the header text is the exact
assignment title — carry it through unchanged). Values are percentages
as text (`"91.67%"`, `"Not Attempted"`) or occasionally blank.

- Strip the `%` and convert to a plain number (`"91.67%"` → `91.67`).
- `"Not Attempted"` → blank cell in the output (ungraded, not a 0) —
  confirmed explicitly with the teacher.
- **Drop the trailing "Average Assessment Score" row** (and any other
  row whose first/last name is blank or is itself a summary label) — that
  row is a class-wide average, not a student.
- A **"Class_Summary_Report"**-style file (one row per *class*, not per
  *student*) is a DIFFERENT export from the same platform and has NO
  per-student data at all — if that's what's attached instead, say so and
  ask for the per-student "Student Summary Report" export instead. Don't
  attempt to convert it.
- If the teacher provides more than one KWL file (e.g. one per class
  level — HL and SL sections that get combined into one Schoology
  course), merge every student from every file into one combined output
  rather than producing separate files, unless asked otherwise.

## Building the output

1. Build the Name→ID lookup from every roster file attached.
2. For each VHL file: compute the one derived score per matched student.
3. For each KWL file: carry through every assignment column per matched
   student, applying the %-strip / blank-for-not-attempted rules.
4. Union all the resulting assignment columns (VHL's derived column, if
   any, plus every real KWL assignment column) into one header row,
   `Unique User ID` first.
5. One row per student who had at least one matched score across all
   attached files. A student present in one file but not another just
   gets a blank cell for the columns they have no data for — never a 0.
6. Report, in your reply (not just the file), any name that failed to
   match a roster row, and the total student/column counts so the
   teacher can sanity-check at a glance before importing.
7. Deliver the result as an actual downloadable `.csv` file (UTF-8,
   comma-separated, quoted fields where needed) — this gets uploaded
   as-is into Schoology, not retyped.

## Important

- Never invent or rename an assignment title. If a KWL column's title
  doesn't look like it could plausibly already exist in Schoology, ask
  rather than guess — a column Schoology can't match by exact title
  silently does nothing.
- Never include a row with a blank or guessed Unique User ID.
- When in doubt about a transformation rule changing (the VHL +10%
  formula, which KWL columns map to real assignments, how a new source
  platform's export is shaped), ask rather than assume today's rules
  still apply forever — this document reflects what was confirmed when
  it was written, not a platform guarantee.
