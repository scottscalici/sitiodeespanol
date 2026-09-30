import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getCachedCollection } from '../utils/firestoreCache';

// A browsable reference across every authored grammar_pages note, grouped
// by category — the grammar counterpart to VocabIndexPage. Grammar notes
// aren't scoped per-course/textbook the way vocab is (a category is just a
// free-text grouping label set by the admin), so no access filtering here.
export default function GrammarIndexPage() {
  const [pages, setPages] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
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

  const categories = useMemo(
    () => ['Todas', ...new Set(pages.map((p) => p.category || 'General'))].sort((a, b) => (a === 'Todas' ? -1 : b === 'Todas' ? 1 : a.localeCompare(b))),
    [pages]
  );

  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pages
      .filter((p) => categoryFilter === 'Todas' || (p.category || 'General') === categoryFilter)
      .filter((p) => !q || (p.title || p.id).toLowerCase().includes(q))
      .sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  }, [pages, search, categoryFilter]);

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
            <p className="text-sm font-medium text-slate-500 mt-1">{filteredPages.length} notas encontradas</p>
          </div>
          <Link to="/" className="text-slate-500 hover:text-slate-800 font-bold text-sm bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-xl transition-colors">
            Volver al Inicio ↗
          </Link>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar un tema de gramática..."
            className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-400"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-indigo-700 outline-none focus:border-indigo-400"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat === 'Todas' ? 'Todas las Categorías' : cat}</option>
            ))}
          </select>
        </div>

        {filteredPages.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">
            No se encontraron notas.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
            {filteredPages.map((page) => (
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
        )}
      </div>
    </div>
  );
}
