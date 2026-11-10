import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCachedCollection } from '../utils/firestoreCache';
import { loadGoogleFont } from '../utils/loadGoogleFont';
import { syncTextEffectPresets } from '../utils/textEffects';

// Exported so a day/lesson page (see Dashboard.jsx) can nest its own
// <ThemeContext.Provider> with a historical theme, and every descendant
// that calls useActiveTheme() picks it up automatically — no prop drilling.
export const ThemeContext = createContext(null);

// This is the hook other components use to read the active seasonal theme.
export function useActiveTheme() {
  return useContext(ThemeContext);
}

// Both dates matter only relative to each other here (no real year), so any
// fixed year works as long as it's used consistently for start and end.
const windowLengthDays = (start, end) => {
  const parse = (md) => {
    const [m, d] = md.split('-').map(Number);
    return Date.UTC(2000, m - 1, d);
  };
  return (parse(end) - parse(start)) / 86400000;
};

// A theme is "active" once its start/end (MM-DD) window contains the target
// date. Themes without both dates (e.g. "classic", or a one-off not yet
// scheduled) are never picked by date — "classic" is instead the explicit
// fallback when nothing else matches, so the app looks exactly as it always
// has until a dated theme's window opens.
//
// More than one theme's window can cover the same date at once — e.g. a
// specific one-week theme nested inside a month-long seasonal one — and
// there's no authored priority to break the tie, so the narrower/more
// specific window wins rather than whichever theme happens to come first
// in Firestore's return order (which isn't something a teacher controls or
// can predict, and previously meant changing a new theme's dates could
// silently have no visible effect if a broader theme already covered the
// same day).
const resolveActiveTheme = (themes, targetMD) => {
  const candidates = themes.filter((t) => t.start && t.end && targetMD >= t.start && targetMD <= t.end);
  if (candidates.length > 0) {
    return candidates.reduce((shortest, t) =>
      windowLengthDays(t.start, t.end) < windowLengthDays(shortest.start, shortest.end) ? t : shortest
    );
  }
  return themes.find((t) => t.id === 'classic') || null;
};

// "YYYY-MM-DD" -> "MM-DD", matching how theme start/end are authored.
const toMD = (dateStr) => (typeof dateStr === 'string' ? dateStr.slice(5) : null);

// A student's manually-chosen theme (e.g. unlocking "Calma" via points),
// kept in localStorage only — never Firestore, never shared across devices.
// Stored alongside the date-resolved theme id it was chosen under
// (`forThemeId`) so a holiday theme starting or ending automatically
// invalidates it: the student has to re-pick from the toggle if they still
// want their manual choice once the date-based theme underneath it changes.
const MANUAL_THEME_STORAGE_KEY = 'sde_theme_override';

