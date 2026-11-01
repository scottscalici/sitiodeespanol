// Inline style for a "solid gradient CTA card" (Calentamiento, Evaluación,
// Lectura, and the Dashboard's inline conversación/video/música/vocabulario/
// tareas cards) when a seasonal theme overrides its color. Returns undefined
// when there's no override, so the component's own default Tailwind gradient
// classes show through untouched.
//
// Double-quoting the url() wrapper matters here: an SVG data URI (the theme-
// importer skill's bgTexture output, and now corner decorations/overlays)
// always uses single quotes for its own attributes — `url('${x}')` would
// terminate at the SVG's first internal quote, silently truncating the
// style and dropping the whole property (confirmed via React's inline-style
// assignment, not just a theoretical CSS-parsing concern).
export const getThemedCardStyle = (color, accent, textureUrl) => {
  if (!color) return undefined;
  const gradient = `linear-gradient(135deg, ${color}, ${accent || color})`;
  if (!textureUrl) return { background: gradient };
  return {
    backgroundImage: `url("${textureUrl}"), ${gradient}`,
    backgroundRepeat: 'no-repeat, no-repeat',
    backgroundPosition: 'bottom right 10px, 0 0',
    backgroundSize: '70px, auto',
    backgroundBlendMode: 'soft-light, normal',
  };
};
