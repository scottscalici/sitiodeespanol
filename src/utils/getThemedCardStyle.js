// Inline style for a "solid gradient CTA card" (Calentamiento, Evaluación,
// Lectura, and the Dashboard's inline conversación/video/música/vocabulario/
// tareas cards) when a seasonal theme overrides its color. Returns undefined
// when there's no override, so the component's own default Tailwind gradient
// classes show through untouched.
export const getThemedCardStyle = (color, accent, textureUrl) => {
  if (!color) return undefined;
  const gradient = `linear-gradient(135deg, ${color}, ${accent || color})`;
  if (!textureUrl) return { background: gradient };
  return {
    backgroundImage: `url('${textureUrl}'), ${gradient}`,
    backgroundRepeat: 'no-repeat, no-repeat',
    backgroundPosition: 'bottom right 10px, 0 0',
    backgroundSize: '70px, auto',
    backgroundBlendMode: 'soft-light, normal',
  };
};