const readManualOverride = () => {
  try {
    const raw = localStorage.getItem(MANUAL_THEME_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeManualOverride = (value) => {
  try {
    if (value) localStorage.setItem(MANUAL_THEME_STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(MANUAL_THEME_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, quota, etc.) — the toggle just won't
    // persist across reloads; the rest of the site still works.
  }
};

// A theme's optional `fontList` declares the weights a given family actually
// needs (e.g. a display font used only at 900) — without this every font
// loads at a generic 400;700, which may not even include the weight a bold
// display font was chosen for in the first place.
const weightsFor = (fontList, familyName) => {
  const clean = familyName?.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  const entry = fontList?.find((f) => f.name === clean);
  return entry?.weights?.length ? entry.weights : [400, 700];
};

// Each [cssVar, fallbackStack, legacyField, fontsField] — `fonts.*` is the
// current way to set a slot, the legacy flat field (fontHeading/fontMono)
// still works on its own for an older theme that never adopted `fonts`.
const FONT_SLOTS = [
  ['--font-heading', 'sans-serif', 'fontHeading', 'heading'],
  ['--font-mono', 'monospace', 'fontMono', null],
  ['--font-card-title', 'sans-serif', null, 'cardTitle'],
  ['--font-body', 'sans-serif', null, 'body'],
  ['--font-accent', 'sans-serif', null, 'accent'],
];

// Applies a theme's CSS custom properties to the document root, restoring
// whatever was there before on cleanup. This lets a nested, day-specific
// ThemeContext.Provider borrow the global styling slots while it's mounted
// without leaking into the rest of the app once it unmounts.
export function ThemeStyleSync({ theme }) {
  useEffect(() => {
    const root = document.documentElement;
    const accent = theme?.styles?.accent;
    const accentShades = theme?.styles?.accentShades;
    const fontList = theme?.styles?.fontList;

    const prevAccent = root.style.getPropertyValue('--accent');
    if (accent) root.style.setProperty('--accent', accent);

    // Optional — a theme with only `accent` (the common case) just doesn't
    // get these two extra vars, and anything reading them falls back to the
    // plain --accent value on its own.
    const prevAccentLight = root.style.getPropertyValue('--accent-light');
    const prevAccentDark = root.style.getPropertyValue('--accent-dark');
    if (accentShades?.light) root.style.setProperty('--accent-light', accentShades.light);
    if (accentShades?.dark) root.style.setProperty('--accent-dark', accentShades.dark);

    const prevValues = FONT_SLOTS.map(([cssVar]) => root.style.getPropertyValue(cssVar));
    FONT_SLOTS.forEach(([cssVar, fallbackStack, legacyField, fontsField]) => {
      const family = (fontsField && theme?.styles?.fonts?.[fontsField]) || (legacyField && theme?.styles?.[legacyField]);
      if (!family) return;
      loadGoogleFont(family, weightsFor(fontList, family));
      // Flags-only font first so 🇪🇸 still renders as a flag on Windows under
      // any theme font (see main.jsx).
      const stack = family.includes(',') ? family : `'${family}', ${fallbackStack}`;
      root.style.setProperty(cssVar, `'Twemoji Country Flags', ${stack}`);
    });

    const cleanupTextEffects = syncTextEffectPresets(theme?.styles?.textEffects?.presets);

    return () => {
      root.style.setProperty('--accent', prevAccent);
      root.style.setProperty('--accent-light', prevAccentLight);
      root.style.setProperty('--accent-dark', prevAccentDark);
      FONT_SLOTS.forEach(([cssVar], i) => root.style.setProperty(cssVar, prevValues[i]));
      cleanupTextEffects();
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

  // Lets the Theme Editor's "Vista Previa" button force a specific theme on
  // the real, live Dashboard (via a ?previewThemeId=<id> query param) so the
  // teacher can see exactly what students would see, instead of maintaining
  // a separate preview page that could drift out of sync. Falls back to the
  // normal date-based resolution if the id doesn't match any saved theme.
  const previewThemeId = useMemo(
    () => new URLSearchParams(window.location.search).get('previewThemeId'),
    []
  );
  const previewTheme = useMemo(
    () => (previewThemeId ? themes.find((t) => t.id === previewThemeId) : null),
    [themes, previewThemeId]
  );

  // The theme today's date alone resolves to — this is what "Clásico" means
  // in the toggle (the site's normal current theme, holiday or not), and
  // what a manual override is checked against to see if it's still valid.
  const dateTheme = useMemo(
    () => (loaded ? resolveActiveTheme(themes, todayMD) : null),
    [themes, loaded, todayMD]
  );

  const [manualOverride, setManualOverrideState] = useState(readManualOverride);
  const isOverrideStale = !!manualOverride && !!dateTheme && manualOverride.forThemeId !== dateTheme.id;

  // A holiday theme starting or ending always "takes over" automatically —
  // `manualTheme` below already treats a stale override as if it weren't
  // there; this effect just tidies up localStorage to match (an external
  // system, not React state, so no render loop needed to do it).
  useEffect(() => {
    if (isOverrideStale) writeManualOverride(null);
  }, [isOverrideStale]);

  const manualTheme = useMemo(() => {
    if (!manualOverride || isOverrideStale) return null;
    return themes.find((t) => t.id === manualOverride.themeId) || null;
  }, [manualOverride, isOverrideStale, themes]);

  // A Vista Previa override wins unconditionally (same as before); otherwise
  // a still-valid manual choice wins; otherwise the plain date resolution.
  const theme = useMemo(
    () => (loaded ? previewTheme || manualTheme || dateTheme : null),
    [loaded, previewTheme, manualTheme, dateTheme]
  );
  const isPreviewing = !!previewTheme;

  // Lets a student's theme toggle (see Header.jsx) switch to an unlocked
  // theme by id, or back with themeId=null. Does nothing while themes
  // haven't loaded yet — there'd be no dateTheme.id to anchor the choice to.
  const setManualTheme = (themeId) => {
    if (!dateTheme) return;
    const next = themeId ? { themeId, forThemeId: dateTheme.id } : null;
    setManualOverrideState(next);
    writeManualOverride(next);
  };

  // Lets a descendant resolve the theme active on ANY date, not just today —
  // e.g. a specific lesson day's own calendar date, so browsing an old day
  // shows that day's own era-correct theme instead of whatever's active now.
  //
  // A Vista Previa override must win here too, unconditionally — without
  // this check, navigating the día selector away from "today" (e.g. in
  // Dashboard.jsx) silently drops the preview and falls back to whatever
  // theme that OTHER day's real calendar date resolves to, which defeats
  // the entire point of "see exactly what this forced theme looks like."
  const resolveThemeForDate = useMemo(() => {
    return (dateStr) => {
      if (previewTheme) return previewTheme;
      const md = toMD(dateStr);
      if (!md || !loaded) return null;
      return resolveActiveTheme(themes, md);
    };
  }, [themes, loaded, previewTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        loaded,
        resolveThemeForDate,
        isPreviewing,
        resolvedThemeId: dateTheme?.id || null,
        manualThemeId: manualTheme?.id || null,
        setManualTheme,
      }}
    >
      <ThemeStyleSync theme={theme} />
      {children}
    </ThemeContext.Provider>
  );
}
