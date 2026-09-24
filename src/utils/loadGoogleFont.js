// Dynamically loads a Google Font family the first time a theme asks for it,
// so seasonal themes can reference any font without every family having to
// be preloaded in index.html up front.
const loadedFonts = new Set();

export const loadGoogleFont = (family) => {
  if (!family) return;
  // Theme docs sometimes store a full CSS font-family stack (e.g. "'Berkshire
  // Swash', cursive") instead of a bare name — only the first, real family
  // name needs to be fetched from Google Fonts.
  const cleanName = family.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  if (!cleanName || loadedFonts.has(cleanName)) return;
  loadedFonts.add(cleanName);

  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(cleanName).replace(/%20/g, '+')}:wght@400;700&display=swap`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
};
