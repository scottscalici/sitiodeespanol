import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCachedCollection } from '../utils/firestoreCache';
import { loadGoogleFont } from '../utils/loadGoogleFont';

// Exported so a day/lesson page (see Dashboard.jsx) can nest its own
// <ThemeContext.Provider> with a historical theme, and every descendant
// that calls useActiveTheme() picks it up automatically — no prop drilling.
export const ThemeContext = createContext(null);

// This is the hook other components use to read the active seasonal theme.
export function useActiveTheme() {
  return useContext(ThemeContext);
}

// A theme is "active" once its start/end (MM-DD) window contains the target
// date. Themes without both dates (e.g. "classic", or a one-off not yet
// scheduled) are never picked by date — "classic" is instead the explicit
// fallback when nothing else matches, so the app looks exactly as it always
// has until a dated theme's window opens.
const resolveActiveTheme = (themes, targetMD) => {
  const dated = themes.find((t) => t.start && t.end && targetMD >= t.start && targetMD <= t.end);
  if (dated) return dated;
  return themes.find((t) => t.id === 'classic') || null;
};

// "YYYY-MM-DD" -> "MM-DD", matching how theme start/end are authored.
const toMD = (dateStr) => (typeof dateStr === 'string' ? dateStr.slice(5) : null);

// Applies a theme's CSS custom properties to the document root, restoring
// whatever was there before on cleanup. This lets a nested, day-specific
// ThemeContext.Provider borrow the global styling slots while it's mounted
// without leaking into the rest of the app once it unmounts.
export function ThemeStyleSync({ theme }) {
  useEffect(() => {
    const root = document.documentElement;
    const prevAccent = root.style.getPropertyValue('--accent');
    const prevFont = root.style.getPropertyValue('--font-heading');
    const accent = theme?.styles?.accent;
    const fontHeading = theme?.styles?.fontHeading;
    if (accent) root.style.setProperty('--accent', accent);
    if (fontHeading) {
      loadGoogleFont(fontHeading);
      root.style.setProperty('--font-heading', fontHeading.includes(',') ? fontHeading : `'${fontHeading}', sans-serif`);
    }
    return () => {
      root.style.setProperty('--accent', prevAccent);
      root.style.setProperty('--font-heading', prevFont);
    };
  }, [theme]);

  return null;
}

export function ThemeProvider({ children }) {
  const [themes, setThemes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCachedCollection('temas')
      .then(setThemes)
      .catch((err) => console.error('Error loading temas:', err))
      .finally(() => setLoaded(true));
  }, []);

  // MM-DD of today, in the local timezone (matches how theme start/end are authored).
  const todayMD = useMemo(() => new Date().toLocaleDateString('en-CA').slice(5), []);
  const theme = useMemo(() => (loaded ? resolveActiveTheme(themes, todayMD) : null), [themes, loaded, todayMD]);

  // Lets a descendant resolve the theme active on ANY date, not just today —
  // e.g. a specific lesson day's own calendar date, so browsing an old day
  // shows that day's own era-correct theme instead of whatever's active now.
  const resolveThemeForDate = useMemo(() => {
    return (dateStr) => {
      const md = toMD(dateStr);
      if (!md || !loaded) return null;
      return resolveActiveTheme(themes, md);
    };
  }, [themes, loaded]);

  return (
    <ThemeContext.Provider value={{ theme, loaded, resolveThemeForDate }}>
      <ThemeStyleSync theme={theme} />
      {children}
    </ThemeContext.Provider>
  );
}
