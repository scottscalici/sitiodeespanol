import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_SECTIONS, DEFAULT_FAVORITES } from './adminLinks';

// Admin hub: a links-only grid of every admin page, grouped into sections.
// The links themselves live in ./adminLinks.js — add new pages there.

// Full class strings (not built dynamically) so Tailwind keeps them.
const SECTION_COLORS = {
  orange: { title: 'text-orange-400', border: 'border-orange-900/40', bg: 'bg-orange-950/20', hover: 'hover:border-orange-500/60 hover:bg-orange-950/40' },
  amber: { title: 'text-amber-400', border: 'border-amber-900/40', bg: 'bg-amber-950/20', hover: 'hover:border-amber-500/60 hover:bg-amber-950/40' },
  violet: { title: 'text-violet-400', border: 'border-violet-900/40', bg: 'bg-violet-950/20', hover: 'hover:border-violet-500/60 hover:bg-violet-950/40' },
  indigo: { title: 'text-indigo-400', border: 'border-indigo-900/40', bg: 'bg-indigo-950/20', hover: 'hover:border-indigo-500/60 hover:bg-indigo-950/40' },
  emerald: { title: 'text-emerald-400', border: 'border-emerald-900/40', bg: 'bg-emerald-950/20', hover: 'hover:border-emerald-500/60 hover:bg-emerald-950/40' },
  cyan: { title: 'text-cyan-400', border: 'border-cyan-900/40', bg: 'bg-cyan-950/20', hover: 'hover:border-cyan-500/60 hover:bg-cyan-950/40' },
  sky: { title: 'text-sky-400', border: 'border-sky-900/40', bg: 'bg-sky-950/20', hover: 'hover:border-sky-500/60 hover:bg-sky-950/40' },
  rose: { title: 'text-rose-400', border: 'border-rose-900/40', bg: 'bg-rose-950/20', hover: 'hover:border-rose-500/60 hover:bg-rose-950/40' },
  neutral: { title: 'text-neutral-400', border: 'border-neutral-800', bg: 'bg-neutral-900/40', hover: 'hover:border-neutral-500 hover:bg-neutral-900' },
};

const FAVORITES_KEY = 'adminHubFavorites';

const loadFavorites = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // Storage blocked or bad JSON — fall back to defaults.
  }
  return DEFAULT_FAVORITES;
};

const saveFavorites = (favs) => {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch {
    // Not fatal; favorites just won't persist in this browser.
  }
};

// Strip accents so "senordle" finds "Señordle" and "practica" finds "Práctica".
const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const HubLink = ({ link, colors, isFavorite, onToggleFavorite }) => (
  <div className={`group relative flex items-center rounded-lg border ${colors.border} bg-neutral-950 transition-colors ${colors.hover}`}>
    <Link to={link.to} className="flex-1 flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-neutral-200 hover:text-white min-w-0">
      <span className="shrink-0">{link.emoji}</span>
      <span className="truncate" title={link.label}>{link.label}</span>
    </Link>
    <button
      type="button"
      onClick={() => onToggleFavorite(link.to)}
      title={isFavorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos'}
      aria-label={isFavorite ? `Quitar ${link.label} de Favoritos` : `Añadir ${link.label} a Favoritos`}
      className={`shrink-0 px-2.5 py-2.5 text-sm transition-opacity ${isFavorite ? 'text-yellow-400 opacity-100' : 'text-neutral-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-yellow-400'}`}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  </div>
);

const DailyPlanHub = () => {
  const [favorites, setFavorites] = useState(loadFavorites);
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(ADMIN_SECTIONS.map((s) => [s.id, !s.collapsed]))
  );

  const allLinks = useMemo(
    () => ADMIN_SECTIONS.flatMap((s) => s.links.map((l) => ({ ...l, section: s }))),
    []
  );

  const toggleFavorite = (to) => {
    setFavorites((prev) => {
      const next = prev.includes(to) ? prev.filter((f) => f !== to) : [...prev, to];
      saveFavorites(next);
      return next;
    });
  };

  const favoriteLinks = favorites
    .map((to) => allLinks.find((l) => l.to === to))
    .filter(Boolean);

  const q = normalize(query.trim());
  const searchResults = q
    ? allLinks.filter((l) => normalize(`${l.label} ${l.section.title}`).includes(q))
    : null;

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 text-left">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-800 pb-6 gap-4">
          <div role="heading" aria-level={1} className="text-3xl font-black tracking-tight text-white">
            PANEL <span className="text-cyan-400">ADMIN</span>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder="Buscar una página…"
            autoFocus
            className="w-full md:w-80 bg-neutral-900 border border-neutral-700 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 outline-none"
          />
        </div>

        {searchResults ? (
          /* SEARCH RESULTS */
          <section>
            <div role="heading" aria-level={2} className="font-black text-sm uppercase tracking-widest text-neutral-400 mb-3">
              Resultados ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <p className="text-neutral-500 text-sm italic">No hay páginas con ese nombre.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {searchResults.map((link) => (
                  <HubLink
                    key={link.to}
                    link={{ ...link, label: `${link.label} · ${link.section.title}` }}
                    colors={SECTION_COLORS[link.section.color] || SECTION_COLORS.neutral}
                    isFavorite={favorites.includes(link.to)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* FAVORITES */}
            <section className="rounded-2xl border border-yellow-900/40 bg-yellow-950/10 p-5">
              <div role="heading" aria-level={2} className="font-black text-lg text-yellow-400 mb-3">⭐ Favoritos</div>
              {favoriteLinks.length === 0 ? (
                <p className="text-neutral-500 text-sm italic">Toca la ☆ junto a cualquier enlace para fijarlo aquí.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {favoriteLinks.map((link) => (
                    <HubLink
                      key={link.to}
                      link={link}
                      colors={SECTION_COLORS[link.section.color] || SECTION_COLORS.neutral}
                      isFavorite
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* SECTIONS */}
            {ADMIN_SECTIONS.map((section) => {
              const colors = SECTION_COLORS[section.color] || SECTION_COLORS.neutral;
              const isOpen = openSections[section.id];
              return (
                <section key={section.id} className={`rounded-2xl border ${colors.border} ${colors.bg} p-5`}>
                  <button
                    type="button"
                    onClick={() => setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                    className="w-full flex items-center justify-between text-left"
                    aria-expanded={isOpen}
                  >
                    <div role="heading" aria-level={2} className={`font-black text-lg ${colors.title}`}>
                      {section.emoji} {section.title}
                      <span className="ml-2 text-xs font-bold text-neutral-500">{section.links.length}</span>
                    </div>
                    <span className="text-neutral-500 text-sm">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
                      {section.links.map((link) => (
                        <HubLink
                          key={link.to}
                          link={link}
                          colors={colors}
                          isFavorite={favorites.includes(link.to)}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default DailyPlanHub;
