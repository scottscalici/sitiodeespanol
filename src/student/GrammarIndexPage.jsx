import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getCachedCollection } from '../utils/firestoreCache';

// A category-gallery front door to every authored grammar_pages note — the
// grammar counterpart to VocabIndexPage, but cards instead of a flat list:
// tap a category and land on its own page (that category's landing note
// when one exists, rendered as a Rolodex of its subtopics by
// GrammarNoteViewer; otherwise GrammarCategoryPage's plain Rolodex
// fallback). Typing in the search box temporarily swaps the gallery for a
// flat title-match list, so a known note is still one search away.
// Plain solid colors, not gradients — a gradient card rendered invisible
// (white-on-white) for at least one real browser, likely because Tailwind
// v4's gradient CSS relies on newer oklab color-interpolation that doesn't
// paint everywhere; a solid background-color has no such dependency.
const CARD_COLORS = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-sky-600',
  'bg-violet-600',
  'bg-teal-600',
  'bg-orange-600',
];

export default function GrammarIndexPage() {
  const [pages, setPages] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setPages(await getCachedCollection('grammar_pages'));
      } catch (err) {
        console.error('Error loading grammar index:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const map = {};
    pages.forEach((p) => {
      const cat = p.category || 'General';
      if (!map[cat]) map[cat] = { name: cat, notes: 0, landing: null };
      if (p.type === 'landing') map[cat].landing = p;
      else map[cat].notes += 1;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [pages]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return pages
      .filter((p) => p.type !== 'landing')
      .filter((p) => (p.title || p.id).toLowerCase().includes(q))
      .sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  }, [pages, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <h2 className="text-xl font-bold animate-pulse text-slate-400 uppercase tracking-widest">Cargando Índice de Gramática...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans text-slate-800 pb-24">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">Referencia</p>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">📚 Índice de Gramática</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">{categories.length} categorías</p>
          </div>
          <Link to="/" className="text-slate-500 hover:text-slate-800 font-bold text-sm bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-xl transition-colors">
            Volver al Inicio ↗
          </Link>
        </header>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar una nota específica..."
          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-400 mb-6"
        />

        {search.trim() ? (
          searchResults.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">No se encontraron notas.</div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
              {searchResults.map((page) => (
                <Link
                  key={page.id}
                  to={`/gramatica/${encodeURIComponent(page.id)}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <p className="font-black text-slate-800 truncate">{page.title || page.id}</p>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                    {page.category || 'General'}
                  </span>
                </Link>
              ))}
            </div>
          )
        ) : categories.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">No se encontraron notas.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {categories.map((cat, i) => (
              <Link
                key={cat.name}
                to={cat.landing ? `/gramatica/${encodeURIComponent(cat.landing.id)}` : `/gramatica/categoria/${encodeURIComponent(cat.name)}`}
                className={`${CARD_COLORS[i % CARD_COLORS.length]} rounded-2xl shadow-sm p-5 flex flex-col justify-between h-32 text-white hover:-translate-y-1 hover:shadow-lg transition-all`}
              >
                <span className="font-black uppercase tracking-tight text-lg leading-tight">{cat.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                  {cat.notes} {cat.notes === 1 ? 'nota' : 'notas'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
