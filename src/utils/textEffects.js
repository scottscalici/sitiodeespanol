// A theme can define a small library of reusable, named CSS animations
// (e.g. a candle "flicker" on a title, a button, a badge — anywhere) instead
// of a one-off static shadow/glow value. The actual @keyframes only exist as
// theme data, so they have to be injected into the page the same way a
// theme's fonts are — this just does it with a <style> tag instead of a
// Google Fonts <link>.
const STYLE_TAG_ID = 'theme-text-effect-presets';

// Builds the full stylesheet text for every preset a theme defines, keyed
// by preset name so unrelated presets across different themes never collide
// (the tag's content is replaced wholesale on every theme change, so a
// previous theme's presets don't linger either).
const buildPresetCss = (presets) =>
  Object.entries(presets || {})
    .map(([name, preset]) => `@keyframes theme-effect-${name} { ${preset.keyframes} }`)
    .join('\n');

// Called from ThemeStyleSync alongside the other per-theme side effects —
// creates the <style> tag once, then just swaps its content on every theme
// change. Returns a cleanup function that removes the tag, matching the
// pattern every other per-theme effect here already follows.
export const syncTextEffectPresets = (presets) => {
  let tag = document.getElementById(STYLE_TAG_ID);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = buildPresetCss(presets);
  return () => {
    tag.textContent = '';
  };
};

// What a component actually applies to opt an element into a theme's named
// effect — e.g. <h1 style={getTextEffectStyle(theme, 'headerTitle')}>. Looks
// up which preset (if any) a theme assigned to this slot, and only returns
// an `animation` property when both the assignment and the preset it points
// to actually exist — an unrelated theme, or a theme that doesn't use this
// slot, gets undefined and the element is unaffected.
export const getTextEffectStyle = (theme, slotName) => {
  const presetName = theme?.styles?.textEffects?.assignments?.[slotName];
  if (!presetName) return undefined;
  const preset = theme?.styles?.textEffects?.presets?.[presetName];
  if (!preset) return undefined;
  return { animation: `theme-effect-${presetName} ${preset.duration || '2s'} ease-in-out infinite` };
};
