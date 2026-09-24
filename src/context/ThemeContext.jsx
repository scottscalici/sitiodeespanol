import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCachedCollection } from '../utils/firestoreCache';
import { loadGoogleFont } from '../utils/loadGoogleFont';

const ThemeContext = createContext(null);

// This is the hook other components use to read the active seasonal theme.
export function useActiveTheme() {
  return useContext(ThemeContext);
}

// A theme is "active" once its start/end (MM-DD) window contains today.
// Themes without both dates (e.g. "classic", or a one-off not yet scheduled)
// are never picked by date — "classic" is instead the explicit fallback when
// nothing else matches, so the app looks exactly as it always has until a
// dated theme's window opens.
const resolveActiveTheme = (themes, todayMD) => {
  const dated = themes.find((t) => t.start && t.end && todayMD >= t.start && todayMD <= t.end);
  if (dated) return dated;
  return themes.find((t) => t.id === 'classic') || null;
};

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

  useEffect(() => {
    const root = document.documentElement;
    const accent = theme?.styles?.accent;
    const fontHeading = theme?.styles?.fontHeading;
    if (accent) root.style.setProperty('--accent', accent);
    if (fontHeading) {
      loadGoogleFont(fontHeading);
      root.style.setProperty('--font-heading', fontHeading.includes(',') ? fontHeading : `'${fontHeading}', sans-serif`);
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, loaded }}>{children}</ThemeContext.Provider>;
}
