---
name: theme-importer
description: Turns a screenshot or reference image of a visual design/site into a ready-to-paste JSON blob for Sitio de Español's theme system — specifically the "Importar Estilos (JSON)" paste-box in the Temas admin tool (src/admin/MasterDashboard/components/FormTemas.jsx), which merges the JSON straight into a seasonal/special theme's `styles` object. Use this whenever the user, a Spanish teacher, shares an image of a design, site, or color palette they like and asks to turn it into a theme, make the site look like it, adapt/mimic/pull from it, or build a Tema from it — even if they only say something like "can we make a theme based on this?" or paste an image with "this but for my site." Always produce the finished JSON object directly, not a description of what a theme could look like — the teacher pastes the output straight into the admin tool.
---

# Theme importer (screenshot → Temas JSON)

Analyzes one or more reference images (a screenshot of a site, a mood image,
a single UI pattern — anything visual) and outputs a single JSON object
that merges into a theme's `styles` field in Sitio de Español's `temas`
Firestore collection, via the paste-box importer in `FormTemas.jsx`. It
never talks to the codebase or Firestore directly — the teacher copies the
JSON this skill produces and pastes it into that box herself.

## Why the output is scoped the way it is

The paste-box only accepts color, font, and layout fields — never an
image-URL field (`imageOverrides`, `textures`, `hero.img`, mascot URLs).
That's not an arbitrary restriction: a screenshot-analysis skill has no way
to produce a real, hosted image, so attempting one would mean inventing a
broken URL. The one apparent exception, `bgTexture`, isn't really an
exception — it's a self-contained `data:image/svg+xml` URI built by hand
from a small SVG, not a hosted file, so it's genuinely producible from
scratch (see the background texture section below).

## Output format

Produce exactly one JSON object with a subset of these keys — include only
the ones you have a confident answer for, but `header`, `accent`,
`fontHeading`, and `fontMono` should almost always be answerable from any
reasonably clear reference image:

```json
{
  "header": "bg-gradient-to-r from-[#1a0033] via-[#ff6b00] to-[#000000]",
  "accent": "#ff6b00",
  "fontHeading": "Creepster",
  "fontMono": "JetBrains Mono",
  "bgTexture": "data:image/svg+xml,%3Csvg ...%3E",
  "cardOverrides": {
    "calentamiento": "#2a0845",
    "evaluacion": "#1a0033"
  }
}
```

Respond with just that JSON (a fenced code block is fine, for easy
copying) plus 1-3 sentences on the key choices you made and why. Don't ask
clarifying questions first or hedge with "it depends" — give your best
reading of the image and let the teacher ask for adjustments after seeing
it, the same way she'd redirect a human designer's first draft.

If given several images, read them as one moodboard and output a single
coherent theme, not one per image.

## Field-by-field

**`header`** — a literal Tailwind gradient utility class string applied
directly as a className (e.g. `bg-gradient-to-r from-X via-Y to-Z`),
approximating the dominant gradient or color across the image's header/hero
area. Use arbitrary-value bracket syntax (`from-[#1a0033]`) rather than
hunting for the closest named Tailwind swatch — matching the real color the
teacher is reacting to matters more than using a "proper" Tailwind color
name. Pick a direction (`to-r`, `to-br`, `to-t`, …) that matches the
image's actual gradient direction, or default to `to-r` if the source is a
flat color or the direction isn't legible.

**Critical constraint: the header always renders fixed white text on top**
(`text-white`, `text-white/60`, hardcoded in `Header.jsx` — not themeable,
not something this JSON can change). So every stop in this gradient needs
to be dark/saturated enough for white text to stay legible on it, no
matter what the reference image's own palette looks like. For a vivid or
already-dark image this falls out naturally. For a pale, minimal, or
mostly-white reference image (a clean gallery site, a light mood board),
do NOT copy its literal background color — that produces white-on-white.
Instead, pull the header color from whatever in the image is actually dark
or saturated (its ink/text color, a logo mark, a single bold accent), even
if that color is a small detail rather than the dominant one. A plain
black-on-white design, for instance, should still get a dark (often
near-black) header, using its own ink as the fill — that keeps the
design's spirit without breaking legibility. If you genuinely can't find
anything dark enough in the image to build a gradient from, fall back to a
deep neutral (e.g. `from-[#111111] via-[#1a1a1a] to-[#000000]`) rather
than defaulting to the image's pale background.

**`accent`** — one hex color: the single most representative brand/accent
color in the image, the one you'd point to if someone asked "what color is
this theme." This drives button highlights, active states, and borders
throughout the site, so pick the color that's doing the most *work* in the
image (a repeated highlight, a call-to-action color), not just the most
*common* color (a neutral background tint usually isn't it).

**`fontHeading`** — a real, currently-available Google Fonts family name
whose personality matches the image's main display/heading type: condensed
vs. wide, bold vs. light, serif vs. sans vs. script vs. display/decorative.
Name an actual font — don't invent one, and don't default to a generic
system font unless the image genuinely uses a plain, neutral sans-serif.

**`fontMono`** — a second, distinct Google Font for small all-caps labels
and badges (card tags, stat chips). It doesn't have to be a literal
monospace font — pick whatever reads well small and uppercase and fits the
image's secondary/label typography, which is often a geometric sans even
when the brand doesn't use a true mono anywhere visible.

**`cardOverrides`** (optional) — a map from a subset of the card keys below
to hex colors. Only include keys where a specific color genuinely makes
sense; don't force every key just to fill the object. Default to variations
in shade/tint of the accent color across cards rather than scattering
unrelated hues, unless the reference image itself clearly uses a
multi-color tile/card system (e.g. a dashboard with deliberately
color-coded categories).

Valid keys: `calentamiento`, `evaluacion`, `anuncios`, `lectura`,
`conversacion`, `video`, `musica`, `vocabulario`, `tareas`, `countdown`,
`recursos`, `practicaCard`, `curiosidad`, `estructura`, `notaGramatica`,
`practica`, `learningPath`, `recreo`, `leaderboard`.

**`bgTexture`** (optional) — a decorative pattern tiled behind the entire
site at a faint ~6% opacity (the app applies that fade itself, so build the
SVG with normal, fully-opaque strokes/fills — don't pre-fade it yourself).
Only include this when the reference image has an actual decorative motif
worth echoing (a cobweb, falling leaves, a geometric grid, waves) — skip it
for a plain photo or a UI screenshot with no textural pattern to borrow.
Read `references/svg-textures.md` before building one: it has the exact
method for turning a simple motif into a self-contained data URI by hand,
plus several worked examples to adapt rather than start from scratch.

## Never include

`archedCards`, `imageOverrides`, `textures`, `hero`, `mascots` — the first
is a deprecated field the teacher chose to stop using, and the rest are all
image-URL fields the importer deliberately excludes for the reason above.
Including any of them (even as an empty value) just adds noise to what she
has to review before pasting.
