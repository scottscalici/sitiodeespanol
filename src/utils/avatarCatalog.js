// Student avatar generation — self-hosted DiceBear (no hosted-API calls, no
// network dependency), locked to one style for v1 so the picker is "choose
// hair/eyes/etc." rather than "first choose an entire different art style."
// Every DiceBear built-in part (hair, eyes, colors, ...) is freely available
// to every student — only Scott's own uploaded overlay accessories (see
// `unlockables`'s `avatar_accessory` type) are points-gated. Keeping the
// stock DiceBear art ungated avoids needing to hand-curate "which of the 43
// hair variants count as free" one at a time in an admin screen.
import { createAvatar } from '@dicebear/core';
// Named exports only (meta/create/schema) — no default export, so this has
// to be a namespace import, not `import adventurerStyle from '...'`.
import * as adventurerStyle from '@dicebear/adventurer';

export const AVATAR_STYLE_ID = 'adventurer';

const schemaProps = adventurerStyle.schema.properties;

// Each cyclable feature: `key` matches the DiceBear option name, `kind` is
// 'variant' (a named style id), 'color' (a hex swatch), or 'toggle' (an
// optional accessory that can also be turned off entirely via 'none').
export const AVATAR_FEATURES = [
  { key: 'hair', label: 'Pelo', kind: 'variant', options: schemaProps.hair.items.enum },
  { key: 'hairColor', label: 'Color de Pelo', kind: 'color', options: schemaProps.hairColor.default },
  { key: 'eyebrows', label: 'Cejas', kind: 'variant', options: schemaProps.eyebrows.items.enum },
  { key: 'eyes', label: 'Ojos', kind: 'variant', options: schemaProps.eyes.items.enum },
  { key: 'mouth', label: 'Boca', kind: 'variant', options: schemaProps.mouth.items.enum },
  { key: 'skinColor', label: 'Tono de Piel', kind: 'color', options: schemaProps.skinColor.default },
  { key: 'glasses', label: 'Lentes', kind: 'toggle', options: ['none', ...schemaProps.glasses.items.enum] },
  { key: 'earrings', label: 'Aretes', kind: 'toggle', options: ['none', ...schemaProps.earrings.items.enum] },
  { key: 'features', label: 'Detalles', kind: 'toggle', options: ['none', ...schemaProps.features.items.enum] },
];

// A fixed, sensible starting look — index 0 of every variant/color list,
// every toggle off. Used for a brand-new student's draft and as the
// fallback whenever `avatarConfig.options` is missing a key (e.g. a new
// feature added to this file after some students already saved an older,
// shorter options object).
export const DEFAULT_AVATAR_OPTIONS = Object.fromEntries(
  AVATAR_FEATURES.map((f) => [f.key, f.kind === 'toggle' ? 'none' : f.options[0]])
);

// Converts our flat `{hair: 'short01', glasses: 'none', ...}` shape into the
// array-wrapped options DiceBear expects. Wrapping a single value in a
// one-item array is DiceBear's own way of forcing an exact deterministic
// pick instead of letting it randomly sample from a pool — that's what
// makes "the same saved config always renders the same avatar" true.
function buildDicebearOptions(options) {
  const merged = { ...DEFAULT_AVATAR_OPTIONS, ...options };
  const out = {
    hair: [merged.hair],
    hairColor: [merged.hairColor],
    eyebrows: [merged.eyebrows],
    eyes: [merged.eyes],
    mouth: [merged.mouth],
    skinColor: [merged.skinColor],
  };
  for (const key of ['glasses', 'earrings', 'features']) {
    const value = merged[key];
    if (value && value !== 'none') {
      out[key] = [value];
      out[`${key}Probability`] = 100;
    } else {
      out[key] = [];
      out[`${key}Probability`] = 0;
    }
  }
  return out;
}

// Returns a raw SVG markup string. `seed` keeps a stable look for a student
// who hasn't customized anything yet (and keeps the shapes/positions of
// shared parts consistent between re-renders of the same config).
export function generateAvatarSvgMarkup(options, seed) {
  const avatar = createAvatar(adventurerStyle, { seed: seed || 'estudiante', ...buildDicebearOptions(options) });
  return avatar.toString();
}
