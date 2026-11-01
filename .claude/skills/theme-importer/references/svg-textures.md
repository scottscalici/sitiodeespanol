# Building a `bgTexture` data URI by hand

`bgTexture` has to be a single JSON string with no external dependencies —
no uploaded file, no hosting. The way to make that work is a **URL-encoded
SVG data URI**: `data:image/svg+xml,<percent-encoded SVG markup>`. This is
a real, widely-used CSS trick (not a workaround) — browsers render it
exactly like any other background image, and because it's just encoded
text, you can construct it by hand with no tool, in any environment this
skill runs in, with no risk of a base64 encoding slipping out of sync with
the actual bytes.

(If you happen to have code execution available, base64 — `data:image/svg
+xml;base64,<base64 of the SVG>` — works too and is slightly more
compact for complex SVGs. For these simple tileable patterns, URL-encoding
by hand is reliable and tool-free, so default to it unless you have a good
reason not to.)

## The method

1. **Write a tiny, tileable SVG.** Keep the `viewBox` small (40–120 units
   square) and the shape count low (1–4 paths/shapes) — this repeats across
   the whole page at ~6% opacity, so detail beyond a glance is wasted.
   Design it so the pattern reads as continuous when tiled: either keep
   shapes fully inside the viewBox with even margins, or deliberately let
   them run off two opposite edges so they reconnect on the next tile.

2. **Use a single explicit color**, not `currentColor` — this is a plain
   CSS `background-image`, not inline markup, so there's no surrounding
   element to inherit from. Any solid hex works; the app's own opacity
   fade means you don't need to pick a "light" or "muted" version
   yourself — pick whatever reads clearly at full strength (often the
   theme's own accent color, or a simple black/white depending on the
   site's base background).

3. **Percent-encode only the characters that break a data URI**, and
   write everything else as normal SVG markup:
   - `<` → `%3C`, `>` → `%3E`
   - `#` → `%23` (needed for hex colors like `#ff6b00`)
   - `"` → use single quotes (`'`) for all attribute values instead, so you
     never need to encode a quote character at all
   - space → `%20`
   - Leave `/`, `=`, `.`, `,`, `-`, digits, and letters as-is — they're
     safe in a data URI.

4. **Assemble it**: `data:image/svg+xml,` + the encoded markup, as one
   unbroken string, no line breaks.

## Worked example 1 — cobweb (spooky/Halloween theme)

Source SVG (single color `#1a1a1a`, a quarter-cobweb radiating from one
corner so it tiles into a continuous web across the grid):

```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>
  <g fill='none' stroke='#1a1a1a' stroke-width='1'>
    <path d='M0 0 L80 80 M0 20 L60 80 M0 40 L40 80 M0 60 L20 80 M20 0 L80 60 M40 0 L80 40 M60 0 L80 20'/>
    <path d='M0 0 Q20 20 10 40 Q25 25 40 40 Q25 55 40 60 Q55 55 60 60 Q55 75 80 80'/>
  </g>
</svg>
```

Encoded result (ready to use as `bgTexture`):

```
data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2080%2080'%3E%3Cg%20fill='none'%20stroke='%231a1a1a'%20stroke-width='1'%3E%3Cpath%20d='M0%200%20L80%2080%20M0%2020%20L60%2080%20M0%2040%20L40%2080%20M0%2060%20L20%2080%20M20%200%20L80%2060%20M40%200%20L80%2040%20M60%200%20L80%2020'/%3E%3Cpath%20d='M0%200%20Q20%2020%2010%2040%20Q25%2025%2040%2040%20Q25%2055%2040%2060%20Q55%2055%2060%2060%20Q55%2075%2080%2080'/%3E%3C/g%3E%3C/svg%3E
```

## Worked example 2 — scattered dots (confetti/festive theme)

Source SVG (`#ffffff` dots, loosely scattered so the tile doesn't look like
an obvious repeating grid):

```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'>
  <g fill='#ffffff'>
    <circle cx='8' cy='10' r='2'/>
    <circle cx='32' cy='6' r='1.5'/>
    <circle cx='48' cy='22' r='2'/>
    <circle cx='18' cy='34' r='1.5'/>
    <circle cx='42' cy='46' r='2'/>
    <circle cx='6' cy='52' r='1.5'/>
    <circle cx='55' cy='50' r='1.5'/>
  </g>
</svg>
```

Encoded result:

```
data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2060%2060'%3E%3Cg%20fill='%23ffffff'%3E%3Ccircle%20cx='8'%20cy='10'%20r='2'/%3E%3Ccircle%20cx='32'%20cy='6'%20r='1.5'/%3E%3Ccircle%20cx='48'%20cy='22'%20r='2'/%3E%3Ccircle%20cx='18'%20cy='34'%20r='1.5'/%3E%3Ccircle%20cx='42'%20cy='46'%20r='2'/%3E%3Ccircle%20cx='6'%20cy='52'%20r='1.5'/%3E%3Ccircle%20cx='55'%20cy='50'%20r='1.5'/%3E%3C/g%3E%3C/svg%3E
```

## Worked example 3 — gentle waves (beach/summer theme)

Source SVG (two offset sine-like strokes in `#0ea5e9`, each running off the
left/right edges at the same height so they connect tile-to-tile):

```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40'>
  <g fill='none' stroke='#0ea5e9' stroke-width='2'>
    <path d='M0 10 Q25 0 50 10 T100 10'/>
    <path d='M0 28 Q25 18 50 28 T100 28'/>
  </g>
</svg>
```

Encoded result:

```
data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%2040'%3E%3Cg%20fill='none'%20stroke='%230ea5e9'%20stroke-width='2'%3E%3Cpath%20d='M0%2010%20Q25%200%2050%2010%20T100%2010'/%3E%3Cpath%20d='M0%2028%20Q25%2018%2050%2028%20T100%2028'/%3E%3C/g%3E%3C/svg%3E
```

## Adapting to a new motif

1. Sketch the shape in plain SVG first (paths, circles, simple strokes —
   avoid gradients, filters, or anything requiring `<defs>`, which adds
   bulk for no visible gain at 6% opacity).
2. Pick ONE color that fits the theme.
3. Swap every `"` for `'` as you write it, so there's nothing left to
   re-quote.
4. Walk the string and replace exactly four things: `<` → `%3C`, `>` →
   `%3E`, `#` → `%23`, space → `%20`. Nothing else needs touching.
5. Prefix with `data:image/svg+xml,`.

A quick sanity check before handing it back: count the `<` and `%3C`
occurrences (and `>`/`%3E`) — they should match the original SVG's tag
count exactly. A mismatch almost always means a stray unencoded `<`/`>`
slipped through.
