# Theme system

A "tema" is a Firestore document (collection `temas`) that can restyle the
whole student-facing site for a date window — colors, fonts, borders,
page background, decorative corner icons, a bigger cobweb-style overlay,
and a floating particle layer. Two fully worked examples live next to this
file: `docs/themes/halloween.json` and `docs/themes/calma.json` — read
those alongside this doc, they show every field actually in use at once.

Every field below is optional. A theme that sets nothing beyond `accent`
and `fontHeading` is just as valid as one using everything — the app
always falls back to its current default look for anything a theme
doesn't set.

## Adding a new theme

1. Open the Temas tool in the admin dashboard, click **"+ Nuevo Tema"**
   (this matters — pasting into an already-loaded theme edits *that* one
   instead of creating a new one).
2. Give it a name and a start/end date (`MM-DD`, no year — it recurs every
   year). Leave both blank if you just want to preview it on demand
   without it ever auto-activating.
3. Paste a full `styles` JSON block (see the two example files) into the
   **"Importar Estilos (JSON)"** box and click **Aplicar JSON**. This only
   touches color/font/layout-type fields — it never writes an image URL,
   so `imageOverrides`, `textures`, `hero.img`, mascot URLs, and the
   theme's own name/dates all still need to be set by hand in their own
   fields.
4. Save, then click **"👁️ Vista Previa"** to see exactly what students
   would see, regardless of today's actual date.

**If two themes' date windows overlap** (a one-week theme nested inside a
month-long seasonal one, say), the narrower window wins automatically —
you don't need to avoid overlaps on purpose.

## Adding a new font

Add it in two places:

```json
"fonts": { "cardTitle": "Jolly Lodger" },
"fontList": [{ "name": "Jolly Lodger", "weights": [400] }]
```

`fonts` has four slots — `heading` (also settable as the older flat
`fontHeading` field), `cardTitle`, `body`, `accent` — each becomes a CSS
variable (`--font-heading`, `--font-card-title`, etc.) that the app loads
from Google Fonts automatically. `fontList` is what tells the app which
*weights* to actually fetch for a given family — skip it and you get a
generic 400/700, which may not include the weight you picked the font for
in the first place (a lot of display/decorative fonts only exist at one
specific weight).

## Adding a corner decoration or a big overlay

These are two different sized things:

- **`cornerDecorations`** — a small badge in one corner of a card (an
  emoji, or an SVG you host yourself).
- **`cardOverlays`** — a bigger decorative layer (a cobweb, say), anchored
  to a corner or the whole card.

Both share the same shape: a `default` (applies to every themed card) plus
a `perCard` map for exceptions — set a card's key to an object to override
just that card, or to `null` to explicitly turn it off for that one card
while every other card still gets the default.

```json
"cornerDecorations": {
  "default": { "type": "emoji", "value": "🦇", "corner": "top-right", "size": 26, "opacity": 0.5 },
  "perCard": { "evaluacion": { "type": "emoji", "value": "💀", "corner": "top-right" }, "tareas": null }
}
```

An emoji needs nothing else — just pick one. An SVG needs a real URL
(upload it somewhere, or hand-build a `data:image/svg+xml,...` URI the way
`halloween.json`'s cobweb overlay does, which needs no hosting at all).
Set `"useCurrentColor": true` on a corner decoration to recolor an SVG
silhouette to match the theme (it gets masked by its own shape and filled
with whatever color you give it) instead of showing the SVG's own colors.

`cardOverlays` additionally takes `flip` (mirror horizontally) and `tint`
(wash a color over the artwork's own shading, masked to the artwork's
shape — it won't paint outside the image's own silhouette).

Valid card keys for either: `calentamiento`, `evaluacion`, `anuncios`,
`lectura`, `conversacion`, `video`, `musica`, `vocabulario`, `tareas`,
`countdown`, `recursos`, `practicaCard`, `curiosidad`, `estructura`,
`notaGramatica`, `practica`, `learningPath`, `recreo`, `leaderboard`,
`destacado`.

**Not every card can show everything.** A handful of cards (Curiosidad,
Grammar Notes, Practice Hub, Learning Path, El Recreo's sidebar,
Leaderboard/Hall of Fame) have their own hand-built color/heading-text
treatment that predates `cardStyles` — they'll show corner decorations and
overlays fine, but setting `cardStyles`/`cardStyleAssignments` for them
won't change their background or text color, since forcing the generic
gradient-fill style onto them would actually look worse than what they
already do. Everything else responds to the full set of fields.

## Named card styles vs. the older flat color

`cardOverrides` (a flat `{ "calentamiento": "#ff6b00" }`) still works
exactly as before — a single color per card. `cardStyles` is the richer
option: a named bundle of background + text + heading + border colors,
assigned to specific cards (`cardStyleAssignments`) or auto-rotated across
whichever cards don't have an explicit assignment (`cardStyleRotation`,
picked by a stable hash of the card's key so the same card always lands on
the same style). A named style's `background` wins over a flat
`cardOverrides` entry for the same card if both are set.

## The animated floating layer

`animatedLayer.particles` is a list — each entry is its own independent
species (its own emoji, color, speed, direction, size range, count), all
sharing one canvas, so a theme can float bats and ghosts at once instead
of being stuck with one. Leave it out entirely for a theme with no
animation (see `calma.json`). The older single-species `effectConfig`
(still editable via the simple admin controls, not the JSON box) keeps
working as the fallback when a theme doesn't set `animatedLayer`.

## Using the theme-importer skill

There's a Claude Skill (`theme-importer`) that takes a screenshot or
reference image and outputs a ready-to-paste `styles` JSON block matching
everything above except image-URL fields (corner decorations/overlays
included) and `archedCards` (deprecated) — those need your own judgment,
not a guess from a picture.
