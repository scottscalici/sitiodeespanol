import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getCachedCollection, getCachedDoc } from '../utils/firestoreCache';
import { useAuth } from '../context/AuthContext';
import { resolveCategoryColor } from '../utils/grammarCategoryColors';

// A category-gallery front door to every authored grammar_pages note — the
// grammar counterpart to VocabIndexPage, but cards instead of a flat list:
// tap a category and land on its own page (that category's landing note
// when one exists, rendered as a Rolodex of its subtopics by
// GrammarNoteViewer; otherwise GrammarCategoryPage's plain Rolodex
// fallback). Typing in the search box temporarily swaps the gallery for a
// flat title-match list, so a known note is still one search away.
//
// A course with its own curated sequence (config/grammar_sequences, edited
// from GrammarNotesManager) lands on that ordered list by default instead
// of this alphabetical gallery — see viewMode below. Tile/tag color is
// plain solid backgroundColor, not a gradient class — a gradient card
// rendered invisible (white-on-white) for at least one real browser, likely
// because Tailwind v4's gradient CSS relies on newer oklab
// color-interpolation that doesn't paint everywhere; a solid color has no
// such dependency, and it's also what lets a custom hex (resolveCategoryColor)
// apply the same way as the old fixed classes did.

export default function GrammarIndexPage() {
  const { userData } = useAuth() || {};
  const course = userData?.course;

  const [pages, setPages] = useState([]);
  const [categoryColors, setCategoryColors] = useState({});
  const [sequences, setSequences] = useState({ s2: [], s4: [] });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // null until the data below decides it for us — 'sequence' if this
  // course has a curated order set up, else the alphabetical gallery, same
  // as every course saw before sequences existed. A manual toggle after
  // that is never overridden again (this effect's guard only fires once).
  const [viewMode, setViewMode] = useState(null);
  const hasSetDefaultView = useRef(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pagesData, colorsDoc, sequencesDoc] = await Promise.all([
          getCachedCollection('grammar_pages'),
          getCachedDoc('config', 'grammar_categories'),
          getCachedDoc('config', 'grammar_sequences'),
        ]);
        setPages(pagesData);
        setCategoryColors(colorsDoc || {});
        setSequences({ s2: sequencesDoc?.s2 || [], s4: sequencesDoc?.s4 || [] });
      } catch (err) {
        console.error('Error loading grammar index:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const mySequence = useMemo(() => sequences[course] || [], [sequences, course]);

  useEffect(() => {
    if (!loading && !hasSetDefaultView.current) {
      setViewMode(mySequence.length > 0 ? 'sequence' : 'alphabetical');
      hasSetDefaultView.current = true;
    }
  }, [loading, mySequence]);

  const pagesById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);

  const sequenceRows = useMemo(
    () => mySequence.map((entry) => {
      const page = pagesById.get(entry.id);
      return {
        id: entry.id,
        title: page?.title || entry.label || entry.id,
        category: page?.category || 'General',
        exists: !!page,
      };
    }),
    [mySequence, pagesById]
  );

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
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
              {viewMode === 'sequence' ? '🧭 Guía de Gramática' : '📚 Índice de Gramática'}
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {viewMode === 'sequence' ? `${sequenceRows.length} temas en orden` : `${categories.length} categorías`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {mySequence.length > 0 && (
              <button
                type="button"
                onClick={() => setViewMode((v) => (v === 'sequence' ? 'alphabetical' : 'sequence'))}
                className="text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-xl transition-colors"
              >
                {viewMode === 'sequence' ? '📚 Índice Completo (Apuntes Variados)' : '🧭 Ver Mi Guía'}
              </button>
            )}
            <Link to="/" className="text-slate-500 hover:text-slate-800 font-bold text-sm bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-xl transition-colors">
              Volver al Inicio ↗
            </Link>
          </div>
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
                  <span
                    className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-white px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: resolveCategoryColor(page.category || 'General', categoryColors) }}
                  >
                    {page.category || 'General'}
                  </span>
                </Link>
              ))}
            </div>
          )
        ) : viewMode === 'sequence' ? (
          sequenceRows.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">No se encontraron notas.</div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
              {sequenceRows.map((row, idx) =>
                row.exists ? (
                  <Link
                    key={row.id}
                    to={`/gramatica/${encodeURIComponent(row.id)}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <span className="shrink-0 w-7 text-center text-sm font-black text-slate-400">{idx + 1}.</span>
                    <span className="shrink-0 w-3 h-3 rounded-full" style={{ backgroundColor: resolveCategoryColor(row.category, categoryColors) }} />
                    <p className="flex-1 font-black text-slate-800 truncate">{row.title}</p>
                  </Link>
                ) : (
                  <div key={row.id} className="flex items-center gap-4 px-5 py-3 opacity-50">
                    <span className="shrink-0 w-7 text-center text-sm font-black text-slate-400">{idx + 1}.</span>
                    <span className="shrink-0 w-3 h-3 rounded-full bg-slate-300" />
                    <p className="flex-1 font-bold text-slate-400 italic truncate">{row.title}</p>
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                      Próximamente
                    </span>
                  </div>
                )
              )}
            </div>
          )
        ) : categories.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">No se encontraron notas.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                to={cat.landing ? `/gramatica/${encodeURIComponent(cat.landing.id)}` : `/gramatica/categoria/${encodeURIComponent(cat.name)}`}
                className="rounded-2xl shadow-sm p-5 flex flex-col justify-between h-32 text-white hover:-translate-y-1 hover:shadow-lg transition-all"
                style={{ backgroundColor: resolveCategoryColor(cat.name, categoryColors) }}
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
