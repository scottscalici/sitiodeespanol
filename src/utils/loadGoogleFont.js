// Dynamically loads a Google Font family the first time a theme asks for it,
// so seasonal themes can reference any font without every family having to
// be preloaded in index.html up front.
//
// Keyed by name+weights (not just name) so a later call asking for different
// weights of a font already loaded at the default 400;700 isn't silently
// dropped as a duplicate — e.g. a theme's fontList declaring a display font
// at weight 900 after fontHeading already pulled it in at 400;700.
const loadedFonts = new Set();

export const loadGoogleFont = (family, weights = [400, 700]) => {
  if (!family) return;
  // Theme docs sometimes store a full CSS font-family stack (e.g. "'Berkshire
  // Swash', cursive") instead of a bare name — only the first, real family
  // name needs to be fetched from Google Fonts.
  const cleanName = family.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  if (!cleanName) return;
  const weightKey = [...new Set(weights)].sort((a, b) => a - b).join(';');
  const cacheKey = `${cleanName}:${weightKey}`;
  if (loadedFonts.has(cacheKey)) return;
  loadedFonts.add(cacheKey);

  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(cleanName).replace(/%20/g, '+')}:wght@${weightKey}&display=swap`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
};
